import {hash,validateForJob} from './domain.mjs';
import {rulesHash} from './rules.mjs';
import {directMode,scriptPolicyHash} from './workflow-config.mjs';
export function questionPlan(job,index){
 if(!Number.isInteger(index)||!job?.plan?.videos?.[index])throw new Error('Choose one specific question to review. Article-wide approval is disabled.');
 return {...job.plan,videos:[job.plan.videos[index]],skipped:[]};
}
export function questionHash(job,index){const p=questionPlan(job,index);return hash([p.videos[0],p.articleIdentity,p.presenterContext,job.doc.sourceHash,job.client,job.scriptRulesHash||job.rulesHash]);}
export function questionState(job,index){
 const fingerprint=questionHash(job,index),reviews=(job.questionReviews||[]).filter(r=>r.index===index&&r.draftHash===fingerprint),last=reviews.at(-1),request=job.questionRequests?.[index];
 const pending=request?.draftHash===fingerprint&&['working','awaiting_manual_update','failed'].includes(request.status);
 return {index,draftHash:fingerprint,question:job.plan.videos[index].question,status:pending?(request.status==='working'?'analyzing':'revision_pending'):last?.decision==='approve'?'approved':last?.decision==='reject'?'revision_pending':'pending',reviews,request:request?.draftHash===fingerprint?request:null,validation:validateForJob(questionPlan(job,index),job.doc,job.client,1)};
}
export function approvedQuestion(job,index){
 const state=questionState(job,index);
 if(job.mode===directMode){if(job.scriptRulesHash!==scriptPolicyHash)throw new Error('The script policy changed. Review the current question again.');}
 else if(job.rulesHash!==rulesHash)throw new Error('The content rulebook changed. Review the current question again.');
 if(state.status!=='approved')throw new Error('Finish the content review for this question before creating its video.');
 if(state.validation.errors.length)throw new Error('This question has unresolved content checks.');
 const savedAudit=job.questionAudits?.[index],audit=savedAudit?.draftHash===state.draftHash?savedAudit:null;
 if(audit&&!audit.manual&&!audit.passed)throw new Error('This question has unresolved source-audit issues.');
 if(!audit&&job.origin?.startsWith('OpenAI')&&!job.audit?.passed)throw new Error('The source audit has unresolved issues.');
 return hash([state.draftHash,state.reviews.at(-1)]);
}
export function updateQuestionStatus(job){
 if(!job.plan?.videos?.length)return job;
 const states=job.plan.videos.map((_,i)=>questionState(job,i));
 job.status=states.every(s=>s.status==='approved')?'pilot_reviewed':states.some(s=>s.status==='approved')?'partially_reviewed':states.some(s=>s.status==='revision_pending')?'revision_pending':'content_review';return job;
}
export function recordQuestionReview(job,index,review){
 const state=questionState(job,index);
 const item={...review,index,candidateId:job.plan.videos[index].candidateId,question:job.plan.videos[index].question,draftHash:state.draftHash};
 job.questionReviews=[...(job.questionReviews||[]),item];job.reviews=[...(job.reviews||[]),item];updateQuestionStatus(job);return item;
}
