import {questionHash,questionState,updateQuestionStatus} from './question-approval.mjs';
import {validatePlan,validateForJob} from './domain.mjs';
import {analyze} from './ai.mjs';
import {directMode} from './workflow-config.mjs';
import {validateDirectResult} from './direct-ai.mjs';
export class ScriptWorkflow{
  constructor({store,env,checkFresh,analyzer=analyze,directResolver=null}){Object.assign(this,{store,env,checkFresh,analyzer,directResolver});this.active=new Set();}
  recoverPendingTasks(){
    if(!this.directResolver?.tasks)return;
    for(const job of this.store.list()){
      if(job.mode!==directMode||!job.analysisTaskId)continue;
      const task=this.directResolver.tasks.get(job.analysisTaskId),subject=job.id+':analysis';
      if(!task)continue;
      this.directResolver.tasks.supersedeQueued(subject,task.id);
      if(['queued','working'].includes(task.status)||task.status==='completed'&&!task.appliedAt){
        job.status='analyzing';job.error=null;job.revisionRequest={...(job.revisionRequest||{}),status:'working'};this.store.save(job);
      }else if(task.status==='failed'){
        job.status='failed';job.error=task.error||'The saved AI task failed. Retry once the worker is available.';job.revisionRequest={...(job.revisionRequest||{}),status:'failed'};this.store.save(job);
      }
    }
  }
  async start(id,feedback='',index){
    const source=this.store.get(id);if(source?.mode===directMode)return this.startDirect(id,feedback,index);
    if(Number.isInteger(index))return this.startQuestion(id,feedback,index);
    const job=this.store.get(id);
    feedback=[...new Set([...(job.reviews||[]).filter(r=>r.decision==='reject').map(r=>r.note),feedback].filter(Boolean))].join('\n\n');
    if(this.active.has(id)||job.status==='analyzing')throw Object.assign(new Error('Script analysis is already running.'),{status:409});
    if(!this.env.OPENAI_API_KEY){job.status=job.plan?'revision_pending':'awaiting_script';job.revisionRequest={feedback,status:'awaiting_manual_update',at:new Date().toISOString()};job.error='OpenAI is not connected. An administrator can prepare or revise this script manually for the test; no automatic rewrite has run.';this.store.save(job);return job;}
    await this.checkFresh(job);if(this.store.get(id).revision!==job.revision)throw Object.assign(new Error('The article changed. Reload before analysis.'),{status:409});
    const limit=Number(this.env.DAILY_ANALYSIS_LIMIT||10);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid daily analysis limit.');this.store.consume(limit);
    const previousPlan=job.plan;
    if(job.plan)job.history=[...(job.history||[]),{at:job.updated,plan:job.plan,reviews:job.reviews,origin:job.origin,audit:job.audit,validation:job.validation,revision:job.revision}];
    job.status='analyzing';job.reviews=[];job.plan=null;job.error=null;job.origin='OpenAI API draft with separate semantic review';job.revisionRequest={feedback,status:'working',at:new Date().toISOString()};this.store.save(job);this.active.add(id);
    this.analyzer(job.doc,job.client,{previousPlan,feedback}).then(result=>{Object.assign(job,result);job.status=result.validation.errors.length||!result.audit.passed?'needs_review':'content_review';job.revisionRequest.status='applied';this.store.save(job);this.store.record(id,'system','script_revision_finished');}).catch(e=>{job.status='failed';job.error=e.message;job.revisionRequest.status='failed';this.store.save(job);}).finally(()=>this.active.delete(id));return job;
  }
  async startDirect(id,feedback='',index){
    if(!this.directResolver)throw new Error('The direct-document AI resolver is unavailable.');
    if(!this.directResolver.configured())throw new Error(this.directResolver.provider()==='codex_worker'?'The local Codex worker connection is not configured.':'Claude is not configured.');
    const job=this.store.get(id),scoped=Number.isInteger(index),key=scoped?id+':'+index:id;
    if(!scoped&&job.analysisTaskId){
      const pending=this.directResolver.tasks?.get(job.analysisTaskId);
      if(pending&&pending.payload?.context?.sourceHash===job.doc.sourceHash&&(['queued','working'].includes(pending.status)||pending.status==='completed'&&!pending.appliedAt)){
        this.directResolver.tasks.supersedeQueued(job.id+':analysis',pending.id);
        job.status='analyzing';job.error=null;job.revisionRequest={...(job.revisionRequest||{}),status:'working'};return this.store.save(job);
      }
    }
    if(this.active.has(key)||!scoped&&job.status==='analyzing')throw Object.assign(new Error('Script analysis is already running.'),{status:409});
    await this.checkFresh(job,scoped?index:undefined);
    const limit=Number(this.env.DAILY_ANALYSIS_LIMIT||10);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid daily analysis limit.');this.store.consume(limit);
    const provider=this.directResolver.provider();
    if(scoped){
      const state=questionState(job,index);feedback=[...new Set([...state.reviews.filter(r=>r.decision==='reject').map(r=>r.note),feedback].filter(Boolean))].join('\n\n');
      const previousPlan={...job.plan,videos:[job.plan.videos[index]],skipped:[]};
      const previousAttempt=job.questionRequests?.[index]?.attempt||0,attempt=previousAttempt+1;
      job.questionRequests={...(job.questionRequests||{}),[index]:{index,draftHash:state.draftHash,feedback,status:'working',provider,attempt,at:new Date().toISOString()}};this.store.save(job);
      const submitted=this.directResolver.submit(job,{previousPlan,feedback,onlyQuestion:job.plan.videos[index].question,index,draftHash:state.draftHash,maxVideos:1,attemptToken:attempt});
      if(submitted.task){job.questionRequests[index].taskId=submitted.task.id;this.store.save(job);}else this.finishDirectPromise(submitted.promise,{jobId:id,index,draftHash:state.draftHash});
      return job;
    }
    feedback=[...new Set([...(job.reviews||[]).filter(r=>r.decision==='reject').map(r=>r.note),feedback].filter(Boolean))].join('\n\n');
    const previousPlan=job.plan?structuredClone(job.plan):null;
    if(job.plan)job.history=[...(job.history||[]),{at:job.updated,plan:job.plan,reviews:job.reviews,origin:job.origin,audit:job.audit,validation:job.validation,revision:job.revision}];
    job.status='analyzing';job.reviews=[];job.questionReviews=[];job.plan=null;job.error=null;job.analysisAttempt=(job.analysisAttempt||0)+1;job.origin=provider==='codex_worker'?'Local Codex worker draft with source audit':'Claude API draft with source audit';job.revisionRequest={feedback,status:'working',provider,at:new Date().toISOString()};this.store.save(job);
    const submitted=this.directResolver.submit(job,{previousPlan,feedback,maxVideos:job.maxVideos||2});
    if(submitted.task){job.analysisTaskId=submitted.task.id;this.store.save(job);}else this.finishDirectPromise(submitted.promise,{jobId:id});
    return job;
  }
  finishDirectPromise(promise,context){
    const key=Number.isInteger(context.index)?context.jobId+':'+context.index:context.jobId;this.active.add(key);
    promise.then(result=>this.applyDirectResult(result,context)).catch(e=>this.failDirect(e,context)).finally(()=>this.active.delete(key));
  }
  async applyTask(task){
    if(task.type!=='ai_codex'||task.appliedAt)return;
    const context=task.payload?.context||{},current=this.store.get(context.jobId);
    if(!current||current.doc?.sourceHash!==context.sourceHash){this.directResolver.tasks.markApplied(task.id);throw new Error('The completed AI task belongs to an earlier source revision and was not applied.');}
    try{await this.applyDirectResult(task.result,context);this.directResolver.tasks.markApplied(task.id);}catch(e){this.failDirect(e,context);this.directResolver.tasks.markApplied(task.id);throw e;}
  }
  async applyDirectResult(result,{jobId,index,draftHash}){
    const current=this.store.get(jobId);if(!current||current.mode!==directMode)throw new Error('The direct-document job is no longer available.');
    if(current.doc.sourceHash!==result?.sourceHash&&result?.sourceHash)throw new Error('The AI result does not match the current document source.');
    if(Number.isInteger(index)){
      if(questionHash(current,index)!==draftHash)throw new Error('This question changed while the rewrite was running. Review the current draft.');
      const validated=validateDirectResult(result,current,{onlyQuestion:true});
      current.history=[...(current.history||[]),{at:current.updated,plan:structuredClone(current.plan),questionReviews:current.questionReviews,reviews:current.reviews,reason:'Single question rewritten by the configured AI provider.'}];
      current.plan.videos[index]=validated.plan.videos[0];current.validation=validateForJob(current.plan,current.doc,current.client);
      current.questionRequests[index]={...current.questionRequests[index],draftHash:questionHash(current,index),status:'applied'};
      current.questionAudits={...(current.questionAudits||{}),[index]:{...validated.audit,draftHash:questionHash(current,index)}};updateQuestionStatus(current);current.error=null;this.store.save(current);this.store.record(jobId,'system','question_'+index+'_revision_finished');return current;
    }
    const validated=validateDirectResult(result,current);Object.assign(current,validated);current.status=validated.validation.errors.length||!validated.audit.passed?'needs_review':'content_review';current.revisionRequest={...(current.revisionRequest||{}),status:'applied'};current.analysisTaskId=null;current.error=null;this.store.save(current);this.store.record(jobId,'system','script_analysis_finished');return current;
  }
  failDirect(error,{jobId,index}){const job=this.store.get(jobId);if(!job)return;if(Number.isInteger(index)&&job.questionRequests?.[index]){job.questionRequests[index].status='failed';job.questionRequests[index].error=error.message;updateQuestionStatus(job);}else{job.status='failed';job.error=error.message;if(job.revisionRequest)job.revisionRequest.status='failed';}this.store.save(job);}
  async startQuestion(id,feedback,index){
    const job=this.store.get(id),state=questionState(job,index),key=id+':'+index;
    if(this.active.has(key))throw new Error('This question is already being revised.');
    feedback=[...new Set([...state.reviews.filter(r=>r.decision==='reject').map(r=>r.note),feedback].filter(Boolean))].join('\n\n');
    job.questionRequests={...(job.questionRequests||{}),[index]:{index,draftHash:state.draftHash,feedback,status:this.env.OPENAI_API_KEY?'working':'awaiting_manual_update',at:new Date().toISOString()}};
    if(!this.env.OPENAI_API_KEY){updateQuestionStatus(job);this.store.save(job);return job;}
    await this.checkFresh(job);if(this.store.get(id).revision!==job.revision)throw new Error('The article changed. Reload before revising this question.');
    const limit=Number(this.env.DAILY_ANALYSIS_LIMIT||10);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid daily analysis limit.');this.store.consume(limit);
    this.store.save(job);this.active.add(key);
    const previousPlan={...job.plan,videos:[job.plan.videos[index]]};
    this.analyzer(job.doc,{...job.client,maxVideos:1},{previousPlan,feedback,onlyQuestion:job.plan.videos[index].question}).then(result=>{
      const current=this.store.get(id);if(questionHash(current,index)!==state.draftHash)throw new Error('This question changed while the rewrite was running. Review before retrying.');
      if(result.plan?.videos?.length!==1)throw new Error('The targeted rewrite must return exactly one script.');
      current.history=[...(current.history||[]),{at:current.updated,plan:structuredClone(current.plan),questionReviews:current.questionReviews,reviews:current.reviews,reason:'Single question rewritten.'}];
      current.plan.videos[index]=result.plan.videos[0];current.validation=validatePlan(current.plan,current.doc,current.client);
      current.questionRequests[index]={...current.questionRequests[index],draftHash:questionHash(current,index),status:'applied'};
      current.questionAudits={...(current.questionAudits||{}),[index]:{...result.audit,draftHash:questionHash(current,index)}};
      updateQuestionStatus(current);this.store.save(current);this.store.record(id,'system','question_'+index+'_revision_finished');
    }).catch(e=>{const current=this.store.get(id);if(current.questionRequests?.[index]?.draftHash===state.draftHash){current.questionRequests[index].status='failed';current.questionRequests[index].error=e.message;updateQuestionStatus(current);this.store.save(current);}}).finally(()=>this.active.delete(key));return job;
  }

}
