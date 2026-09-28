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
// Apply the current curated wardrobe/persona policy only to NEW paid renders.
// Historical footage keeps its original review and is never silently repurchased.
export function professionalPresenter(avatar,voice,pool=presenterPool){
 const pair=matchingPresenter(avatar,voice),approved=pool.avatars.find(a=>a.id===avatar?.id),approvedVoice=pool.voices.find(v=>v.id===voice?.id),review=approved?.professionalReview;
 if(approved?.type!=='studio_avatar'||review?.approved!==true||review.attire!=='suit_or_blazer')throw new Error('PRESENTER_ATTIRE_UNAPPROVED: choose a visually reviewed professional presenter wearing a suit or blazer. Casual shirts, T-shirts and polos are excluded.');
 if(!approvedVoice?.persona||approvedVoice.persona.profile!==review.personaProfile||!review.allowedVoiceIds?.includes(voice.id))throw new Error('PRESENTER_PERSONA_MISMATCH: choose a reviewed voice pairing that fits this presenter’s professional persona, age presentation and delivery style.');
 return {...pair,avatar:{...pair.avatar,personKey:approved.personKey},personaFit:{poolVersion:pool.version,reviewedAt:review.reviewedAt,attire:review.attire,description:review.description,profile:review.personaProfile,voiceStyle:approvedVoice.persona.style,visualReviewRequired:true}};
}
export function presenterIssue(avatar,voice){try{matchingPresenter(avatar,voice);return null;}catch(e){return e.message;}}
