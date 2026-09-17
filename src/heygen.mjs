import {createWriteStream,renameSync,rmSync,statSync} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export function mediaURL(value){
  let u;try{u=new URL(value);}catch{throw new Error('HeyGen returned an invalid media URL.');}
  if(u.protocol!=='https:'||u.port||u.username||u.password||
    !['heygen.ai','heygen.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))
    throw new Error('HeyGen returned an unexpected media host. Ask an administrator to check the saved provider request.');
  return u.href;
}
export function providerId(value){
  if(typeof value!=='string'||!/^[-A-Za-z0-9_]{1,200}$/.test(value))throw new Error('Invalid HeyGen resource ID.');
  return value;
}
export class HeyGen {
  constructor(key,fetcher=fetch){this.key=key;this.fetcher=fetcher;}
  async call(path,body,idempotencyKey){
    if(!this.key())throw new Error('Add HEYGEN_API_KEY privately in Railway Variables first.');
    const response=await this.fetcher('https://api.heygen.com/v3/'+path,{
      method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(90000),
      headers:{'x-api-key':this.key(),...(body===undefined?{}:{'Content-Type':'application/json'}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    if(!response.ok)throw Object.assign(new Error(`HeyGen returned HTTP ${response.status}. ${response.status===401?'Check the API key in Railway Variables.':response.status===402?'Check your HeyGen API credit balance.':'Check the request in your HeyGen dashboard.'} No paid request is automatically repeated.`),{providerStatus:response.status});
    const data=await response.json();if(data.error)throw new Error('HeyGen returned an API error. Check the saved request in its dashboard.');return data;
  }
  looks(type,token){return this.call('avatars/looks?'+new URLSearchParams({avatar_type:type,ownership:'public',limit:'50',...(token?{token}:{})}));}
  look(id){return this.call('avatars/looks/'+encodeURIComponent(providerId(id))).then(r=>r.data);}
  voices(token){return this.call('voices?'+new URLSearchParams({type:'public',language:'English',limit:'100',...(token?{token}:{})}));}
  async submit(input,key){const data=(await this.call('videos',input,key)).data;return {id:providerId(data?.video_id),state:data.status||'waiting'};}
  status(id){return this.call('videos/'+encodeURIComponent(providerId(id))).then(r=>r.data);}
  async response(url,maxBytes){
    let current=mediaURL(url),response;
    for(let n=0;n<4;n++){
      // API credentials must never accompany asset downloads, including redirects.
      response=await this.fetcher(current,{redirect:'manual',signal:AbortSignal.timeout(300000)});
      if(response.status>=300&&response.status<400){await response.body?.cancel();current=mediaURL(new URL(response.headers.get('location'),current).href);continue;}break;
    }
    if(!response?.ok||!response.body)throw new Error('Could not download HeyGen media. Resume to refresh its delivery URL.');
    if(Number(response.headers.get('content-length'))>maxBytes){await response.body.cancel();throw new Error('HeyGen media exceeds the download limit.');}
    return response;
  }
  async bytes(url,maxBytes){
    const response=await this.response(url,maxBytes),reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('HeyGen media exceeds the download limit.');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
    if(!size)throw new Error('HeyGen returned an empty media file.');
    return {body:Buffer.concat(chunks),type:(response.headers.get('content-type')||'').split(';')[0]};
  }
  async download(url,path,maxBytes){
    const response=await this.response(url,maxBytes);let size=0;
    const limit=new Transform({transform(chunk,encoding,cb){size+=chunk.length;cb(size>maxBytes?new Error('HeyGen media exceeds the download limit.'):null,chunk);}}),partial=path+'.part';
    try{await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(partial));if(!statSync(partial).size)throw new Error('HeyGen returned an empty media file.');renameSync(partial,path);}catch(e){rmSync(partial,{force:true});throw e;}
  }
}
