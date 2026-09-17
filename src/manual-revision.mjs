import {validatePlan} from './domain.mjs';
import {questionHash,updateQuestionStatus} from './question-approval.mjs';

export function manualRevision(job,body,actor){
  const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
  if(!actor)fail('An authenticated administrator manages manual draft updates.',403);
  if(job.status==='analyzing'||body.expectedRevision!==job.revision)fail('The draft changed. Reload before saving a revision.',409);

  if(typeof body.note!=='string'||body.note.trim().length<10||body.note.length>4000)fail('Include revision notes of 10 to 4000 characters.');
  const plan=body.plan;
  if(!Array.isArray(plan?.videos)||!Array.isArray(plan?.skipped)||plan.videos.some(v=>!v||typeof v.question!=='string'||typeof v.reason!=='string'||!Array.isArray(v.sentences)||!Array.isArray(v.reviewFlags)||typeof v.cta!=='string'||typeof v.disclaimer!=='string'||v.sentences.some(s=>!s||typeof s.text!=='string'||!Array.isArray(s.evidence))))fail('Invalid revised script format.');
  const validation=validatePlan(plan,job.doc,job.client);
  if(validation.errors.length)fail(validation.errors.join(' '));
  const next=structuredClone(job);
  next.history=[...(next.history||[]),...(job.plan?[{at:job.updated,plan:job.plan,reviews:job.reviews,origin:job.origin,validation:job.validation,audit:job.audit,revision:job.revision}]:[])];
  next.plan=structuredClone(plan);next.validation=validation;
  next.origin='Manual revision with source evidence; no API generation';next.auditRequired=false;
  next.audit={passed:null,issues:['Manual draft revision. A script reviewer must review the revised wording against the cited article.']};
  next.status='content_review';next.error=null;next.scriptTargetSeconds=30;
  next.draftVersion=(job.draftVersion||1)+1;
  next.manualRevisions=[...(next.manualRevisions||[]),{actor,at:new Date().toISOString(),note:body.note.trim(),previousRevision:job.revision,draftVersion:next.draftVersion}];
  // Old decisions remain in history; none approve the new wording.
  next.reviews=[];if(next.revisionRequest)next.revisionRequest={...next.revisionRequest,status:'applied_manually',appliedAt:new Date().toISOString()};
  next.questionRequests={...(next.questionRequests||{})};
  next.questionAudits={...(next.questionAudits||{})};
  next.plan.videos.forEach((v,index)=>{if(job.plan?.videos?.[index]&&questionHash(job,index)===questionHash(next,index))return;delete next.questionRequests[index];next.questionAudits[index]={draftHash:questionHash(next,index),passed:null,manual:true};});
  return updateQuestionStatus(next);
}
