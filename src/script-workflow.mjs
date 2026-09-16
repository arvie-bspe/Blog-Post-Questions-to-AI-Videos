import {questionHash,questionState,updateQuestionStatus} from './question-approval.mjs';
import {validatePlan} from './domain.mjs';
import {analyze} from './ai.mjs';
export class ScriptWorkflow{
  constructor({store,env,checkFresh,analyzer=analyze}){Object.assign(this,{store,env,checkFresh,analyzer});this.active=new Set();}
  async start(id,feedback='',index){
    if(Number.isInteger(index))return this.startQuestion(id,feedback,index);
    const job=this.store.get(id);
    feedback=[...new Set([...(job.reviews||[]).filter(r=>r.decision==='reject').map(r=>r.note),feedback].filter(Boolean))].join('\n\n');
    if(this.active.has(id)||job.status==='analyzing')throw Object.assign(new Error('Script analysis is already running.'),{status:409});
    if(!this.env.OPENAI_API_KEY){job.status=job.plan?'revision_pending':'awaiting_script';job.revisionRequest={feedback,status:'awaiting_manual_update',at:new Date().toISOString()};job.error='OpenAI is not connected. Codex/Arvie can prepare or revise this script manually for the test; no automatic rewrite has run.';this.store.save(job);return job;}
    await this.checkFresh(job);if(this.store.get(id).revision!==job.revision)throw Object.assign(new Error('The article changed. Reload before analysis.'),{status:409});
    const limit=Number(this.env.DAILY_ANALYSIS_LIMIT||10);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid daily analysis limit.');this.store.consume(limit);
    const previousPlan=job.plan;
    if(job.plan)job.history=[...(job.history||[]),{at:job.updated,plan:job.plan,reviews:job.reviews,origin:job.origin,audit:job.audit,validation:job.validation,revision:job.revision}];
    job.status='analyzing';job.reviews=[];job.plan=null;job.error=null;job.origin='OpenAI API draft with separate semantic review';job.revisionRequest={feedback,status:'working',at:new Date().toISOString()};this.store.save(job);this.active.add(id);
    this.analyzer(job.doc,job.client,{previousPlan,feedback}).then(result=>{Object.assign(job,result);job.status=result.validation.errors.length||!result.audit.passed?'needs_review':'content_review';job.revisionRequest.status='applied';this.store.save(job);this.store.record(id,'system','script_revision_finished');}).catch(e=>{job.status='failed';job.error=e.message;job.revisionRequest.status='failed';this.store.save(job);}).finally(()=>this.active.delete(id));return job;
  }
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
