import {hash} from './domain.mjs';
import {presenterGender} from './article-identity.mjs';
import {presenterPool} from './presenter-compatibility.mjs';
export {presenterPool};

const time=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0;};
const paidRequest=job=>{
 const request=job?.requests?.video;
 if(!request?.id&&!request?.submittedAt)return null;
 return {key:request.id||request.idempotencyKey||job.id,at:time(request.submittedAt||job.created||job.updated),job};
};
const family=(avatar,pool=presenterPool)=>pool.avatars.find(item=>item.id===avatar?.id)?.personKey||avatar?.personKey||avatar?.id||'';
const voiceId=selection=>selection?.voice?.id||'';

// A free Railway layout rebuild keeps the provider request ID. Count that
// request once so a no-charge rebuild does not look like a new presenter use.
export function paidPresenterHistory(history=[],pool=presenterPool){
 const requests=new Map();
 for(const job of history){
  const item=paidRequest(job);if(!item?.key)continue;
  const saved=requests.get(item.key);if(!saved||item.at<saved.at)requests.set(item.key,item);
 }
 return [...requests.values()].sort((a,b)=>b.at-a.at).map(item=>item.job);
}

function candidatesFor(parent,history,reserved,pool){
 const gender=presenterGender(parent.doc,parent.plan?.presenterContext);
 const avatars=pool.avatars.filter(avatar=>avatar.type==='studio_avatar'&&(!gender||avatar.gender===gender)&&avatar.gender&&pool.voices.some(voice=>voice.type!=='local_tts'&&voice.gender===avatar.gender));
 if(!avatars.length)throw new Error('No approved generic presenter matches the explicit lawyer-blurb information.');
 const paid=paidPresenterHistory(history,pool),latest=paid[0]||null;
 const reservedAvatars=new Set(reserved.map(item=>family(item?.avatar,pool)).filter(Boolean));
 const reservedVoices=new Set(reserved.map(voiceId).filter(Boolean));
 return {gender,avatars,paid,latest,reservedAvatars,reservedVoices};
}

const lastAvatarUse=(avatar,paid,pool)=>Math.max(0,...paid.filter(job=>family(job.avatar,pool)===family(avatar,pool)).map(job=>time(job.requests?.video?.submittedAt||job.created||job.updated)));
const lastVoiceUse=(voice,paid)=>Math.max(0,...paid.filter(job=>job.voice?.id===voice.id).map(job=>time(job.requests?.video?.submittedAt||job.created||job.updated)));
const rank=(items,lastUsed,seed)=>[...items].sort((a,b)=>lastUsed(a)-lastUsed(b)||hash([...seed,a.id]).localeCompare(hash([...seed,b.id])));
const rotationError=kind=>new Error(`PRESENTER_ROTATION_UNAVAILABLE: a new paid render must use a different ${kind} from the latest paid render and from other pending renders. Add another compatible approved ${kind} before submitting.`);

export function assertFreshPresenterPair(pair,history=[],reserved=[],pool=presenterPool){
 const paid=paidPresenterHistory(history,pool),latest=paid[0]||null,avatarFamily=family(pair?.avatar,pool),selectedVoice=pair?.voice?.id;
 if(!avatarFamily||!selectedVoice)throw new Error('An approved avatar and voice are required.');
 if(latest&&family(latest.avatar,pool)===avatarFamily)throw rotationError('avatar');
 if(latest?.voice?.id===selectedVoice)throw rotationError('voice');
 if(reserved.some(item=>family(item?.avatar,pool)===avatarFamily))throw rotationError('avatar');
 if(reserved.some(item=>item?.voice?.id===selectedVoice))throw rotationError('voice');
 return pair;
}

export function choosePresenter(parent,index,history=[],reserved=[],pool=presenterPool){
 const {gender,avatars,paid,latest,reservedAvatars,reservedVoices}=candidatesFor(parent,history,reserved,pool);
 const availableAvatars=avatars.filter(avatar=>family(avatar,pool)!==family(latest?.avatar,pool)&&!reservedAvatars.has(family(avatar,pool)));
 if(!availableAvatars.length&&(latest||reservedAvatars.size))throw rotationError('avatar');
 const avatar=rank(availableAvatars.length?availableAvatars:avatars,item=>lastAvatarUse(item,paid,pool),[parent.id,index,'avatar'])[0];
 const voices=pool.voices.filter(voice=>voice.type!=='local_tts'&&voice.gender===avatar.gender);
 const availableVoices=voices.filter(voice=>voice.id!==latest?.voice?.id&&!reservedVoices.has(voice.id));
 if(!availableVoices.length&&(latest?.voice?.id||reservedVoices.size))throw rotationError('voice');
 const voice=rank(availableVoices.length?availableVoices:voices,item=>lastVoiceUse(item,paid),[parent.id,index,'voice'])[0];
 if(!voice)throw new Error('An approved voice pool is required.');
 const chosen={avatar:{...avatar},voice:{...voice},selection:{method:'automatic_curated_pool',poolVersion:pool.version,genderRequirement:gender||'unspecified',lawyerBlurbParagraphIds:parent.plan?.presenterContext?.lawyerBlurbParagraphIds||[],variation:'Different avatar and voice from the latest paid render; unused pending choices first, then least recently used globally.'}};
 assertFreshPresenterPair(chosen,history,reserved,pool);return chosen;
}
