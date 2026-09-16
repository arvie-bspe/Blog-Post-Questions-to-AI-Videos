import {hash,normalize} from './domain.mjs';
import {presenterGender} from './article-identity.mjs';
import {presenterPool} from './presenter-compatibility.mjs';
export {presenterPool};
export function choosePresenter(parent,index,history=[],reserved=[],pool=presenterPool){
 const gender=presenterGender(parent.doc,parent.plan?.presenterContext);
 const eligible=pool.avatars.filter(a=>(!gender||a.gender===gender)&&a.gender&&pool.voices.some(v=>v.gender===a.gender));
 if(!eligible.length)throw new Error('No approved generic presenter matches the explicit lawyer-blurb information.');
 const family=a=>a.personKey||a.id;
 const recent=history.filter(j=>normalize(j.client?.key)===normalize(parent.client.key)&&j.requests?.video?.id);
 const lastUsed=a=>Math.max(0,...recent.filter(j=>family(j.avatar)===family(a)||j.avatar.id===a.id).map(j=>Date.parse(j.created)||0));
 const use=a=>reserved.filter(r=>family(r.avatar)===family(a)).length;
 eligible.sort((a,b)=>use(a)-use(b)||lastUsed(a)-lastUsed(b)||hash([parent.id,index,a.id]).localeCompare(hash([parent.id,index,b.id])));
 const avatar=eligible[0];
 // Vary within a compatible gender pool, without a permanent avatar/voice assignment.
 const voices=pool.voices.filter(v=>v.gender===avatar.gender);
 const voice=voices[parseInt(hash([parent.id,index,'voice']).slice(0,8),16)%voices.length];
 if(!voice)throw new Error('An approved voice pool is required.');
 return {avatar:{...avatar},voice:{...voice},selection:{method:'automatic_curated_pool',poolVersion:pool.version,genderRequirement:gender||'unspecified',lawyerBlurbParagraphIds:parent.plan?.presenterContext?.lawyerBlurbParagraphIds||[],variation:eligible.length===1?'Only one eligible presenter; reuse permitted.':'Unused in batch, then least recently used for this client.'}};
}
