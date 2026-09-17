import {questionState} from './question-approval.mjs';

const count=(items,statuses)=>items.filter(item=>statuses.includes(item.status)).length;
const item=(number,singular,plural=singular+'s')=>`${number} ${number===1?singular:plural}`;

export function workflowStep(job,videos=[]){
  if(job.status==='analyzing')return {key:'script_generation',label:'Creating scripts',tone:'wait',tab:'scripts'};
  if(job.status==='awaiting_script')return {key:'script_waiting',label:'Waiting for AI worker',tone:'wait',tab:'scripts'};
  if(job.status==='interrupted')return {key:'attention',label:'Script generation interrupted',tone:'wait',tab:'scripts'};
  if(['failed','source_changed','needs_review'].includes(job.status))return {key:'attention',label:'Needs attention',tone:'wait',tab:'scripts'};
  const states=(job.plan?.videos||[]).map((_,index)=>questionState(job,index)),parts=[];
  const delivered=count(videos,['delivered']),review=count(videos,['visual_review']),processing=count(videos,['prepared','working','compositing','delivery_pending']),videoChanges=count(videos,['revision_pending','needs_attention','paused','needs_reconciliation','failed']);
  const approved=count(states,['approved']),pending=count(states,['pending']),scriptChanges=count(states,['revision_pending','analyzing']),skipped=count(states,['skipped']);
  if(delivered)parts.push(item(delivered,'video saved','videos saved'));
  if(review)parts.push(item(review,'video ready for review','videos ready for review'));
  if(processing)parts.push(item(processing,'video processing','videos processing'));
  if(videoChanges)parts.push(item(videoChanges,'video needs attention','videos need attention'));
  const videosForApproved=new Set(videos.filter(video=>Number.isInteger(video.index)).map(video=>video.index));
  const waitingApproved=states.filter(state=>state.status==='approved'&&!videosForApproved.has(state.index)).length;
  if(waitingApproved)parts.push(item(waitingApproved,'approved script queued','approved scripts queued'));
  if(scriptChanges)parts.push(item(scriptChanges,'script change requested','script changes requested'));
  if(pending)parts.push(item(pending,'script ready for review','scripts ready for review'));
  if(!parts.length&&skipped===states.length&&states.length)parts.push('No videos selected');
  if(!parts.length&&approved)parts.push(item(approved,'approved script','approved scripts'));
  const tab=review||processing||delivered||videoChanges?'video':'scripts',tone=delivered||review?'ok':'wait';
  return {key:tab==='video'?'video_progress':pending||scriptChanges?'script_review':'complete',label:parts.slice(0,2).join(' · ')||'Source retrieved',tone,tab};
}
