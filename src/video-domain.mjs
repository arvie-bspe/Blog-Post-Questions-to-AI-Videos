import {approvedQuestion as approved} from './question-approval.mjs';
import {repeatsScriptHeading} from './script-content.mjs';
import {hash,validatePlan} from './domain.mjs';
import {rulesHash} from './rules.mjs';

export const voices=[{id:'am_michael',name:'Michael · US English · male'},{id:'am_adam',name:'Adam · US English · male'},{id:'af_heart',name:'Heart · US English · female'},{id:'af_bella',name:'Bella · US English · female'}];
export const models={speech:'fal-ai/kokoro/american-english',alignment:'fal-ai/elevenlabs/forced-alignment',video:'veed/fabric-1.0'};
export const prices={checked:'2026-09-14',speechPerThousandCharacters:0.02,alignmentPerStartedHour:0.22,videoPerSecond:0.15,currency:'USD'};
export const presenterId='studio-presenter-01';
export const scriptText=v=>{if(repeatsScriptHeading(v))throw new Error('The script repeats its title/question. Revise and approve the corrected script before rendering.');return [v.question,...v.sentences.map(s=>s.text),v.cta,v.disclaimer].filter(Boolean).join('\n\n');};
export {approvedQuestion as approved} from "./question-approval.mjs";
export function prepare(job,body,assetHash){
  const index=body.index,approvalHash=approved(job,index),video=job.plan.videos[index];
  if(!Number.isInteger(index)||!video)throw new Error('Choose an approved question.');
  if(!voices.some(v=>v.id===body.voice))throw new Error('Choose a supported voice.');
  if(body.presenterAccepted!==true)throw new Error('Confirm the generic presenter for this test.');
  const title=String(body.thumbnailTitle||'').trim();
  if(title.length>80||title.split(/\s+/).length<3||title.split(/\s+/).length>6||/[{}\\\r\n]/.test(title))throw new Error('Use a thumbnail topic of 3 to 6 words, without line breaks or special markup.');
  const text=scriptText(video);
  if(text.length>7000)throw new Error('This script exceeds the first-pilot speech limit.');
  if([text,job.client.name,job.client.address,job.client.phone].some(t=>typeof t!=='string'||!t.trim()||/[{}\\\x00-\x08]/.test(t)))throw new Error('Script or client contact details are missing or contain unsupported caption markup.');
  return {parentId:job.id,index,approvalHash,script:text,scriptHash:hash(text),question:video.question,thumbnailTitle:title,voice:body.voice,presenterId,assetHash,client:job.client,source:{documentUrl:job.row.documentUrl,sourceHash:job.doc.sourceHash,mode:job.mode,rulesHash:job.rulesHash,folderUrl:job.row.folderUrl},models,prices,identity:hash([job.id,index,approvalHash,body.voice,assetHash,title]),status:'prepared',requests:{},files:{},reviews:[]};
}
const canonical=s=>String(s).normalize('NFKC').replace(/\s+/g,'').toLowerCase();
export function captions(alignment,script,question,duration){
  if(!Number.isFinite(duration)||duration<=0)throw new Error('The audio duration could not be measured.');
  let words=alignment.words?.filter(w=>String(w.text).trim());
  const comparable=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  if(!words?.length||comparable(words.map(w=>w.text).join(''))!==comparable(script))throw new Error('Alignment does not match every word of the approved script.');
  const exact=script.trim().split(/\s+/);if(exact.length===words.length)words=words.map((w,i)=>({...w,text:exact[i]}));
  let previous=0,offset=0;const questionEnd=canonical(question).length,cues=[];let cue=null;
  for(const word of words){
    const {start,end}=word;
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<previous-0.05||start<0||end<=start||end>duration+0.12)throw new Error('Alignment contains missing, overlapping, or out-of-range word timings.');
    const isQuestion=offset<questionEnd,text=String(word.text).trim();offset+=canonical(text).length;previous=end;
    // Word timestamps are available here, so keep each timed caption compact
    // enough for two readable portrait lines without estimating new timings.
    if(!cue||cue.question!==isQuestion||cue.text.length+text.length+1>44||end-cue.start>3.5){cue={start,end,text: isQuestion?text.toUpperCase():text,question:isQuestion};cues.push(cue);}
    else{cue.text+=' '+(isQuestion?text.toUpperCase():text);cue.end=end;}
  }
  return cues;
}
export const speechEstimate=text=>Number((text.length/1000*prices.speechPerThousandCharacters+prices.alignmentPerStartedHour).toFixed(3));
export const videoEstimate=duration=>Number((duration*prices.videoPerSecond).toFixed(2));
