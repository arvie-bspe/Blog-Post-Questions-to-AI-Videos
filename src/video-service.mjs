import {LogoService} from './logos.mjs';
import {DriveDelivery} from './drive-delivery.mjs';
import {VideoRevisions} from './video-revisions.mjs';
import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync,existsSync,statSync,createReadStream,readFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {approved} from './video-domain.mjs';
import {ApprovalVideoAutomation} from './video-automation.mjs';
import {prepare,prices,estimate,requestBody,subtitles,sourceFraming} from './heygen-domain.mjs';
import {HeyGen,providerId} from './heygen.mjs';
import {mediaTools,durationOf,compose} from './media.mjs';
import {layoutVersion,detectorVersion} from './visual-checks.mjs';
import {matchingPresenter,presenterIssue} from './presenter-compatibility.mjs';
import {applyLocalVideoTask} from './local-video.mjs';
import {videoProvider} from './workflow-config.mjs';
const error=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>new Date().toISOString();
export const publicJob=j=>{if(!j)return j;const {requests,identity,...rest}=j;return {...rest,presenterIssue:['heygen','local_worker'].includes(j.provider)?presenterIssue(j.avatar,j.voice):null,provider:j.provider||'fal.ai',legacy:!['heygen','local_worker'].includes(j.provider),requests:Object.fromEntries(Object.entries(requests||{}).map(([stage,r])=>[stage,{id:r.id||null,state:r.state,submittedAt:r.submittedAt||null}]))};};
const fileTypes={'logo.png':'image/png','voice.wav':'audio/wav','final.mp4':'video/mp4','presenter.mp4':'video/mp4','thumbnail.png':'image/png','captions.vtt':'text/vtt; charset=utf-8','manifest.json':'application/json; charset=utf-8'};
export class VideoService {
  constructor({store,env,dataDir,checkFresh,local,heygen,media,logos,delivery,onScriptChanges,tasks}){
    Object.assign(this,{store,env,dataDir,checkFresh,local,tasks});this.db=store.db;this.media=media||mediaTools(env);this.compose=compose;this.heygen=heygen||new HeyGen(()=>env.HEYGEN_API_KEY);this.active=new Set();this.closed=false;this.avatars=new Map();this.voices=new Map();this.pages=new Map();
    this.db.exec('CREATE TABLE IF NOT EXISTS videos(id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, parent TEXT NOT NULL, updated TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS video_spend(day TEXT, stage TEXT, count INTEGER, PRIMARY KEY(day,stage));');
    for(const j of this.list())if(j.provider==='heygen'&&['working','compositing'].includes(j.status)){
      j.status=Object.values(j.requests).some(r=>r.state==='submitting'&&!r.id)?'needs_reconciliation':'paused';
      j.error=j.status==='needs_reconciliation'?'The app stopped during submission. Check the saved title and request in HeyGen before creating any replacement.':'The app restarted. Resume to continue the saved request without another paid submission.';this.save(j);
    }
    this.mediaReady=false;this.ready=this.media.check().then(()=>{this.mediaReady=true;}).catch(()=>{});
    this.logos=logos||new LogoService(dataDir);this.delivery=delivery||new DriveDelivery();this.onScriptChanges=onScriptChanges;this.revisions=new VideoRevisions(this);
    this.automation=new ApprovalVideoAutomation(this);
    queueMicrotask(()=>{if(!this.closed)for(const j of this.list())if(j.status==='delivery_pending')this.deliver(j.id);});
  }
  list(parent){const rows=parent?this.db.prepare('SELECT payload FROM videos WHERE parent=? ORDER BY updated DESC').all(parent):this.db.prepare('SELECT payload FROM videos ORDER BY updated DESC').all();return rows.map(r=>JSON.parse(r.payload));}
  get(id){const r=this.db.prepare('SELECT payload FROM videos WHERE id=?').get(id);return r?JSON.parse(r.payload):error('Video record not found.',404);}
  save(j){j.updated=now();this.db.prepare('INSERT INTO videos VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,payload=excluded.payload').run(j.id,j.identity,j.parentId,j.updated,JSON.stringify(j));return j;}
  directory(j){const dir=join(this.dataDir,'videos',j.id);mkdirSync(dir,{recursive:true});return dir;}
  async catalog(){await this.ready;const provider=videoProvider(this.env),local=provider==='local_worker';return {backend:local?'Local worker · Kokoro + SadTalker':'HeyGen',provider,configured:local?Boolean(this.env.STUDIO_WORKER_TOKEN):Boolean(this.env.HEYGEN_API_KEY),ffmpeg:this.mediaReady,prices:local?{currency:'USD',providerCharge:0}:prices,targetSeconds:30,nativeResolution:local?'Worker generated':'1080p',outputResolution:'1080 × 1920',aspectRatio:'9:16',layoutVersion,detectorVersion,endCardSeconds:3,logoRequired:true,presenterMode:local?'Approved local presenter image':'HeyGen Studio Avatar',dailyLimit:local?null:Number(this.env.DAILY_VIDEO_LIMIT||2)};}
  async library(kind,type='studio_avatar',token=''){
    if(!['avatars','voices'].includes(kind)||type!=='studio_avatar'||typeof token!=='string'||token.length>2048)error('Use the Studio Avatar library; Photo Avatars are disabled.');
    if(!this.env.HEYGEN_API_KEY)error('Add HEYGEN_API_KEY privately in Railway Variables to load presenters and voices.');
    const key=JSON.stringify([kind,type,token]),cached=this.pages.get(key);if(cached&&cached.expires>Date.now())return cached.page;
    let result=kind==='avatars'?await this.heygen.looks(type,token):await this.heygen.voices(token);
    // Public pages can contain only older-engine looks. Skip them without changing the chosen engine.
    const seen=new Set([token]);
    for(let skipped=0;kind==='avatars'&&skipped<3;skipped++){
      if(!Array.isArray(result.data))error('HeyGen returned an unexpected library response.',502);
      if(result.data.some(entry=>entry.supported_api_engines?.includes('avatar_iv')&&(!entry.status||entry.status==='completed'))||!result.has_more||typeof result.next_token!=='string'||seen.has(result.next_token))break;
      seen.add(result.next_token);result=await this.heygen.looks(type,result.next_token);
    }
    if(!Array.isArray(result.data))error('HeyGen returned an unexpected library response.',502);
    const map=kind==='avatars'?this.avatars:this.voices,items=[];
    for(const entry of result.data){
      if(kind==='avatars'&&(!entry.supported_api_engines?.includes('avatar_iv')||(entry.status&&entry.status!=='completed')))continue;
      const id=providerId(kind==='avatars'?entry.id:entry.voice_id);
      const item=kind==='avatars'?{id,name:String(entry.name||id),type,gender:entry.gender||'',defaultVoiceId:entry.default_voice_id||null,previewURL:entry.preview_image_url}:{id,name:String(entry.name||id),language:String(entry.language||'English'),gender:entry.gender||'',previewURL:entry.preview_audio_url};
      if(map.size>=2000&&!map.has(id))error('Library limit reached. Restart the app before browsing more.',429);
      map.set(id,item);const {previewURL,...publicItem}=item;items.push({...publicItem,preview:previewURL?`/api/video-preview/${kind}/${id}`:null});
    }
    const nextToken=result.has_more&&typeof result.next_token==='string'?result.next_token:null,page={items,nextToken};
    if(this.pages.size>100)this.pages.clear();this.pages.set(key,{page,expires:Date.now()+300000});return page;
  }
  async validate(j){
    if(!j.provider)error('This is a saved fal.ai setup. Prepare a new video from the current approved script; the old record is kept for history.',409);
    if(!['heygen','local_worker'].includes(j.provider))error('This is a saved legacy setup. Prepare a new video from the current approved script; the old record is kept for history.',409);
    if(j.layoutVersion!==layoutVersion)error('This video uses the previous layout. Rebuild it with Macy’s updated layout before review or delivery.',409);
    matchingPresenter(j.avatar,j.voice);
    if(j.files?.video&&j.detectorVersion!==detectorVersion)error('Rebuild this saved footage with the current framing checks before Macy review or delivery. No new HeyGen render is needed.',409);
    const parent=this.store.get(j.parentId);if(approved(parent,j.index)!==j.approvalHash)error('The source or script review changed. Prepare from the current approved version.',409);
    await this.checkFresh(parent,j.index);if(approved(this.store.get(j.parentId),j.index)!==j.approvalHash)error('The content review changed during this request.',409);
  }
  async applyWorkerTask(task){return applyLocalVideoTask(this,task);}
  consume(){
    const limit=Number(this.env.DAILY_VIDEO_LIMIT||2);if(!Number.isInteger(limit)||limit<1||limit>20)error('DAILY_VIDEO_LIMIT must be an integer from 1 to 20.');
    const day=now().slice(0,10);this.db.prepare('INSERT INTO video_spend(day,stage,count) VALUES(?,?,1) ON CONFLICT(day,stage) DO UPDATE SET count=count+1 WHERE count<?').run(day,'heygen_render',limit);
    if(!this.db.prepare('SELECT changes() AS n').get().n)error('The daily HeyGen request limit has been reached.');
  }
  async create(parentId,body,actor){
    if(!['Arvie','Macy'].includes(actor))error('Arvie or Macy prepares videos.',403);
    const parent=this.store.get(parentId);approved(parent,body.index);await this.checkFresh(parent,body.index);
    const data=prepare(this.store.get(parentId),body,this.avatars.get(body.avatarId),this.voices.get(body.voiceId));
    const existing=this.db.prepare('SELECT payload FROM videos WHERE identity=?').get(data.identity);if(existing)return publicJob(JSON.parse(existing.payload));
    const j={...data,id:randomUUID(),created:now(),createdBy:actor,presenterAcceptedAt:now()};this.save(j);this.store.record(parentId,actor,'prepare_heygen_video');return publicJob(j);
  }
  async start(id,action,body,actor){
    if(!['Arvie','Macy'].includes(actor))error('Arvie or Macy manages video creation.',403);
    if(this.active.has(id))error('This video is already processing.',409);this.active.add(id);
    try{
      const j=this.get(id);await this.validate(j);
      if(action==='render'){
        if(j.status!=='prepared')error('Generation has already started for this setup.',409);
        if(body.acceptCost!==true||body.acceptedEstimate!==j.renderEstimate)error('Accept the displayed HeyGen estimate first.');
      }else if(action==='resume'){
        if(j.status!=='paused')error('This record cannot be resumed automatically. Check uncertain submissions in HeyGen.',409);
        if(j.error?.includes('SOURCE_FRAMING_INCOMPATIBLE'))error('The source footage failed framing checks. Resuming the same clip cannot restore missing edges. Prepare a new setup with the corrected source framing, then review the displayed cost before generating.',409);
      }else error('Use the HeyGen render action. Separate voice generation is no longer part of this workflow.');
      if(!this.env.HEYGEN_API_KEY)error('Add HEYGEN_API_KEY privately in Railway Variables.');
      await this.media.check();this.mediaReady=true;
      if(action==='render'){
        await this.ensureLogo(j);
        const look=await this.heygen.look(j.avatar.id);
        if(look?.id!==j.avatar.id||!look.supported_api_engines?.includes('avatar_iv')||(look.status&&look.status!=='completed'))error('The selected presenter is no longer available for Avatar IV. Choose another library presenter.',409);
        await this.validate(j);if(j.automation)this.automation.assertProfile(j.parentId,j.automation.profileId);this.consume();j.sourceFraming={...sourceFraming};j.stage='video';j.authorization={video:{actor,at:now(),estimate:j.renderEstimate,priceBasis:prices,seconds:j.estimatedSeconds}};
      }
      j.status='working';j.error=null;this.save(j);this.store.record(j.parentId,actor,'heygen_'+action);
      this.work(j).catch(e=>{
        if(this.closed)return;
        const uncertain=Object.values(j.requests).some(r=>r.state==='submitting'&&!r.id);
        j.status=uncertain?'needs_reconciliation':e.permanent?'needs_attention':'paused';j.error=String(e.message).replaceAll(this.env.HEYGEN_API_KEY||'__no_secret__','[redacted]').replace(/https?:\/\/\S+/g,'[provider URL]');this.save(j);
      }).finally(()=>this.active.delete(id));return publicJob(j);
    }catch(e){this.active.delete(id);throw e;}
  }
  async queued(j){
    let request=j.requests.video;
    if(request?.state==='submitting'&&!request.id)throw new Error('Submission outcome is unknown. Check HeyGen using this setup ID; do not resubmit.');
    if(!request){
      await this.validate(j);if(j.automation)this.automation.assertProfile(j.parentId,j.automation.profileId);j.requests.video={state:'submitting',submittedAt:now(),idempotencyKey:j.id};this.save(j);
      const result=await this.heygen.submit(requestBody(j),j.id);j.requests.video={...j.requests.video,...result};this.save(j);
    }
    request=j.requests.video;const deadline=Date.now()+30*60*1000;
    while(!this.closed&&Date.now()<deadline){
      const result=await this.heygen.status(request.id);if(!result)throw new Error('HeyGen returned an empty status response.');
      request.state=result.status;this.save(j);
      if(result.status==='completed')return result;
      if(result.status==='failed')throw Object.assign(new Error('HeyGen could not render this video. Check the saved request ID and billing in HeyGen before a replacement.'),{permanent:true});
      if(!['waiting','pending','processing','queued'].includes(result.status))throw new Error('HeyGen returned an unexpected status. Resume later to check the same video.');
      await new Promise(r=>{const timer=setTimeout(r,4000);timer.unref();});
    }
    throw new Error('Monitoring paused. Resume to check the same HeyGen video ID without another charge.');
  }
  async work(j){
    const dir=this.directory(j);
    if(j.stage==='video'){
      const result=await this.queued(j);if(this.closed)return;
      if(!result.video_url)throw new Error('HeyGen has not returned a downloadable video yet.');
      await this.heygen.download(result.video_url,join(dir,'presenter.mp4'),250*1024*1024);j.files.original=true;this.save(j);
      const probe=await this.media.probe(join(dir,'presenter.mp4'));j.duration=durationOf(probe);j.measuredCostEstimate=estimate(j.avatar.type,j.duration);this.save(j);
      if(!probe.streams.some(s=>s.codec_type==='audio')||!probe.streams.some(s=>s.codec_type==='video')||j.duration>180)
        throw Object.assign(new Error('The HeyGen result has missing media or exceeds this service’s 180-second processing allowance. Review the original; no words were cut or replacement purchased.'),{permanent:true});
      j.runtimeReview=j.duration>30.25?'Above the preferred 30 seconds: Macy must confirm necessary context, natural pace, and absence of filler.':null;this.save(j);
      if(!result.subtitle_url)throw new Error('HeyGen has not returned caption timing yet. Resume to check the same video.');
      const captionFile=await this.heygen.bytes(result.subtitle_url,1024*1024);
      writeFileSync(join(dir,'provider-captions.srt'),captionFile.body);
      try{j.cues=subtitles(captionFile.body.toString('utf8'),j.script,j.question,j.duration);}catch(e){e.permanent=true;throw e;}
      await this.media.run(['-i','presenter.mp4','-vn','-c:a','pcm_s16le','voice.wav'],dir);j.files.voice=true;j.stage='compositing';this.save(j);
    }
    if(j.stage==='compositing'){
      matchingPresenter(j.avatar,j.voice);
      j.status='compositing';this.save(j);
      try{j.technicalQA=await compose(this.media,dir,j);}catch(e){if(e.message?.includes('SOURCE_FRAMING_INCOMPATIBLE'))e.permanent=true;throw e;}
      if(this.closed)return;
      j.detectorVersion=detectorVersion;
      await this.validate(j);j.status='visual_review';j.stage='visual_review';if(j.revisionRequest)j.revisionRequest.status='applied';j.files={...j.files,video:true,thumbnail:true,captions:true,manifest:true};this.save(j);this.manifest(j);
    }
  }
  manifest(j){writeFileSync(join(this.directory(j),'manifest.json'),JSON.stringify(publicJob(j),null,2));}
  async ensureLogo(j,refresh=false){
    if(!j.logoRequired)return;
    const parent=this.store.get(j.parentId),logo=await this.logos.acquire(parent,{refresh});
    const {path,...meta}=logo;copyFileSync(path,join(this.directory(j),'logo.png'));j.logo=meta;j.files.logo=true;this.save(j);
  }
  async review(id,body,actor){return publicJob(await this.revisions.review(id,body,actor));}
  deliver(id){
    if(this.active.has(id))return;const j=this.get(id);if(j.status!=='delivery_pending')return;this.active.add(id);
    const current=async()=>{if(this.closed)throw new Error('Delivery paused during restart.');await this.validate(j);const saved=this.get(id);if(saved.status!=='delivery_pending'||saved.outputRevision!==j.outputRevision||saved.reviews.at(-1)?.decision!=='approve')throw new Error('The approved video changed before upload.');};
    this.delivery.deliver(j,this.directory(j),job=>{if(!this.closed)this.save(job);},current).then(()=>{if(!this.closed)this.manifest(j);}).catch(e=>{if(!this.closed){j.status='delivery_pending';j.error=e.message;this.save(j);}}).finally(()=>this.active.delete(id));
  }
  serve(res,req,path,type){
    if(!existsSync(path))error('The media file is not available yet.',404);
    const size=statSync(path).size,range=req.headers.range;let start=0,end=size-1,partial=false;
    if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
      if(m[1]){start=Number(m[1]);end=m[2]?Number(m[2]):end;}else start=Math.max(0,size-Number(m[2]));end=Math.min(end,size-1);
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}partial=true;}
    res.writeHead(partial?206:200,{'Content-Type':type,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(partial?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
    if(req.method==='HEAD')return res.end();createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
  }
  async route({req,res,path,url,actor,json,send}){
    const automation=path.match(/^\/api\/jobs\/([a-f0-9-]+)\/video-automation$/);
    if(automation){if(req.method==='GET')send(res,200,this.automation.view(automation[1]));else if(req.method==='POST'){
      const body=await json(req);
      if(body.action==='resume'){
        if(!['Arvie','Macy'].includes(actor))error('Arvie or Macy can continue video processing.',403);
        const state=this.automation.view(automation[1]),run=state.runs.find(r=>r.id===body.runId);if(!run||run.status!=='blocked')error('Choose the blocked question approval to continue.');
        queueMicrotask(()=>this.automation.run(run));send(res,202,state);
      }else send(res,200,this.automation.configure(automation[1],body,actor));
    }else error('Unsupported request.',405);return true;}
    if(path==='/api/video-config'&&req.method==='GET'){send(res,200,await this.catalog());return true;}
    if(path==='/api/video-settings')error('Configure HEYGEN_API_KEY privately in Railway Variables, or the local .env file.',403);
    if(path==='/api/video-library'&&req.method==='GET'){send(res,200,await this.library(url.searchParams.get('kind'),url.searchParams.get('type')||'studio_avatar',url.searchParams.get('token')||''));return true;}
    const preview=path.match(/^\/api\/video-preview\/(avatars|voices)\/([-A-Za-z0-9_]+)$/);
    if(preview&&req.method==='GET'){
      const item=(preview[1]==='avatars'?this.avatars:this.voices).get(preview[2]);if(!item?.previewURL)error('Reload the presenter library to refresh this preview.',404);
      const result=await this.heygen.bytes(item.previewURL,8*1024*1024);
      if(!(preview[1]==='avatars'?['image/jpeg','image/png','image/webp']:['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4']).includes(result.type))error('HeyGen returned an unsupported preview format.',502);
      send(res,200,result.body,result.type);return true;
    }
    const create=path.match(/^\/api\/jobs\/([a-f0-9-]+)\/videos$/);
    if(create){if(req.method==='GET')send(res,200,this.list(create[1]).map(j=>{let currentApproval=false;try{currentApproval=j.approvalHash===approved(this.store.get(j.parentId),j.index);}catch{}return {...publicJob(j),currentApproval};}));else if(req.method==='POST')send(res,200,await this.create(create[1],await json(req),actor));else error('Unsupported request.',405);return true;}
    const route=path.match(/^\/api\/videos\/([a-f0-9-]+)(?:\/(speech|render|resume|review|revise|deliver|file|layout-upgrade|framing-replacement))?$/);if(!route)return false;
    const [,,action]=route,id=route[1];
    if(req.method==='GET'&&!action){send(res,200,publicJob(this.get(id)));return true;}
    if(['GET','HEAD'].includes(req.method)&&action==='file'){
      const filename=url.searchParams.get('name'),j=this.get(id);if(!Object.hasOwn(fileTypes,filename))error('Unknown export file.',404);
      if((filename==='final.mp4'||filename==='thumbnail.png')&&!j.files.video)error('The video is not ready for preview.',404);
      if(filename==='presenter.mp4'&&!j.files.original)error('The original video is not available yet.',404);
      this.serve(res,req,join(this.directory(j),filename),fileTypes[filename]);return true;
    }
    if(req.method!=='POST')error('Unsupported request.',405);
    const body=await json(req);
    if(action==='layout-upgrade'){send(res,202,publicJob(await this.revisions.upgrade(id,actor)));return true;}
    if(action==='framing-replacement'){send(res,200,publicJob(await this.revisions.replaceFraming(id,actor)));return true;}
    if(action==='revise'){send(res,200,publicJob(await this.revisions.apply(id,body,actor)));return true;}
    if(action==='deliver'){if(!['Arvie','Macy'].includes(actor))error('Macy or Arvie retries delivery.',403);await this.validate(this.get(id));this.deliver(id);send(res,202,publicJob(this.get(id)));return true;}
    send(res,action==='review'?200:202,action==='review'?await this.review(id,body,actor):await this.start(id,action,body,actor));return true;
  }
}
