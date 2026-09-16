import {readFileSync} from 'node:fs';
export const presenterPool=JSON.parse(readFileSync(new URL('../assets/presenters/pool.json',import.meta.url),'utf8'));
const gender=value=>typeof value==='string'?value.trim().toLowerCase():'';
// Use provider metadata or the verified catalog by ID, never a name or image guess.
function verified(item,kind){
 const known=presenterPool[kind].find(x=>x.id===item?.id),value=gender(known?.gender||item?.gender);
 return ['male','female','non_binary'].includes(value)?value:null;
}
export function matchingPresenter(avatar,voice){
 const avatarGender=verified(avatar,'avatars'),voiceGender=verified(voice,'voices');
 if(!avatarGender||!voiceGender)throw new Error('PRESENTER_GENDER_UNVERIFIED: choose an avatar and voice with verified provider gender metadata before generation.');
 if(avatarGender!==voiceGender)throw new Error('PRESENTER_VOICE_GENDER_MISMATCH: the avatar and voice must have the same gender. This saved clip needs a compatible replacement; no new render was purchased.');
 return {avatar:{...avatar,gender:avatarGender},voice:{...voice,gender:voiceGender}};
}
export function presenterIssue(avatar,voice){try{matchingPresenter(avatar,voice);return null;}catch(e){return e.message;}}
