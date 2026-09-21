import {config} from './rules.mjs';
import {hash} from './domain.mjs';
import {approved,scriptText} from './video-domain.mjs';
import {endCardData,layoutVersion} from './visual-checks.mjs';
import {requireArticleIdentity} from './article-identity.mjs';
import {matchingPresenter} from './presenter-compatibility.mjs';
import {scriptTargetSeconds} from './workflow-config.mjs';

export const prices={checked:'2026-09-15',currency:'USD',engine:'avatar_iv',photoPerMinute:3,studioPerMinute:4,source:'https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained'};
// Preserve the source scene before Railway centers the presenter in a portrait crop.
// Provider-side 9:16 cover can irreversibly remove an off-center presenter's face.
export const sourceFraming={version:'preserve-source-1',aspectRatio:'auto',fit:'contain'};
export const estimate=(type,seconds=30)=>Number(((type==='photo_avatar'?prices.photoPerMinute:prices.studioPerMinute)*seconds/60).toFixed(2));
export function prepare(job,body,avatar,voice){
  if(job.setupIssues?.length)throw new Error('This saved draft is for script review only. Add its Visual folder in column L, then inspect the live row again before video generation.');
  const index=body.index,approvalHash=approved(job,index),video=job.plan.videos[index];
  if(!Number.isInteger(index)||!video)throw new Error('Choose an approved question.');
  if(!avatar||avatar.type!=='studio_avatar')throw new Error('Choose a speaking Studio Avatar from the HeyGen public library. Photo Avatars are disabled.');
  if(!voice)throw new Error('Choose a voice from the HeyGen English library.');
  ({avatar,voice}=matchingPresenter(avatar,voice));
  if(body.presenterAccepted!==true)throw new Error('Confirm the selected HeyGen presenter and voice.');
  const title=String(body.thumbnailTitle||'').trim();
  if(title.length>80||title.split(/\s+/).length<3||title.split(/\s+/).length>6||/[{}\\\r\n<>]/.test(title))throw new Error('Use a thumbnail topic of 3 to 6 words without special markup.');
  const text=scriptText(video),wordCount=text.trim().split(/\s+/).length,targetSeconds=scriptTargetSeconds(job);
  const articleIdentity=requireArticleIdentity(job.doc,job.plan.articleIdentity);
  const endCard={...endCardData({articleIdentity,script:text,source:{targetUrl:job.row.pageUrl}}),seconds:3};
  if(wordCount>75&&(!video.runtimeReason||video.runtimeReason.trim().length<20))throw new Error('Explain why the longer script is necessary for accuracy, then have a script reviewer check it.');
  if(text.length>7000)throw new Error('This script exceeds the supported video request size.');
  if([text,articleIdentity.name,articleIdentity.address,articleIdentity.phone].some(t=>typeof t!=='string'||!t.trim()||/[{}\\<>\x00-\x08]/.test(t)))throw new Error('Script or contact details are missing or contain unsupported markup.');
  const avatarSnapshot={id:avatar.id,name:avatar.name,type:avatar.type,personKey:avatar.personKey,gender:avatar.gender},voiceSnapshot={id:voice.id,name:voice.name,language:voice.language,gender:voice.gender};
  return {provider:'heygen',sourceFraming,layoutVersion,endCard,articleIdentity,parentId:job.id,index,approvalHash,script:text,scriptHash:hash(text),question:video.question,thumbnailTitle:title,avatar:avatarSnapshot,voice:voiceSnapshot,
    client:job.client,source:{documentUrl:job.row.documentUrl,sourceHash:job.doc.sourceHash,mode:job.mode,rulesHash:job.rulesHash,folderUrl:job.row.folderUrl},
    models:{video:'heygen/avatar_iv'},format:{width:1080,height:1920,aspectRatio:'9:16'},logoRequired:true,outputRevision:1,prices,targetSeconds,wordCount,runtimeReason:video.runtimeReason||'',estimatedSeconds:Math.max(targetSeconds,Math.ceil(wordCount/2.2)),renderEstimate:estimate(avatar.type,Math.max(targetSeconds,Math.ceil(wordCount/2.2))),
    identity:hash(['heygen/avatar_iv',job.id,index,approvalHash,avatarSnapshot,voiceSnapshot,title,targetSeconds,'9:16',config.version,sourceFraming.version]),status:'prepared',requests:{},files:{},reviews:[]};
}
export const requestBody=j=>({type:'avatar',avatar_id:j.avatar.id,voice_id:j.voice.id,script:j.script,
  title:j.thumbnailTitle+' · '+j.id,resolution:'1080p',aspect_ratio:sourceFraming.aspectRatio,fit:sourceFraming.fit,remove_background:false,
  engine:{type:'avatar_iv'},caption:{file_format:'srt'},output_format:'mp4',voice_settings:{speed:1,pitch:0,volume:1}});

export function captionCase(cues,script){
 const expected=script.trim().split(/\s+/);let offset=0;
 const result=cues.map(c=>{
   const actual=c.text.trim().split(/\s+/),next=expected.slice(offset,offset+actual.length);offset+=actual.length;
   if(actual.join(' ').toLowerCase()!==next.join(' ').toLowerCase())throw new Error('Saved caption words do not match the approved script. Rebuild held; no timing or speech was invented.');
   return {...c,text:next.join(' ')};
 });
 if(offset!==expected.length)throw new Error('Saved captions do not cover the complete approved script.');
 return result;
}

const words=text=>text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
const time=value=>{const m=/^(\d{2}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(value);if(!m)throw new Error('HeyGen subtitles contain invalid timestamps.');return Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;};
export function subtitles(text,script,question,duration){
  if(!Number.isFinite(duration)||duration<=0)throw new Error('The video has no measured duration.');
  const blocks=String(text).replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/),cues=[];
  for(const block of blocks){
    const lines=block.split('\n');if(/^\d+$/.test(lines[0]))lines.shift();
    const match=/^(\S+) --> (\S+)\s*$/.exec(lines.shift()||'');
    if(!match)throw new Error('HeyGen did not return valid SRT caption timing.');
    const start=time(match[1]),end=time(match[2]),content=lines.join(' ').trim();
    if(!content||/[{}\\<>\x00-\x08]/.test(content)||start<(cues.at(-1)?.end||0)-0.02||end<=start||end>duration+0.15||content.length>168)
      throw new Error('HeyGen captions have unsupported text, overlap, or unreadable timing. Review the original video.');
    cues.push({start,end,text:content});
  }
  const expected=words(script),actual=words(cues.map(c=>c.text).join(' '));
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('HeyGen captions do not match every word of the approved script. Review the original video; no automatic paid retry was made.');
  let offset=0;const questionWords=words(question).length;
  for(const cue of cues){cue.question=offset<questionWords;offset+=words(cue.text).length;}
  return cues;
}
