import {hash,validateForJob} from './domain.mjs';
import {rulesHash} from './rules.mjs';
import {directMode,scriptPolicyHash,scriptTargetSeconds} from './workflow-config.mjs';
export function questionPlan(job,index){
 if(!Number.isInteger(index)||!job?.plan?.videos?.[index])throw new Error('Choose one specific question to review. Article-wide approval is disabled.');
 return {...job.plan,videos:[job.plan.videos[index]],skipped:[]};
}
export function questionHash(job,index){const p=questionPlan(job,index),target=scriptTargetSeconds(job);return hash([p.videos[0],p.articleIdentity,p.presenterContext,job.doc.sourceHash,job.client,job.scriptRulesHash||job.rulesHash,...(target===30?[]:[target])]);}
export function questionState(job,index){
 const fingerprint=questionHash(job,index),reviews=(job.questionReviews||[]).filter(r=>r.index===index&&r.draftHash===fingerprint),last=reviews.at(-1),request=job.questionRequests?.[index];
 const pending=request?.draftHash===fingerprint&&['working','awaiting_manual_update','failed'].includes(request.status);
 const decision=last?.decision,status=pending?(request.status==='working'?'analyzing':'revision_pending'):decision==='approve'?'approved':decision==='reject'?'revision_pending':decision==='skip'?'skipped':'pending';
 return {index,draftHash:fingerprint,question:job.plan.videos[index].question,status,reviews,request:request?.draftHash===fingerprint?request:null,validation:validateForJob(questionPlan(job,index),job.doc,job.client,1,scriptTargetSeconds(job))};
}
export function assertSourceAudit(job,index){
 const state=questionState(job,index),saved=job.questionAudits?.[index],audit=saved?.draftHash===state.draftHash?saved:null;
 if(audit){if(!audit.manual&&audit.passed!==true)throw new Error('This question has unresolved source-audit issues.');return audit;}
 const required=job.auditRequired===true||/^(?:OpenAI API|Local Codex worker|Claude API) draft\b/i.test(job.origin||'');
 if(required&&job.audit?.passed!==true)throw new Error('The source audit has unresolved issues.');
 return job.audit||null;
}
export function approvedQuestion(job,index){
 const state=questionState(job,index);
 if(job.mode===directMode){if(job.scriptRulesHash!==scriptPolicyHash)throw new Error('The script policy changed. Review the current question again.');}
 else if(job.rulesHash!==rulesHash)throw new Error('The content rulebook changed. Review the current question again.');
 if(state.status!=='approved')throw new Error('Finish the content review for this question before creating its video.');
 if(state.validation.errors.length)throw new Error('This question has unresolved content checks.');
 assertSourceAudit(job,index);
 return hash([state.draftHash,state.reviews.at(-1)]);
}
export function updateQuestionStatus(job){
 if(!job.plan?.videos?.length)return job;
 const states=job.plan.videos.map((_,i)=>questionState(job,i));
 const approved=states.filter(s=>s.status==='approved').length,terminal=states.every(s=>['approved','skipped'].includes(s.status));
 job.status=terminal&&approved?'pilot_reviewed':terminal?'no_videos_selected':approved?'partially_reviewed':states.some(s=>s.status==='revision_pending')?'revision_pending':'content_review';return job;
}
export function recordQuestionReview(job,index,review){
 const state=questionState(job,index);
 const item={...review,index,candidateId:job.plan.videos[index].candidateId,question:job.plan.videos[index].question,draftHash:state.draftHash};
 job.questionReviews=[...(job.questionReviews||[]),item];job.reviews=[...(job.reviews||[]),item];updateQuestionStatus(job);return item;
}
