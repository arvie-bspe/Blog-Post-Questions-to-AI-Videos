import {createWriteStream,renameSync,rmSync,statSync} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export function queueURL(value,id){
  const u=new URL(value);
  if(u.protocol!=='https:'||u.hostname!=='queue.fal.run'||u.port||u.username||u.password||!id||!u.pathname.includes('/requests/'+id))throw new Error('Provider returned an unexpected queue URL.');
  return u.href;
}
export function mediaURL(value){
  const u=new URL(value);
  if(u.protocol!=='https:'||!(u.hostname==='fal.media'||u.hostname.endsWith('.fal.media'))||u.port||u.username||u.password)throw new Error('Provider returned an unexpected media URL.');
  return u.href;
}
export class Fal {
  constructor(key,fetcher=fetch){this.key=key;this.fetcher=fetcher;}
  async call(url,body){
    const response=await this.fetcher(url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Key '+this.key(),...(body===undefined?{}:{'Content-Type':'application/json'})},redirect:'error',signal:AbortSignal.timeout(90000),...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw new Error(`fal.ai request returned HTTP ${response.status}. Check the request in your fal dashboard; no automatic resubmission was made.`);
    return response.json();
  }
  async submit(model,input){
    if(!/^[a-z0-9_-]+\/[a-z0-9_./-]+$/i.test(model)||model.includes('..'))throw new Error('Invalid model endpoint.');
    const data=await this.call('https://queue.fal.run/'+model,input),id=data.request_id;
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Provider did not return a usable request ID.');
    return {id,statusURL:queueURL(data.status_url,id),responseURL:queueURL(data.response_url,id),submittedAt:new Date().toISOString()};
  }
  status(request){return this.call(queueURL(request.statusURL,request.id));}
  result(request){return this.call(queueURL(request.responseURL,request.id));}
  async download(url,path,maxBytes){
    let current=mediaURL(url),response;
    for(let redirect=0;redirect<4;redirect++){
      response=await this.fetcher(current,{redirect:'manual',signal:AbortSignal.timeout(300000)});
      if(response.status>=300&&response.status<400){current=mediaURL(new URL(response.headers.get('location'),current).href);continue;}break;
    }
    if(!response?.ok||!response.body)throw new Error('Could not download the generated media.');
    if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('Generated media exceeds the download limit.');
    let count=0;const limit=new Transform({transform(chunk,encoding,cb){count+=chunk.length;cb(count>maxBytes?new Error('Generated media exceeds the download limit.'):null,chunk);}}),partial=path+'.part';
    try{await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(partial));if(!statSync(partial).size)throw new Error('Generated media is empty.');renameSync(partial,path);}catch(e){rmSync(partial,{force:true});throw e;}
  }
}
