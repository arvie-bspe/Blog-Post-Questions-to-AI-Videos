import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash} from './domain.mjs';
import {visualSettings} from './portrait-media.mjs';
import {approved,scriptText} from './video-domain.mjs';
import {layoutVersion,endCardData,detectorVersion} from './visual-checks.mjs';
import {rulesHash,appearanceRulesHash,videoRulesCompatible} from './rules.mjs';
import {prepare as prepareHeyGen,captionCase} from './heygen-domain.mjs';
import {requireArticleIdentity} from './article-identity.mjs';
import {recordQuestionReview} from './question-approval.mjs';
import {matchingPresenter,professionalPresenter,presenterPool} from './presenter-compatibility.mjs';
import {assertFreshPresenterPair,choosePresenter} from './presenter-selection.mjs';
import {queueLocalReplacement,queueWorkerVideo} from './local-video.mjs';
import {isWorkerVideoProvider,videoProvider} from './workflow-config.mjs';
import {permittedPresenterGender} from './article-identity.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>new Date().toISOString();
export class VideoRevisions{
  constructor(service){this.service=service;this.reviewing=new Set();this.applying=new Set();}
  async replaceFailedRender(id,body,actor){
    const s=this.service;
    if(this.applying.has(id)||s.active.has(id))fail('This video is already processing.',409);this.applying.add(id);
    try{
      s.assertHeyGenEnabled();
      const old=s.get(id),request=old.requests?.video;
      if(old.provider!=='heygen'||!['needs_attention','failed'].includes(old.status)||!request?.id||request.state!=='failed'||old.files?.original||old.files?.video)
        fail('Only a terminal HeyGen failure with no generated media can create this replacement.',409);
      if(body.acceptCost!==true)fail('Authorize the displayed one-time replacement cost first.');
      const maximum=Number(body.maxEstimatedCost),reason=String(body.reason||'').trim();
      if(!Number.isFinite(maximum)||maximum<=0||maximum>12)fail('Set a one-time replacement ceiling from $0.01 to $12.00.');
      if(reason.length<20||reason.length>1000)fail('Add 20 to 1000 characters explaining this one-time replacement.');
      await s.validate(old,{allowCompletedStoredApproval:true});
      const parent=s.store.get(old.parentId),currentApprovalHash=approved(parent,old.index);
      if(scriptText(parent.plan.videos[old.index])!==old.script||parent.doc.sourceHash!==old.source.sourceHash)
        fail('The script or source changed. Prepare a new setup from the current reviewed content.',409);
      const conflicting=s.list(old.parentId).find(video=>video.id!==old.id&&video.index===old.index&&(
        ['prepared','working','compositing','paused','needs_reconciliation'].includes(video.status)||
        ['submitting','waiting','pending','processing','queued'].includes(video.requests?.video?.state)
      ));
      if(conflicting)fail('Another setup or provider request for this question is already pending. Review it before creating a replacement.',409);
      const previous=[{avatar:old.avatar,voice:old.voice}],chosen=choosePresenter(parent,old.index,s.list(),previous);
      assertFreshPresenterPair(chosen,s.list(),previous);
      const data=prepareHeyGen(parent,{index:old.index,thumbnailTitle:old.thumbnailTitle,presenterAccepted:true,aspectRatio:old.format?.aspectRatio||'9:16'},chosen.avatar,chosen.voice);
      if(data.approvalHash!==currentApprovalHash||data.script!==old.script||data.source.sourceHash!==old.source.sourceHash)
        fail('The approved content changed while preparing the replacement.',409);
      if(data.renderEstimate>maximum)fail(`The replacement estimate is $${data.renderEstimate.toFixed(2)}, above the authorized $${maximum.toFixed(2)} ceiling.`);
      const existing=s.db.prepare('SELECT payload FROM videos WHERE identity=?').get(data.identity);
      if(existing)fail('This exact replacement setup already exists. Open the saved setup instead of creating another request.',409);
      const at=now(),replacement={...data,id:randomUUID(),created:at,createdBy:actor,presenterAcceptedAt:at,selection:{...chosen.selection,method:'admin_failed_render_replacement'},previousVideoId:old.id,generationVersion:(old.generationVersion||1)+1,replacementReason:reason,replacementAuthorization:{actor,at,maxEstimatedCost:maximum,estimatedCost:data.renderEstimate,providerRequestLimit:1,sourceFailureRequestId:request.id},authorization:null,automation:null};
      s.db.exec('BEGIN IMMEDIATE');
      try{
        s.save(replacement);old.status='changes_requested';old.replacementRecovery={actor,at,reason,replacementId:replacement.id,maxEstimatedCost:maximum,sourceFailureRequestId:request.id};s.save(old);s.store.record(parent.id,actor,'prepare_failed_heygen_replacement');s.db.exec('COMMIT');
      }catch(error){s.db.exec('ROLLBACK');throw error;}
      try{await s.start(replacement.id,'render',{acceptCost:true,acceptedEstimate:replacement.renderEstimate},actor);}
      catch(error){replacement.error=String(error.message||error);s.save(replacement);}
      return s.get(replacement.id);
    }finally{this.applying.delete(id);}
  }
  async replaceFraming(id,actor){
    const s=this.service;
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
    const s=this.service;
    if(this.applying.has(id)||s.active.has(id))fail('This video is already processing.',409);this.applying.add(id);
    try{
      const old=s.get(id),parent=s.store.get(old.parentId),approvalHash=approved(parent,old.index);
      if(old.provider!=='heygen'&&!isWorkerVideoProvider(old.provider)||!old.files.original||!old.files.voice)fail('Existing source footage and speech are required for a layout rebuild.');
      const pair=matchingPresenter(old.avatar,old.voice);
      const expectedRules=parent.mode==='direct_google'?appearanceRulesHash:rulesHash;
      if(old.layoutVersion===layoutVersion&&old.detectorVersion===detectorVersion&&videoRulesCompatible(old.source.rulesHash,expectedRules))fail('This video already uses the current layout and framing checks. Use Request changes for another correction.');
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
  async correctEndCard(id,body,actor){
    const s=this.service;
    if(this.applying.has(id)||s.active.has(id))fail('This video is already processing.',409);this.applying.add(id);
    try{
      const old=s.get(id),reason=String(body.reason||'').trim();
      if(!old.files?.original||!old.files?.voice||!old.files?.video)fail('A finished video with saved presenter footage and speech is required for an end-card-only rebuild.',409);
      if(body.expectedOutputRevision!==undefined&&body.expectedOutputRevision!==(old.outputRevision||1))fail('This output changed. Reload before correcting its end card.',409);
      if(reason.length<10||reason.length>1000)fail('Add 10 to 1000 characters explaining the contact correction.');
      await s.validate(old,{allowCompletedStoredApproval:true});
      const parent=s.store.get(old.parentId),approvalHash=approved(parent,old.index);
      if(scriptText(parent.plan.videos[old.index])!==old.script||parent.doc.sourceHash!==old.source.sourceHash)fail('The script or source changed. Prepare a new video from the current reviewed content.',409);
      const text=(key,maximum)=>{const value=String(body[key]??old.endCard?.[key]??'').trim();if(!value||value.length>maximum||/[{}\\<>\x00-\x1f]/.test(value))fail(`Enter a valid end-card ${key}.`);return value;};
      const previous={name:old.endCard?.name||old.articleIdentity?.name,address:old.endCard?.address||old.articleIdentity?.address,phone:old.endCard?.phone||old.articleIdentity?.phone,targetUrl:old.endCard?.targetUrl||old.source?.targetUrl};
      const corrected={name:text('name',200),address:text('address',300),phone:text('phone',80),targetUrl:previous.targetUrl,seconds:3};
      if(JSON.stringify(corrected)===JSON.stringify({...previous,seconds:3}))fail('Change at least one end-card contact field.');
      const at=now(),contactCorrection={type:'admin_end_card_contact',actor,at,reason,previous,updated:{name:corrected.name,address:corrected.address,phone:corrected.phone,targetUrl:corrected.targetUrl}};
      endCardData({...old,endCard:corrected,contactCorrection});
      const identity=hash([old.id,old.outputRevision||1,'admin_end_card_contact',approvalHash,corrected]);
      const existing=s.db.prepare('SELECT payload FROM videos WHERE identity=?').get(identity);if(existing)return JSON.parse(existing.payload);
      const j={...structuredClone(old),id:randomUUID(),identity,approvalHash,endCard:corrected,contactCorrection,previousVideoId:old.id,created:at,createdBy:actor,status:'compositing',stage:'compositing',error:null,files:{original:true,voice:true,logo:false,video:false,thumbnail:false,captions:false,manifest:false},reviews:[],reviewHistory:[],revisionRequest:null,delivery:null,outputRevision:1,technicalQA:null,automation:null,layoutRebuild:{fromVideoId:old.id,providerRequests:0,type:'end_card_contact_only'}};
      const from=s.directory(old),to=s.directory(j);
      for(const name of ['presenter.mp4','voice.wav','provider-captions.srt','alignment.json'])if(existsSync(join(from,name)))copyFileSync(join(from,name),join(to,name));
      if(existsSync(join(from,'logo.png'))){copyFileSync(join(from,'logo.png'),join(to,'logo.png'));j.files.logo=true;}
      s.save(j);s.active.add(j.id);s.store.record(parent.id,actor,'rebuild_end_card_contact_without_provider_request');
      (async()=>{if(!j.files.logo)await s.ensureLogo(j);await s.work(j);})().catch(error=>{if(!s.closed){j.status='needs_attention';j.error=error.message;s.save(j);}}).finally(()=>s.active.delete(j.id));
      return j;
    }finally{this.applying.delete(id);}
  }
  async review(id,body,actor){
    const s=this.service;
    if(this.reviewing.has(id)||s.active.has(id))fail('This video is already processing.',409);this.reviewing.add(id);
    try{
      const j=s.get(id),genderCorrection=body.decision==='reject'&&body.changeType==='gender';await s.validate(j,{allowPresenterCorrection:genderCorrection,allowCompletedStoredApproval:true});if(body.expectedOutputRevision!==undefined&&body.expectedOutputRevision!==(j.outputRevision||1))fail('This output changed. Review its current version.',409);
      if(j.status!=='visual_review')fail('A completed render is required before visual review.',409);
      if(!['approve','reject'].includes(body.decision))fail('Choose approve or request changes.');
      if(body.note!==undefined&&typeof body.note!=='string')fail('Review notes must be text.');
      const note=String(body.note||'').trim();
      if(String(body.note||'').length>4000)fail('Review notes cannot exceed 4000 characters.');
      if(body.decision==='reject'&&note.length<10)fail('Add at least 10 characters of review notes when requesting video changes.');
      if(body.decision==='approve'&&j.provider==='liteavatar_worker'&&j.avatar?.rightsStatus==='evaluation_only'&&s.env.LITEAVATAR_ASSET_RIGHTS_CONFIRMED!=='true')fail('This trial avatar is approved for internal evaluation only. Confirm commercial rights and set LITEAVATAR_ASSET_RIGHTS_CONFIRMED=true before Drive delivery.',409);
      if(body.decision==='reject'&&body.changeType==='layout')visualSettings(body.visualSettings);
      if(genderCorrection){
        if(!isWorkerVideoProvider(videoProvider(s.env)))fail('Presenter-gender correction requires the CPU worker.');
        body.presenterGender=permittedPresenterGender(s.store.get(j.parentId).doc,s.store.get(j.parentId).plan?.presenterContext,body.presenterGender);
        if(j.avatar?.gender===body.presenterGender&&j.voice?.gender===body.presenterGender)fail(`This video already uses an approved ${body.presenterGender} presenter and matching voice.`);
      }
      if(body.decision==='reject'&&body.changeType==='render'&&!isWorkerVideoProvider(videoProvider(s.env))&&(body.acceptCost!==true||body.acceptedEstimate!==j.renderEstimate))fail('Accept the displayed generation cost estimate before requesting this change.');
      j.reviews.push({actor,at:now(),decision:body.decision,note,changeType:body.decision==='reject'?body.changeType||'manual':null,presenterGender:genderCorrection?body.presenterGender:null,authenticated:!s.local,outputRevision:j.outputRevision||1});
      if(body.decision==='approve'){j.status='delivery_pending';j.error=null;s.save(j);s.manifest(j);s.deliver(j.id);return s.get(j.id);}
      j.status='revision_pending';j.revisionRequest={actor,note,type:body.changeType||'manual',presenterGender:genderCorrection?body.presenterGender:null,status:'pending',at:now()};s.save(j);s.store.record(j.parentId,actor,'video_revision_requested');
      return await this.apply(j.id,body,actor);
    }finally{this.reviewing.delete(id);}
  }
  async apply(id,body,actor){if(this.applying.has(id))fail('A video revision is already being applied.',409);this.applying.add(id);try{return await this.applyChange(id,body,actor);}finally{this.applying.delete(id);}}
  async applyChange(id,body,actor){
    const s=this.service;
    const j=s.get(id);if(j.status!=='revision_pending'||s.active.has(id))fail('This video has no pending revision.',409);const type=body.changeType||j.revisionRequest?.type||'manual';await s.validate(j,{allowPresenterCorrection:type==='gender',allowCompletedStoredApproval:true});
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
    if(type==='gender'){
      const requested=body.presenterGender||j.revisionRequest?.presenterGender,currentProvider=videoProvider(s.env);
      if(!isWorkerVideoProvider(currentProvider)||!['male','female'].includes(requested))fail('Choose a male or female presenter and matching voice for the CPU worker replacement.');
      if(isWorkerVideoProvider(j.provider)&&j.provider===currentProvider)return await queueLocalReplacement(s,j,actor,requested);
      const parent=s.store.get(j.parentId),replacement=await queueWorkerVideo(s,parent,j.index,actor,currentProvider,requested);
      j.status='changes_requested';j.revisionRequest.status='replacement_started';j.revisionRequest.replacementId=replacement.id;s.save(j);return s.get(replacement.id);
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
      const parent=s.store.get(j.parentId),previous=[{avatar:j.avatar,voice:j.voice},...[...s.active].filter(id=>id!==j.id).map(id=>s.get(id))];
      let chosen;
      if(body.avatarId){
        if(!body.voiceId)fail('Choose the professional presenter and compatible voice together.');
        const avatar=s.avatars.get(body.avatarId)||presenterPool.avatars.find(a=>a.id===body.avatarId),voice=s.voices.get(body.voiceId)||presenterPool.voices.find(v=>v.id===body.voiceId);
        chosen={...professionalPresenter(avatar,voice),selection:{method:'reviewer_selected_professional_pair',poolVersion:presenterPool.version}};
      }else{
        chosen=choosePresenter(parent,j.index,s.list(),previous);
        if(body.voiceId){const requested=s.voices.get(body.voiceId)||presenterPool.voices.find(v=>v.id===body.voiceId);Object.assign(chosen,professionalPresenter(chosen.avatar,requested));}
      }
      assertFreshPresenterPair(chosen,s.list(),previous);
      const replacement={...structuredClone(j),id:randomUUID(),identity:hash([j.id,'requested_replacement',j.revisionRequest.at]),avatar:{...chosen.avatar},voice:{...chosen.voice},selection:{...chosen.selection,method:'reviewer_paid_replacement'},previousVideoId:j.id,generationVersion:(j.generationVersion||1)+1,created:now(),createdBy:actor,status:'prepared',stage:null,error:null,requests:{},files:{},reviews:[],reviewHistory:[],revisionRequest:null,delivery:null,outputRevision:1,authorization:null,automation:null};
      replacement.personaFit=professionalPresenter(replacement.avatar,replacement.voice).personaFit;
      s.save(replacement);j.status='changes_requested';j.revisionRequest.status='replacement_prepared';j.revisionRequest.replacementId=replacement.id;s.save(j);
      try{await s.start(replacement.id,'render',{acceptCost:true,acceptedEstimate:replacement.renderEstimate},actor);j.revisionRequest.status='replacement_started';s.save(j);}catch(e){replacement.error=e.message;s.save(replacement);}
      return s.get(replacement.id);
    }
    j.error='Feedback is waiting for a manual correction. Explicit layout controls do not require an AI API; free-text edits remain saved for an administrator to apply.';s.save(j);return j;
  }
}
