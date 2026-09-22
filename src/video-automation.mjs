import {config,rulesHash,appearanceRulesHash,videoRulesCompatible} from './rules.mjs';
import {scriptText} from './video-domain.mjs';
import {requireArticleIdentity} from './article-identity.mjs';
import {randomUUID} from 'node:crypto';
import {approved} from './video-domain.mjs';
import {hash} from './domain.mjs';
import {prepare} from './heygen-domain.mjs';
import {assertFreshPresenterPair,choosePresenter,presenterPool} from './presenter-selection.mjs';
import {matchingPresenter,presenterIssue} from './presenter-compatibility.mjs';
import {detectorVersion} from './visual-checks.mjs';
import {queueWorkerVideo} from './local-video.mjs';
import {videoProvider,isWorkerVideoProvider} from './workflow-config.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>new Date().toISOString();
const topic=question=>question.replace(/[?{}\\<>:\r\n]/g,'').trim().split(/\s+/).slice(0,6).join(' ');

export class ApprovalVideoAutomation {
  constructor(service){
    this.service=service;this.db=service.db;this.active=new Set();
    this.db.exec('CREATE TABLE IF NOT EXISTS video_automation_profiles(parent TEXT PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS video_approval_queue(id TEXT PRIMARY KEY,parent TEXT NOT NULL,updated TEXT NOT NULL,payload TEXT NOT NULL);');
    queueMicrotask(()=>{if(service.closed)return;for(const row of this.db.prepare('SELECT payload FROM video_approval_queue').all()){
      const entry=JSON.parse(row.payload);if(['queued','working'].includes(entry.status))this.run(entry);
    }});
  }
  profile(parent){
    const row=this.db.prepare('SELECT payload FROM video_automation_profiles WHERE parent=?').get(parent),saved=row?JSON.parse(row.payload):null;
    if(saved&&(saved.enabled===false||[presenterPool.version,'2026-09-17-liteavatar-cpu-trial','2026-09-16'].includes(saved.policyVersion)))return saved;
    return {id:'automatic-'+presenterPool.version,policyVersion:presenterPool.version,mode:'automatic',enabled:true,parent,maxEstimatedCost:2,authorizedBy:'system',authorizedAt:'2026-09-16',authorization:'Automatic selection and generation begins after an individual script approval.'};
  }
  view(parent){
    const job=this.service.store.get(parent);if(!job)fail('Article not found.',404);
    const all=this.db.prepare('SELECT payload FROM video_approval_queue WHERE parent=? ORDER BY updated DESC').all(parent).map(r=>JSON.parse(r.payload));
    const runs=all.filter(r=>Number.isInteger(r.index));
    const runIds=new Set(runs.map(r=>r.id)),missingApproved=[];
    for(const [index,video]of (job.plan?.videos||[]).entries())try{
      const approvalHash=approved(job,index),id=hash([parent,index,approvalHash]);
      if(!runIds.has(id))missingApproved.push({index,question:video.question});
    }catch{}
    return {profile:this.profile(parent),lastRun:runs[0]||null,runs,missingApproved};
  }

  startMissing(parent,actor,index){
    if(!Number.isInteger(index))fail('Choose one approved question to start.');
    const missing=this.view(parent).missingApproved.find(item=>item.index===index);
    if(!missing)fail('This question is not approved or already has an automatic video run.',409);
    const profile=this.profile(parent);
    if(profile?.enabled)return this.enqueue(parent,actor,index);
    const provider=videoProvider(this.service.env);
    if(!isWorkerVideoProvider(provider))fail('Automatic video generation is disabled for this article. An administrator must enable it before starting an approved video.',409);
    const recoveryProfile={id:randomUUID(),policyVersion:presenterPool.version,mode:'single_approved_recovery',enabled:true,parent,authorizedBy:actor,authorizedAt:now(),authorization:'One approved video was started explicitly while article-wide automation remained disabled.'};
    return this.enqueue(parent,actor,index,{profile:recoveryProfile,manualRecovery:true});
  }

