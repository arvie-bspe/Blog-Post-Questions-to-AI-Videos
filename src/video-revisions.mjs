import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash} from './domain.mjs';
import {visualSettings} from './portrait-media.mjs';
import {approved,scriptText} from './video-domain.mjs';
import {layoutVersion,endCardData,detectorVersion} from './visual-checks.mjs';
import {rulesHash,appearanceRulesHash} from './rules.mjs';
import {prepare as prepareHeyGen,captionCase} from './heygen-domain.mjs';
import {requireArticleIdentity} from './article-identity.mjs';
import {recordQuestionReview} from './question-approval.mjs';
import {matchingPresenter} from './presenter-compatibility.mjs';
import {queueLocalReplacement,queueWorkerVideo} from './local-video.mjs';
import {isWorkerVideoProvider,videoProvider} from './workflow-config.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>new Date().toISOString();
export class VideoRevisions{
  constructor(service){this.service=service;this.reviewing=new Set();this.applying=new Set();}
  async replaceFraming(id,actor){
    const s=this.service;if(!['Arvie','Macy'].includes(actor))fail('Arvie or Macy prepares video replacements.',403);
    if(this.applying.has(id)||s.active.has(id))fail('This video is already processing.',409);this.applying.add(id);
    try{
      const old=s.get(id);if(old.provider!=='heygen'||!old.error?.includes('SOURCE_FRAMING_INCOMPATIBLE'))fail('This video has no failed source-framing check.',409);
      const parent=s.store.get(old.parentId);approved(parent,old.index);await s.checkFresh(parent);
      const current=s.store.get(parent.id);
      if(scriptText(current.plan.videos[old.index])!==old.script||current.doc.sourceHash!==old.source.sourceHash)fail('The script or source changed. Prepare a new setup from the current reviewed content.',409);
      const currentProvider=videoProvider(s.env);
      if(isWorkerVideoProvider(currentProvider)){
        const replacement=await queueWorkerVideo(s,current,old.index,actor,currentProvider);
        s.store.record(parent.id,actor,'replace_historical_heygen_with_current_worker');return replacement;
      }
      s.assertHeyGenEnabled();
      const data=prepareHeyGen(current,{index:old.index,thumbnailTitle:old.thumbnailTitle,presenterAccepted:true},old.avatar,old.voice);
      const existing=s.db.prepare('SELECT payload FROM videos WHERE identity=?').get(data.identity);if(existing)return JSON.parse(existing.payload);
      const j={...data,id:randomUUID(),created:now(),createdBy:actor,presenterAcceptedAt:old.presenterAcceptedAt,previousVideoId:old.id,replacementReason:'Preserve the complete source scene before Railway portrait framing.'};
      s.save(j);s.store.record(parent.id,actor,'prepare_framing_replacement_no_charge');return j;
    }finally{this.applying.delete(id);}
  }
  async upgrade(id,actor){
    const s=this.service;if(!['Arvie','Macy'].includes(actor))fail('Arvie or Macy rebuilds video layouts.',403);
    if(this.applying.has(id)||s.active.has(id))fail('This video is already processing.',409);this.applying.add(id);
    try{
      const old=s.get(id),parent=s.store.get(old.parentId),approvalHash=approved(parent,old.index);
      if(old.provider!=='heygen'&&!isWorkerVideoProvider(old.provider)||!old.files.original||!old.files.voice)fail('Existing source footage and speech are required for a layout rebuild.');
      const pair=matchingPresenter(old.avatar,old.voice);
      const expectedRules=parent.mode==='direct_google'?appearanceRulesHash:rulesHash;
      if(old.layoutVersion===layoutVersion&&old.detectorVersion===detectorVersion&&old.source.rulesHash===expectedRules)fail('This video already uses the current layout and framing checks. Use Request changes for another correction.');
      const workerRequest=old.provider==='liteavatar_worker'?old.requests?.liteavatar:old.requests?.local;
      if(old.provider==='heygen'&&old.requests?.video?.state!=='completed'||isWorkerVideoProvider(old.provider)&&workerRequest?.state!=='completed')fail('The existing generation task must be complete before rebuilding its footage.');
      await s.checkFresh(parent,old.index);
      if(approved(s.store.get(parent.id),old.index)!==approvalHash)fail('The approved question changed during this request.',409);
      if(scriptText(parent.plan.videos[old.index])!==old.script||parent.doc.sourceHash!==old.source.sourceHash)fail('The script or article changed. Prepare a new video from the current approved content.');
      const articleIdentity=requireArticleIdentity(parent.doc,parent.plan.articleIdentity);
      const endCard={...endCardData({articleIdentity,script:old.script,source:{targetUrl:parent.row.pageUrl}}),seconds:3};
      const identity=hash([old.id,old.outputRevision||1,layoutVersion,detectorVersion,expectedRules,approvalHash,endCard]);
      const exists=s.db.prepare('SELECT payload FROM videos WHERE identity=?').get(identity);if(exists)return JSON.parse(exists.payload);
      const j={...structuredClone(old),id:randomUUID(),identity,approvalHash,layoutVersion,endCard,client:parent.client,source:{...old.source,rulesHash:expectedRules,targetUrl:parent.row.pageUrl,folderUrl:parent.row.folderUrl},previousVideoId:old.id,created:now(),createdBy:actor,status:'compositing',stage:'compositing',error:null,files:{original:true,voice:true},reviews:[],reviewHistory:[],revisionRequest:null,delivery:null,outputRevision:1,technicalQA:null,visualSettings:visualSettings(),automation:null,layoutRebuild:{fromVideoId:old.id,providerRequests:0}};
      Object.assign(j,pair,{detectorVersion});
      j.cues=captionCase(old.cues||[],old.script);
      const from=s.directory(old),to=s.directory(j);
      for(const name of ['presenter.mp4','voice.wav','provider-captions.srt','alignment.json'])if(existsSync(join(from,name)))copyFileSync(join(from,name),join(to,name));
      j.articleIdentity=articleIdentity;s.save(j);s.active.add(j.id);s.store.record(parent.id,actor,'rebuild_current_layout_without_provider_request');
      (async()=>{await s.ensureLogo(j);await s.work(j);})().catch(e=>{if(!s.closed){j.status='needs_attention';j.error=e.message;s.save(j);}}).finally(()=>s.active.delete(j.id));
      return j;
    }finally{this.applying.delete(id);}
  }
  async review(id,body,actor){
    const s=this.service;if(!['Macy','Arvie'].includes(actor))fail('Macy or Arvie reviews the final video.',403);
    if(this.reviewing.has(id)||s.active.has(id))fail('This video is already processing.',409);this.reviewing.add(id);
    try{
      const j=s.get(id);await s.validate(j);if(body.expectedOutputRevision!==undefined&&body.expectedOutputRevision!==(j.outputRevision||1))fail('This output changed. Review its current version.',409);
      if(j.status!=='visual_review')fail('A completed render is required before visual review.',409);
      if(!['approve','reject'].includes(body.decision)||typeof body.note!=='string'||body.note.trim().length<10||body.note.length>4000)fail('Choose a decision and add at least 10 characters of review notes.');
      if(body.decision==='approve'&&(!body.checkedVideo||!body.checkedCaptions||!body.checkedContacts))fail('Check lips, audio, captions, contacts, logo, thumbnail, and playback before marking ready.');
      if(body.decision==='approve'&&(!body.checkedFraming||!body.checkedNoNap||!body.checkedEndCard))fail('Confirm full-frame upper-torso framing, clean-logo/no-contact speech frames, and the separate white end card.');
      if(body.decision==='approve'&&j.provider==='liteavatar_worker'&&j.avatar?.rightsStatus==='evaluation_only'&&s.env.LITEAVATAR_ASSET_RIGHTS_CONFIRMED!=='true')fail('This trial avatar is approved for internal evaluation only. Confirm commercial rights and set LITEAVATAR_ASSET_RIGHTS_CONFIRMED=true before Drive delivery.',409);
      if(body.decision==='reject'&&body.changeType==='layout')visualSettings(body.visualSettings);
      if(body.decision==='reject'&&body.changeType==='render'&&!isWorkerVideoProvider(videoProvider(s.env))&&(body.acceptCost!==true||body.acceptedEstimate!==j.renderEstimate))fail('Accept the displayed generation cost estimate before requesting this change.');
      j.reviews.push({actor,at:now(),decision:body.decision,note:body.note.trim(),checkedVideo:!!body.checkedVideo,checkedCaptions:!!body.checkedCaptions,checkedContacts:!!body.checkedContacts,checkedFraming:!!body.checkedFraming,checkedNoNap:!!body.checkedNoNap,checkedEndCard:!!body.checkedEndCard,authenticated:!s.local,outputRevision:j.outputRevision||1});
      if(body.decision==='approve'){j.status='delivery_pending';j.error=null;s.save(j);s.manifest(j);s.deliver(j.id);return s.get(j.id);}
      j.status='revision_pending';j.revisionRequest={actor,note:body.note.trim(),type:body.changeType||'manual',status:'pending',at:now()};s.save(j);s.store.record(j.parentId,actor,'video_revision_requested');
      return await this.apply(j.id,body,actor);
    }finally{this.reviewing.delete(id);}
  }
  async apply(id,body,actor){if(this.applying.has(id))fail('A video revision is already being applied.',409);this.applying.add(id);try{return await this.applyChange(id,body,actor);}finally{this.applying.delete(id);}}
  async applyChange(id,body,actor){
    const s=this.service;if(!['Macy','Arvie'].includes(actor))fail('Macy or Arvie applies video changes.',403);
    const j=s.get(id);if(j.status!=='revision_pending'||s.active.has(id))fail('This video has no pending revision.',409);await s.validate(j);
    const type=body.changeType||'manual';
    if(type==='script'){
      const parent=s.store.get(j.parentId);recordQuestionReview(parent,j.index,{actor,decision:'reject',note:`Video question ${j.index+1}: ${j.revisionRequest.note}`,at:now(),sourceVideoId:j.id});s.store.save(parent);
      j.revisionRequest.status='returned_to_content_review';s.save(j);if(s.onScriptChanges)await s.onScriptChanges(parent.id,parent.reviews.at(-1).note,j.index);return s.get(id);
    }
    if(type==='layout'){
      const next=visualSettings(body.visualSettings),previous=visualSettings(j.visualSettings);
      if(JSON.stringify(next)===JSON.stringify(previous)&&body.refreshLogo!==true){j.error='Feedback saved for a manual correction. Change the layout controls or choose Refresh logo to apply a specific change without OpenAI.';s.save(j);return j;}
      const dir=s.directory(j),archive=join(dir,'revisions',String(j.outputRevision||1));mkdirSync(archive,{recursive:true});
      for(const name of ['final.mp4','thumbnail.png','captions.vtt','captions.ass','end-card.ass','thumbnail.ass','manifest.json','logo.png'])if(existsSync(join(dir,name)))copyFileSync(join(dir,name),join(archive,name));
      j.reviewHistory=[...(j.reviewHistory||[]),{outputRevision:j.outputRevision||1,reviews:j.reviews,visualSettings:previous,logo:j.logo,at:now()}];j.reviews=[];j.outputRevision=(j.outputRevision||1)+1;j.visualSettings=next;j.delivery=null;j.files={...j.files,video:false,thumbnail:false,captions:false};j.revisionRequest.status='working';j.status='compositing';j.stage='compositing';j.error=null;s.save(j);s.active.add(id);
      (async()=>{if(body.refreshLogo)await s.ensureLogo(j,true);await s.work(j);})().catch(e=>{if(!s.closed){j.status='needs_attention';j.error=e.message;j.revisionRequest.status='failed';s.save(j);}}).finally(()=>s.active.delete(id));return j;
    }
    if(type==='render'){
      const currentProvider=videoProvider(s.env);
      if(isWorkerVideoProvider(j.provider)&&j.provider===currentProvider)return await queueLocalReplacement(s,j,actor);
      if(isWorkerVideoProvider(currentProvider)){
        const parent=s.store.get(j.parentId),replacement=await queueWorkerVideo(s,parent,j.index,actor,currentProvider);
        j.status='changes_requested';j.revisionRequest.status='replacement_started';j.revisionRequest.replacementId=replacement.id;s.save(j);return s.get(replacement.id);
      }
      s.assertHeyGenEnabled();
      if(body.acceptCost!==true||body.acceptedEstimate!==j.renderEstimate)fail('Accept the displayed generation estimate before creating a replacement.');
      let voice=body.voiceId?s.voices.get(body.voiceId):j.voice;if(!voice)fail('Select an available English voice from the library.');
      voice=matchingPresenter(j.avatar,voice).voice;
      const replacement={...structuredClone(j),id:randomUUID(),identity:hash([j.id,'requested_replacement',j.revisionRequest.at]),voice:{id:voice.id,name:voice.name,language:voice.language,gender:voice.gender},previousVideoId:j.id,generationVersion:(j.generationVersion||1)+1,created:now(),createdBy:actor,status:'prepared',stage:null,error:null,requests:{},files:{},reviews:[],reviewHistory:[],revisionRequest:null,delivery:null,outputRevision:1,authorization:null,automation:null};
      s.save(replacement);j.status='changes_requested';j.revisionRequest.status='replacement_prepared';j.revisionRequest.replacementId=replacement.id;s.save(j);
      try{await s.start(replacement.id,'render',{acceptCost:true,acceptedEstimate:replacement.renderEstimate},actor);j.revisionRequest.status='replacement_started';s.save(j);}catch(e){replacement.error=e.message;s.save(replacement);}
      return s.get(replacement.id);
    }
    j.error='Feedback is waiting for a manual correction. OpenAI is not required for explicit layout controls; free-text edits can be applied by Codex/Arvie during this test.';s.save(j);return j;
  }
}
