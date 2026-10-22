import {createReadStream,statSync} from 'node:fs';
import {join} from 'node:path';
import {googleToken} from './integrations.mjs';
import {hash,googleId} from './domain.mjs';
const base='https://www.googleapis.com/drive/v3/files';
const uploadBase='https://www.googleapis.com/upload/drive/v3/files';
const fields='id,name,mimeType,parents,webViewLink,trashed,appProperties,size';
const mismatch=(file,{folder,key,size})=>{
  if(file.trashed)return {code:'trashed',message:'The saved Drive file is in the trash.'};
  if(!file.parents?.includes(folder))return {code:'folder',message:'The saved Drive file was moved outside the selected Visual folder.'};
  if(file.appProperties?.studioDelivery!==key)return {code:'identity',message:'The saved Drive file belongs to a different video output.'};
  if(Number(file.size)!==size)return {code:'size',message:'The saved Drive file is incomplete.'};
  return null;
};
export class DriveDelivery{
  constructor({fetcher=fetch,token=()=>googleToken(true)}={}){this.fetcher=fetcher;this.token=token;}
  async call(url,options={}){const response=await this.fetcher(url,{...options,headers:{...options.headers,Authorization:`Bearer ${await this.token()}`},redirect:'error',signal:AbortSignal.timeout(180000)});return response;}
  async json(url,options){const r=await this.call(url,options);if(!r.ok)throw new Error(`Google Drive returned HTTP ${r.status}. Check authorization and folder access.`);return r.json();}
  async deliver(job,dir,save,assertCurrent){
    if(job.status!=='delivery_pending'||job.reviews.at(-1)?.decision!=='approve')throw new Error('A reviewer must approve this exact video revision before Drive delivery.');
    const folder=googleId(job.source.folderUrl,'folder');if(!folder)throw new Error('The selected row has no valid Visual folder.');
    const metadata=await this.json(`${base}/${folder}?supportsAllDrives=true&fields=id,mimeType,trashed,capabilities(canAddChildren)`);
    if(metadata.id!==folder||metadata.trashed||metadata.mimeType!=='application/vnd.google-apps.folder'||!metadata.capabilities?.canAddChildren)throw new Error('The Visual folder is missing or is not writable by the connected Google account.');
    job.delivery={...(job.delivery||{}),folderId:folder,revision:job.outputRevision||1,files:job.delivery?.files||{}};save(job);
    for(const [name,type]of [['final.mp4','video/mp4'],['thumbnail.png','image/png'],['captions.vtt','text/vtt']]){
      const key=hash([job.id,job.outputRevision||1,name]),path=join(dir,name),size=statSync(path).size;
      let record=job.delivery.files[name];
      if(!record){const ids=await this.json(`${base}/generateIds?count=1&space=drive&type=files`);record={id:ids.ids?.[0],key,state:'reserved'};if(!/^[\w-]+$/.test(record.id))throw new Error('Google returned an invalid upload ID.');job.delivery.files[name]=record;save(job);}
      if(record.key!==key)throw new Error(`The saved Drive reservation for ${name} belongs to an earlier output revision. Inspect it before retrying.`);
      const existing=await this.call(`${base}/${record.id}?supportsAllDrives=true&fields=${fields}`);
      if(existing.ok){
        const f=await existing.json(),problem=mismatch(f,{folder,key,size});
        if(!problem){record.state='complete';record.url=f.webViewLink||null;record.error=null;save(job);continue;}
        if(problem.code!=='size')throw new Error(`${problem.message} Inspect it before retrying.`);
        await assertCurrent();
        const repaired=await this.upload({record,key,path,size,type,folder,name,job,save,assertCurrent,replace:true});
        const repairProblem=mismatch(repaired,{folder,key,size});
        if(repaired.id!==record.id||repairProblem)throw new Error(`${repairProblem?.message||'Google returned a different file after repairing the upload.'} Inspect it before retrying.`);
        record.state='complete';record.url=repaired.webViewLink||null;record.error=null;record.repairedAt=new Date().toISOString();save(job);continue;
      }
      if(existing.status!==404)throw new Error(`Cannot check the saved Drive upload (HTTP ${existing.status}).`);
      await assertCurrent();
      const result=await this.upload({record,key,path,size,type,folder,name,job,save,assertCurrent,replace:false});if(result.id!==record.id||mismatch(result,{folder,key,size}))throw new Error('Uploaded file verification failed.');
      record.state='complete';record.url=result.webViewLink||null;save(job);
    }
    await assertCurrent();job.delivery.completedAt=new Date().toISOString();job.status='delivered';save(job);
  }
  async upload({record,key,path,size,type,folder,name,job,save,assertCurrent,replace}){
    const url=replace?`${uploadBase}/${record.id}?uploadType=resumable&supportsAllDrives=true&fields=${fields}`:`${uploadBase}?uploadType=resumable&supportsAllDrives=true&fields=${fields}`;
    const body=replace?{mimeType:type,appProperties:{studioDelivery:key}}:{id:record.id,name:`${job.thumbnailTitle.replace(/[\\/:*?"<>|]/g,'').slice(0,60)}-${job.id.slice(0,8)}-v${job.outputRevision||1}-${name}`,parents:[folder],mimeType:type,appProperties:{studioDelivery:key}};
    const init=await this.call(url,{method:replace?'PATCH':'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':type,'X-Upload-Content-Length':String(size)},body:JSON.stringify(body)});
    if(!init.ok)throw new Error(`Google could not ${replace?'repair':'start'} the upload (HTTP ${init.status}).`);
    const location=new URL(init.headers.get('location')||'');if(location.protocol!=='https:'||location.hostname!=='www.googleapis.com'||location.username||location.password)throw new Error('Google returned an invalid upload destination.');
    record.state=replace?'repairing':'uploading';record.error=null;save(job);
    await assertCurrent();
    const uploaded=await this.call(location.href,{method:'PUT',headers:{'Content-Type':type,'Content-Length':String(size)},body:createReadStream(path),duplex:'half'});
    if(!uploaded.ok)throw new Error(`Google upload interrupted (HTTP ${uploaded.status}). Retry delivery to reconcile the reserved file ID.`);
    return uploaded.json();
  }
}