  configure(parent,body,actor){
    if(!this.service.store.get(parent))fail('Article not found.',404);
    if(body.enabled===false){const previous=this.profile(parent)||{};this.db.prepare('INSERT OR REPLACE INTO video_automation_profiles VALUES(?,?)').run(parent,JSON.stringify({...previous,policyVersion:presenterPool.version,enabled:false,updated:now()}));return this.view(parent);}
    const avatar=this.service.avatars.get(body.avatarId),voice=this.service.voices.get(body.voiceId),limit=Number(body.maxEstimatedCost);
    if(!avatar||avatar.type!=='studio_avatar'||!voice)fail('Select a Studio Avatar and English library voice first.');
    const pair=matchingPresenter(avatar,voice);
    if(body.acceptCost!==true||!Number.isFinite(limit)||limit<2||limit>12)fail('Accept the estimated automatic generation allowance ($2–$12 per video). Actual duration may change the charge.');
    const profile={id:randomUUID(),policyVersion:presenterPool.version,mode:'manual_override',enabled:true,parent,avatar:{id:avatar.id,name:avatar.name,type:'studio_avatar',gender:pair.avatar.gender},voice:{id:voice.id,name:voice.name,language:voice.language,gender:pair.voice.gender},maxEstimatedCost:limit,authorizedBy:actor,authorizedAt:now()};
    this.db.prepare('INSERT OR REPLACE INTO video_automation_profiles VALUES(?,?)').run(parent,JSON.stringify(profile));
    this.service.store.record(parent,actor,'enable_video_after_content_approval');return this.view(parent);
  }
  oneTimeApproval(parent,index,body,actor){
    if(!this.service.store.get(parent))fail('Article not found.',404);
    if(!Number.isInteger(index))fail('Choose one specific question for the approval override.');
    const aspectRatio=body?.aspectRatio,limit=Number(body?.maxEstimatedCost),reason=String(body?.reason||'').trim();
    if(!['9:16','16:9'].includes(aspectRatio))fail('Choose portrait 9:16 or landscape 16:9 for this video.');
    if(body?.acceptCost!==true||!Number.isFinite(limit)||limit<2||limit>12)fail('Accept the one-time HeyGen allowance ($2–$12 for this video). Actual duration may change the charge.');
    if(reason.length<20||reason.length>1000)fail('Explain the one-time approval override in 20 to 1000 characters.');
    return {id:randomUUID(),policyVersion:presenterPool.version,mode:'one_time_approval_override',enabled:true,parent,index,aspectRatio,maxEstimatedCost:limit,authorizedBy:actor,authorizedAt:now(),authorization:reason};
  }
  enqueue(parent,actor,index,{profile=this.profile(parent),manualRecovery=false}={}){
    if(!profile?.enabled)return {status:'configuration_needed'};
    const job=this.service.store.get(parent),approvalHash=approved(job,index),id=hash([parent,index,approvalHash]);
    const existing=this.db.prepare('SELECT payload FROM video_approval_queue WHERE id=?').get(id);if(existing)return JSON.parse(existing.payload);
    const entry={id,parent,index,approvalHash,profile,manualRecovery,triggeredBy:actor,created:now(),status:'queued',videos:[],selection:null};this.save(entry);
    queueMicrotask(()=>this.run(entry));return entry;
  }
  save(entry){this.db.prepare('INSERT INTO video_approval_queue VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,payload=excluded.payload').run(entry.id,entry.parent,now(),JSON.stringify(entry));}
  failVideo(video,message){
    for(const row of this.db.prepare('SELECT payload FROM video_approval_queue WHERE parent=?').all(video.parentId)){
      const entry=JSON.parse(row.payload);if(!entry.videos?.includes(video.id)||!['queued','working','submitted'].includes(entry.status))continue;
      entry.status='blocked';entry.error=message;this.save(entry);
    }
  }
  assertProfile(parent,id){const current=this.profile(parent);if(!current?.enabled||current.id!==id)throw new Error('Automatic video settings changed or were disabled. Review this saved question approval before submission.');}
  assertAuthorization(parent,automation){
    if(automation?.profileMode!=='one_time_approval_override')return this.assertProfile(parent,automation?.profileId);
    const row=this.db.prepare('SELECT payload FROM video_approval_queue WHERE id=? AND parent=?').get(automation.approvalQueueId,parent);
    const entry=row?JSON.parse(row.payload):null,profile=entry?.profile;
    if(!profile?.enabled||profile.mode!=='one_time_approval_override'||profile.id!==automation.profileId||profile.parent!==parent||profile.index!==automation.index||entry.index!==automation.index||entry.approvalHash!==automation.approvalHash||profile.aspectRatio!==automation.aspectRatio)throw new Error('This one-time video approval is no longer bound to the saved question and output format.');
  }
  async reuse(parent,index,approvalHash,aspectRatio='9:16'){
    const s=this.service,script=scriptText(parent.plan.videos[index]);
    const matches=s.list(parent.id).filter(j=>j.provider==='heygen'&&j.index===index&&j.script===script&&j.source?.sourceHash===parent.doc.sourceHash&&(j.format?.aspectRatio||'9:16')===aspectRatio);
    if(matches.some(j=>j.status==='needs_reconciliation'||j.requests?.video?.state==='submitting'&&!j.requests.video.id))throw new Error('This question has an uncertain earlier paid submission. Reconcile it before any replacement.');
    const paid=matches.filter(j=>j.requests?.video?.id);if(!paid.length)return null;
    const compatible=paid.filter(j=>!presenterIssue(j.avatar,j.voice));
    const expectedRules=parent.mode==='direct_google'?appearanceRulesHash:rulesHash;
    const current=compatible.find(j=>j.layoutVersion===config.video.layoutVersion&&j.detectorVersion===detectorVersion&&videoRulesCompatible(j.source.rulesHash,expectedRules)&&hash(j.client)===hash(parent.client)&&hash(j.articleIdentity)===hash(requireArticleIdentity(parent.doc,parent.plan.articleIdentity))&&j.endCard?.targetUrl===parent.row.pageUrl);
    if(current){
      if(current.approvalHash!==approvalHash){
        current.approvalHistory=[...(current.approvalHistory||[]),{approvalHash:current.approvalHash,rulesHash:current.source.rulesHash,reviews:current.reviews,at:now()}];
        current.approvalHash=approvalHash;current.source.folderUrl=parent.row.folderUrl;current.automation=null;
        if(current.status!=='delivered'){current.reviews=[];current.delivery=null;if(current.status==='delivery_pending')current.status='visual_review';}
        s.save(current);s.store.record(parent.id,'system','reuse_paid_video_for_individual_question_approval');
      }
      return current;
    }
    const reusable=compatible.find(j=>j.requests.video.state==='completed'&&j.files?.original&&j.files?.voice&&j.sourceFraming?.version==='preserve-source-1'&&j.cues?.length);
    if(reusable)return await s.revisions.upgrade(reusable.id,'system');
    // Existing paid footage must never silently turn into a new paid retry.
    throw new Error(compatible.length?'The existing paid footage needs a reviewed correction. No replacement was purchased.':presenterIssue(paid[0].avatar,paid[0].voice));
  }
  async run(entry){
    const service=this.service;if(service.closed||this.active.has(entry.id))return;this.active.add(entry.id);
    try{
      if(!Number.isInteger(entry.index))throw new Error('Article-wide approval retired. Review each question separately; no new submission was made.');
      const provider=videoProvider(service.env);
      if(entry.manualRecovery){
        if(entry.profile?.mode!=='single_approved_recovery'||!isWorkerVideoProvider(provider))throw new Error('This one-time recovery is limited to the configured self-hosted video worker.');
      }else if(entry.profile?.mode==='one_time_approval_override'){
        const profile=entry.profile;
        if(!profile.enabled||profile.parent!==entry.parent||profile.index!==entry.index||!['9:16','16:9'].includes(profile.aspectRatio)||!Number.isFinite(profile.maxEstimatedCost)||profile.maxEstimatedCost<2||profile.maxEstimatedCost>12)throw new Error('This one-time video approval is invalid.');
      }else this.assertProfile(entry.parent,entry.profile.id);
      const parent=service.store.get(entry.parent);if(approved(parent,entry.index)!==entry.approvalHash)throw new Error('This question or its review changed. A new individual approval is required.');
      await service.checkFresh(parent,entry.index);entry.status='working';entry.error=null;this.save(entry);
      // The selected provider is authoritative for every saved article mode.
      // Historical live_google records must never fall through to a paid
      // provider after the workspace switches to a self-hosted worker.
      if(isWorkerVideoProvider(provider)){
        const local=await queueWorkerVideo(service,parent,entry.index,entry.triggeredBy,provider);entry.videos=[local.id];entry.selection={avatar:local.avatar,voice:local.voice,selection:{method:provider==='liteavatar_worker'?'liteavatar_cpu_trial_profiles':'approved_local_assets'}};entry.status='submitted';entry.error=null;this.save(entry);return;
      }
      const prior=await this.reuse(parent,entry.index,entry.approvalHash,entry.profile.aspectRatio||'9:16');
      if(prior){entry.videos=[prior.id];entry.reusedExisting=true;const held=['needs_attention','needs_reconciliation','failed','paused','changes_requested'].includes(prior.status);entry.status=held?'blocked':'submitted';entry.error=held?(prior.error||'The saved video needs attention. No replacement was purchased.'):null;this.save(entry);return;}
      if(!service.env.HEYGEN_API_KEY)throw new Error('HEYGEN_API_KEY is missing. Add it privately in Railway; this question approval can continue afterward.');
      await service.ready;
      const profile=entry.profile,index=entry.index;
      const reserved=this.db.prepare('SELECT payload FROM video_approval_queue').all().map(row=>JSON.parse(row.payload)).filter(run=>run.id!==entry.id&&['queued','working'].includes(run.status)&&run.selection).map(run=>run.selection);
      if(!entry.selection){
        entry.selection=profile.mode==='manual_override'?{avatar:profile.avatar,voice:profile.voice,selection:{method:'admin_override'}}:choosePresenter(parent,index,service.list(),reserved);this.save(entry);
      }
      const chosen=entry.selection;assertFreshPresenterPair(chosen,service.list(),reserved);
      const settings={index,avatarId:chosen.avatar.id,voiceId:chosen.voice.id,presenterAccepted:true,thumbnailTitle:parent.plan.videos[index].thumbnailTitle||topic(parent.plan.videos[index].question),aspectRatio:profile.aspectRatio||'9:16'},planned=prepare(parent,settings,chosen.avatar,chosen.voice);
      if(planned.renderEstimate>profile.maxEstimatedCost)throw new Error(`Question ${index+1} is estimated at $${planned.renderEstimate.toFixed(2)}, above the $${profile.maxEstimatedCost.toFixed(2)} allowance.`);
      service.avatars.set(chosen.avatar.id,chosen.avatar);service.voices.set(chosen.voice.id,chosen.voice);
      const j=await service.create(parent.id,settings,profile.authorizedBy);entry.videos=[j.id];this.save(entry);
      if(j.status==='prepared'){
        if(profile.mode!=='one_time_approval_override')this.assertProfile(entry.parent,profile.id);
        const saved=service.get(j.id);saved.selection=chosen.selection;saved.automation={approvalQueueId:entry.id,index,approvalHash:entry.approvalHash,aspectRatio:settings.aspectRatio,triggeredBy:entry.triggeredBy,authorizedBy:profile.authorizedBy,profileId:profile.id,profileMode:profile.mode};service.save(saved);
        await service.start(j.id,'render',{acceptCost:true,acceptedEstimate:j.renderEstimate},profile.authorizedBy);
      }else if(['paused','needs_reconciliation','needs_attention','failed','changes_requested'].includes(j.status))throw new Error('This question’s saved video needs attention. Resume or inspect it; no replacement was purchased.');
      entry.status='submitted';entry.error=null;this.save(entry);
    }catch(e){if(!service.closed){entry.status=Number.isInteger(entry.index)?'blocked':'retired';entry.error=String(e.message).replaceAll(service.env.HEYGEN_API_KEY||'__no_secret__','[redacted]').replace(/https?:\/\/\S+/g,'[provider URL]');this.save(entry);}}
    finally{this.active.delete(entry.id);}
  }
}
