// Identity is supplied with article evidence, never filled from a directory contact record.
const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function resolveArticleIdentity(doc,input){
 const fields=['name','address','phone'],value={sourceHash:doc.sourceHash,evidence:[],issues:[]};
 for(const field of fields){
  const text=clean(input?.[field]);
  const refs=(input?.evidence||[]).filter(e=>e.field===field&&typeof e.quote==='string'&&doc.paragraphs.some(p=>p.id===e.paragraphId&&p.style==='NORMAL_TEXT'&&clean(p.text).includes(clean(e.quote)))&&clean(e.quote).includes(text));
  value[field]=text&&refs.length?text:'';value.evidence.push(...refs);
  if(!value[field])value.issues.push(`Source article ${field} needs an exact supporting quote.`);
 }
 return value;
}
export function requireArticleIdentity(doc,input){
 const value=resolveArticleIdentity(doc,input);
 if(value.issues.length)throw new Error('MISSING_REQUIRED_END_CARD_DATA: '+value.issues.join(' '));
 return value;
}
// Only explicitly identified lawyer-blurb paragraphs participate. Never use names or photos to infer gender.
export function presenterGender(doc,context){
 const ids=context?.lawyerBlurbParagraphIds||[];
 const text=doc.paragraphs.filter(p=>ids.includes(p.id)&&p.style==='NORMAL_TEXT').map(p=>p.text).join(' ');
 const male=/\b(he|his|him|male)\b/i.test(text),female=/\b(she|hers|her|female)\b/i.test(text);
 if(context?.gender==='male'&&male&&!female)return 'male';
 if(context?.gender==='female'&&female&&!male)return 'female';
 return null;
}
export function permittedPresenterGender(doc,context,requested){
 const choice=clean(requested).toLowerCase();
 if(!['male','female'].includes(choice))throw new Error('Choose a male or female presenter from the approved generic pool.');
 const required=presenterGender(doc,context);
 if(required&&choice!==required)throw new Error(`PRESENTER_SOURCE_GENDER_MISMATCH: the explicit lawyer blurb requires an approved ${required} presenter and matching ${required} voice.`);
 return choice;
}
