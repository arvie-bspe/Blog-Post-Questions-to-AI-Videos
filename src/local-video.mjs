import {randomUUID} from 'node:crypto';
import {copyFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {hash} from './domain.mjs';
import {approved,scriptText,captions} from './video-domain.mjs';
import {requireArticleIdentity,presenterGender} from './article-identity.mjs';
import {endCardData,layoutVersion,detectorVersion} from './visual-checks.mjs';
import {matchingPresenter,presenterPool} from './presenter-compatibility.mjs';
import {durationOf} from './media.mjs';
import {appearanceRulesHash} from './rules.mjs';

const now=()=>new Date().toISOString();
export const localAvatar=presenterPool.avatars.find(a=>a.id==='local-studio-presenter-01');
export const localVoice=presenterPool.voices.find(v=>v.id==='am_michael');

function localPresenter(job,index){
  const required=presenterGender(job.doc,job.plan?.presenterContext),avatars=presenterPool.avatars.filter(a=>a.type==='local_image'&&(!required||a.gender===required));
  const pairs=avatars.flatMap(avatar=>presenterPool.voices.filter(voice=>voice.type==='local_tts'&&voice.gender===avatar.gender).map(voice=>({avatar,voice})));
  if(!pairs.length)throw new Error(required?`No approved local ${required} presenter and matching voice are configured.`:'No approved local presenter and matching voice are configured.');
  const pair=pairs[parseInt(hash([job.id,index,'local-presenter']).slice(0,8),16)%pairs.length];matchingPresenter(pair.avatar,pair.voice);return pair;
}

export function prepareLocal(job,index){
  if(job.setupIssues?.length)throw new Error(job.setupIssues.join(' '));
  const approvalHash=approved(job,index),video=job.plan.videos[index];if(!video)throw new Error('Choose one approved question.');const {avatar,voice}=localPresenter(job,index);
  const script=scriptText(video),articleIdentity=requireArticleIdentity(job.doc,job.plan.articleIdentity),endCard={...endCardData({articleIdentity,script,source:{targetUrl:job.row.pageUrl}}),seconds:3};
  const wordCount=script.trim().split(/\s+/).filter(Boolean).length,title=String(video.thumbnailTitle||video.question.replace(/\?$/,'')).trim().split(/\s+/).slice(0,6).join(' ');
  const data={provider:'local_worker',layoutVersion,endCard,articleIdentity,parentId:job.id,index,approvalHash,script,scriptHash:hash(script),question:video.question,thumbnailTitle:title,avatar,voice,client:job.client,
    source:{documentUrl:job.row.documentUrl,sourceHash:job.doc.sourceHash,mode:job.mode,rulesHash:appearanceRulesHash,folderUrl:job.row.folderUrl,targetUrl:job.row.pageUrl},models:{speech:'Kokoro-82M ONNX',video:'SadTalker',alignment:'Kokoro duration output'},format:{width:1080,height:1920,aspectRatio:'9:16'},logoRequired:true,outputRevision:1,targetSeconds:30,wordCount,estimatedSeconds:Math.max(1,Math.ceil(wordCount/2.2)),renderEstimate:0,prices:{currency:'USD',providerCharge:0},identity:hash(['local_worker',job.id,index,approvalHash,avatar.id,voice.id,title,layoutVersion,appearanceRulesHash]),status:'prepared',requests:{},files:{},reviews:[]};
  return {...data,id:randomUUID(),created:now(),createdBy:'system'};
}

export async function queueLocalVideo(service,parent,index,actor){
  const data=prepareLocal(parent,index),existing=service.db.prepare('SELECT payload FROM videos WHERE identity=?').get(data.identity);if(existing)return JSON.parse(existing.payload);
  data.createdBy=actor;service.save(data);await service.ensureLogo(data);return enqueueLocalRecord(service,data,parent,actor);
}
async function enqueueLocalRecord(service,data,parent,actor){
  const task=service.tasks.enqueue({type:'media_local',subject:data.id,payload:{context:{videoId:data.id,parentId:parent.id,index:data.index,sourceHash:parent.doc.sourceHash,approvalHash:data.approvalHash},script:data.script,question:data.question,voice:data.voice,presenterAsset:data.avatar.asset,target:{seconds:30,aspectRatio:'9:16'},engines:{speech:'kokoro-onnx',animation:'sadtalker',alignment:'kokoro-duration'}},priority:20,idempotencyKey:hash(['media_local',data.id,data.approvalHash])});
  data.workerTaskId=task.id;data.status='working';data.stage='local_render';data.requests.local={id:task.id,state:'queued'};service.save(data);service.store.record(parent.id,actor,'queue_local_talking_video');return data;
}
export async function queueLocalReplacement(service,old,actor){
  const parent=service.store.get(old.parentId),replacement={...structuredClone(old),id:randomUUID(),identity:hash([old.id,'local_replacement',now()]),previousVideoId:old.id,generationVersion:(old.generationVersion||1)+1,created:now(),createdBy:actor,status:'prepared',stage:null,error:null,requests:{},files:{},reviews:[],reviewHistory:[],revisionRequest:null,delivery:null,outputRevision:1,technicalQA:null,workerTaskId:null};
  service.save(replacement);old.status='changes_requested';if(old.revisionRequest){old.revisionRequest.status='replacement_started';old.revisionRequest.replacementId=replacement.id;}service.save(old);await service.ensureLogo(replacement);return enqueueLocalRecord(service,replacement,parent,actor);
}

export async function applyLocalVideoTask(service,task){
  if(task.type!=='media_local'||task.appliedAt)return;const videoId=task.payload?.context?.videoId,j=service.get(videoId),parent=service.store.get(j.parentId);
  if(j.workerTaskId!==task.id||j.provider!=='local_worker')throw new Error('Local media task no longer matches this video.');
  await service.validate(j);const taskDir=service.tasks.artifactDir(task.id),dir=service.directory(j);
  for(const name of ['voice.wav','presenter.mp4','alignment.json']){const path=join(taskDir,name);if(!existsSync(path))throw new Error(`Local media worker did not upload ${name}.`);copyFileSync(path,join(dir,name));}
  const voiceProbe=await service.media.probe(join(dir,'voice.wav')),videoProbe=await service.media.probe(join(dir,'presenter.mp4')),duration=durationOf(voiceProbe);
  if(!videoProbe.streams.some(s=>s.codec_type==='video')||durationOf(videoProbe)<duration-.25||duration>180)throw new Error('Local talking-video output has invalid media or duration.');
  const alignment=JSON.parse(readFileSync(join(dir,'alignment.json'),'utf8'));j.duration=duration;j.cues=captions(alignment,j.script,j.question,duration);j.files={...j.files,voice:true,original:true};j.requests.local.state='completed';j.stage='compositing';j.status='compositing';service.save(j);
  j.technicalQA=await service.compose(service.media,dir,j);j.detectorVersion=detectorVersion;await service.validate(j);j.status='visual_review';j.stage='visual_review';j.files={...j.files,video:true,thumbnail:true,captions:true,manifest:true};service.save(j);service.manifest(j);service.tasks.markApplied(task.id);return j;
}
