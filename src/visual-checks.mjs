import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const layoutVersion='two-state-2026-09-21-logo-contrast';
export const detectorVersion='yunet-2023mar-1';
const contrastRatio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
export function logoContrastBackground(screening){
 const foregroundLuminance=Number(screening?.relativeLuminance);
 if(!Number.isFinite(foregroundLuminance)||foregroundLuminance<0||foregroundLuminance>1)throw new Error('MISSING_LOGO_CONTRAST_DATA: reacquire the firm logo before assembly.');
 const whiteContrast=contrastRatio(foregroundLuminance,1),darkContrast=contrastRatio(foregroundLuminance,.005605);
 const light=whiteContrast>=darkContrast;
 return {color:light?'#FFFFFF':'#111111',tone:light?'light':'dark',foregroundLuminance:Number(foregroundLuminance.toFixed(4)),contrastRatio:Number(Math.max(whiteContrast,darkContrast).toFixed(2))};
}
export function analyzeVisual(action,path){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.VISUAL_PYTHON_PATH||'/opt/visual/bin/python',[fileURLToPath(new URL('./visual-analysis.py',import.meta.url)),action,path],{windowsHide:true,shell:false});let out='',err='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('Local visual analysis timed out. The source is held for review.'));},600000);timer.unref();
  child.stdout.on('data',d=>out=(out+d).slice(-1000000));child.stderr.on('data',d=>err=(err+d).slice(-2000));
  child.once('error',()=>{clearTimeout(timer);reject(new Error('Local visual analysis is unavailable. Check the video runtime before rendering.'));});
  child.once('close',code=>{clearTimeout(timer);let result;try{result=JSON.parse(out.trim());}catch{return reject(new Error('Local visual analysis did not return a usable result.'));}if(code||result.error)return reject(new Error(result.error||'Local visual analysis failed.'));resolve(result);});
 });
}
const normalized=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export function containsContact(text,contact={}){
 const value=normalized(text),compact=value.replace(/[^a-z0-9]/g,'');
 if(/(?:https?:\/\/|www\.|\b[\w.-]+\.(?:com|net|org|law|legal|io)\b|[\w.+-]+@[\w.-]+|(?:\+?\d[\s().-]*){7,}|\b\d{1,6}\s+\w+(?:\s+\w+){0,4}\s+(?:street|st|road|rd|avenue|ave|drive|dr|boulevard|blvd|suite)\b)/i.test(value))return true;
 return [contact.address,contact.phone,contact.targetUrl].filter(Boolean).some(v=>{const target=normalized(v).replace(/[^a-z0-9]/g,'');return target.length>=7&&compact.includes(target);});
}
export function endCardData(job){
 const identity=job.articleIdentity;
 const data={name:identity?.name,address:identity?.address,phone:identity?.phone,targetUrl:job.endCard?.targetUrl||job.source?.targetUrl};
 for(const [key,value]of Object.entries(data))if(typeof value!=='string'||!value.trim()||/[{}\\<>\x00-\x1f]/.test(value))throw new Error('MISSING_END_CARD_DATA: '+key+' must come from the approved structured input.');
 let url;try{url=new URL(data.targetUrl);}catch{throw new Error('MISSING_END_CARD_DATA: the monthly row needs a valid article page URL in E.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('MISSING_END_CARD_DATA: invalid article page URL.');
 if(containsContact(job.script,data))throw new Error('SCRIPT_NAP_CONFLICT: the approved speech contains contact information or a URL. Return to content review; the renderer will not rewrite it.');
 return data;
}
