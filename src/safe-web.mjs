import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';
export function publicIP(ip){
  if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&[0,168].includes(b))||(a===100&&b>=64&&b<=127)||(a===198&&[18,19,51].includes(b))||(a===203&&b===0));}
  // IPv6 is limited to global unicast and excludes documentation/mapped forms.
  return isIP(ip)===6&&/^[23]/i.test(ip)&&!/^2001:(?:db8|0:|10:|20:)/i.test(ip);
}
export function webURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||isIP(u.hostname.replace(/[\[\]]/g,'')))throw new Error('Use a public HTTPS firm website.');u.hash='';return u;}
export async function webBytes(value,limit=4*1024*1024,redirects=0){
  const u=webURL(value),addresses=await lookup(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicIP(a.address)))throw new Error('The website resolves to a private or unsupported address.');
  const result=await new Promise((resolve,reject)=>{
    const chosen=addresses.find(a=>a.family===4)||addresses[0];
    const req=request(u,{headers:{'User-Agent':'ArticleVideoStudio/1.2 (firm logo retrieval)','Accept':'text/html,image/*'},lookup:(host,options,cb)=>options?.all?cb(null,[chosen]):cb(null,chosen.address,chosen.family)},res=>{
      const chunks=[];let size=0;res.on('data',c=>{size+=c.length;if(size>limit){res.destroy();reject(new Error('The logo or homepage exceeds the download allowance.'));}else chunks.push(c);});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks),url:u.href}));
    });req.setTimeout(25000,()=>req.destroy(new Error('Website retrieval timed out.')));req.on('error',reject);req.end();
  });
  if([301,302,303,307,308].includes(result.status)){if(redirects>=3||!result.headers.location)throw new Error('Too many website redirects.');return webBytes(new URL(result.headers.location,u).href,limit,redirects+1);}
  if(result.status!==200)throw new Error(`The firm website returned HTTP ${result.status}.`);return result;
}
