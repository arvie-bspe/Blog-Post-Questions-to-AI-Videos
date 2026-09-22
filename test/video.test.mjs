import {approveFixture} from './question-fixture.mjs';
import {recordQuestionReview} from '../src/question-approval.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../src/store.mjs';
import {VideoService,publicJob} from '../src/video-service.mjs';
import {HeyGen,mediaURL as heygenURL} from '../src/heygen.mjs';
import {prepare as prepareHeyGen,subtitles,requestBody,estimate} from '../src/heygen-domain.mjs';
import {prepare,approved,captions,scriptText} from '../src/video-domain.mjs';
import {Fal,mediaURL,queueURL} from '../src/fal.mjs';
import {mediaTools,presenterPath,compose} from '../src/media.mjs';
import {config,rulesHash} from '../src/rules.mjs';
import {parseClients,parseMonthly,selectClient,inspect} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {finishWorkerVideo} from '../src/local-video.mjs';
import {fixture} from './fixture-data.mjs';
function parent(store){
  const source=fixture('paul'),row=parseMonthly(fixture('monthly')).find(r=>r.documentId===source.documentId),client=selectClient(parseClients(fixture('clients')),row.clientKey),doc=inspect(source,row.titleHint);
  const j=store.create({identity:'test',doc,row,client,rulesHash,rulesVersion:config.version,mode:'saved_snapshot'});
  j.plan=preparedExample(doc);j.status='pilot_reviewed';j.origin='Prepared test fixture';j.reviews=[{actor:'Arvie',decision:'approve',note:'Automated fixture, not an actual human review.',at:'2026-09-14T00:00:00Z'}];approveFixture(j);store.save(j);return j;
}
const settings={index:0,voice:'am_michael',presenterAccepted:true,thumbnailTitle:'Support Letters for Your Appeal'};
test('video setup binds the exact approved script, presenter, source, and review',()=>{
  const dir=mkdtempSync(join(tmpdir(),'video-test-')),store=new Store(join(dir,'db'));
  try{const p=parent(store),j=prepare(p,settings,'asset');assert.equal(j.script,scriptText(p.plan.videos[0]));assert.equal(j.client.name,p.client.name);assert.equal(j.source.sourceHash,p.doc.sourceHash);assert.throws(()=>prepare(p,{...settings,presenterAccepted:false},'asset'),/presenter/);assert.throws(()=>prepare(p,{...settings,voice:'unapproved'},'asset'),/voice/);assert.throws(()=>approved(p),/specific question/);recordQuestionReview(p,0,{decision:'reject',note:'Test rejection'});assert.throws(()=>approved(p,0),/review/);assert.doesNotThrow(()=>approved(p,1));}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('caption timing requires every approved word and valid measured boundaries',()=>{
  const alignment={words:[{text:'What?',start:0,end:0.5},{text:' ',start:0.5,end:0.5},{text:'An',start:0.6,end:1},{text:'answer.',start:1,end:1.8}]};
  const cues=captions(alignment,'What?\n\nAn answer.','What?',2);assert.equal(cues[0].text,'WHAT?');assert.equal(cues[1].text,'An answer.');assert.equal(cues[1].start,0.6);
  assert.throws(()=>captions(alignment,'What? A different answer.','What?',2),/every word/);
  assert.throws(()=>captions(alignment,'What? An answer.','What?',1),/out-of-range/);
  assert.throws(()=>captions({words:[{text:'What?',start:1,end:0}]},'What?','What?',2),/timings/);
  const long='Preparing your financial documents and identifying every issue before the first session may reduce costs.';
  const timed=long.split(' ').map((text,i)=>({text,start:i*.3,end:i*.3+.25})),split=captions({words:timed},long,'Different question?',timed.at(-1).end+.1);
  assert.ok(split.length>=3);assert.ok(split.every(c=>c.text.length<=44));
});
test('fal credentials and downloads cannot be redirected to arbitrary hosts',async()=>{
  for(const u of ['http://fal.media/a','https://fal.media.evil.test/a','https://localhost/a','file:///etc/passwd','https://user:secret@fal.media/a','https://fal.media:444/a'])assert.throws(()=>mediaURL(u));
  assert.equal(mediaURL('https://v3.fal.media/file.wav'),'https://v3.fal.media/file.wav');assert.throws(()=>queueURL('https://evil.test/requests/abc','abc'));
  let called=0;const fal=new Fal(()=> 'test-secret',async(url,options)=>{called++;assert.equal(options.headers,undefined);return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});});
  await assert.rejects(fal.download('https://fal.media/a','unused',1000),/unexpected/);assert.equal(called,1);
});
test('real FFmpeg composition retains audio duration, captions, contacts, thumbnail, and 1080p output',async t=>{
  const tools=mediaTools();try{await tools.check();}catch{return t.skip('Install FFmpeg to run the real composition check.');}
  const dir=mkdtempSync(join(tmpdir(),'video-media-'));
  try{
    tools.analyzeVisual=async action=>{assert.equal(action,'scene_landscape');return {crop:{x:0,y:0,width:1280,height:720},safeCropX:{min:0,max:0},faceProtected:{left:.36,top:.12,right:.58,bottom:.42},texts:[],fixture:true};};
    await tools.run(['-f','lavfi','-i','sine=frequency=440:duration=3','-c:a','pcm_s16le','voice.wav'],dir);
    await tools.run(['-loop','1','-i',presenterPath,'-vf','scale=1280:720','-r','25','-t','3','-c:v','libx264','-pix_fmt','yuv420p','presenter.mp4'],dir);
    copyFileSync(presenterPath,join(dir,'logo.png'));
    const identity={name:'TEST CLIENT — TECHNICAL FIXTURE',address:'123 Example Street, Example City',phone:'(000) 000-0000'},j={duration:3,format:{aspectRatio:'16:9'},question:'What is this?',thumbnailTitle:'Video Composition Test Only',articleIdentity:identity,endCard:{targetUrl:'https://example.test/article'},source:{targetUrl:'https://example.test/article'},script:'Technical fixture only. Not a real voiceover.',logo:{screening:{relativeLuminance:.02}},cues:[{start:0,end:1,text:'WHAT IS THIS?',question:true},{start:1,end:3,text:'Technical fixture only. Not a real voiceover.',question:false}]};
    const qa=await compose(tools,dir,j);assert.equal(qa.passed,true);assert.equal(qa.fps,25);assert.equal(qa.sourceHeight,720);assert.equal(qa.native1080,false);assert.equal(qa.aspectRatio,'16:9');assert.equal(qa.logoIncluded,true);assert.equal(qa.endCardSeconds,3);assert.ok(qa.duration>j.duration+2.9);assert.ok(existsSync(join(dir,'thumbnail.png')));assert.ok(existsSync(join(dir,'end-card.png')));assert.match(readFileSync(join(dir,'captions.vtt'),'utf8'),/00:00:01.000/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

const avatar={id:'public_presenter',name:'TEST library presenter',type:'studio_avatar',gender:'male',supported_api_engines:['avatar_iv'],status:'completed'};
const voice={id:'public_voice',name:'TEST English voice',language:'English',gender:'male'};
const hgSettings={index:0,avatarId:avatar.id,voiceId:voice.id,presenterAccepted:true,thumbnailTitle:'Support Letters for Your Appeal'};
function shortParent(store){const j=parent(store);j.plan.videos.forEach(v=>v.sentences=v.sentences.slice(0,1));approveFixture(j);store.save(j);return j;}
function harness({heygen={},media={check:async()=>true},limit=2,env={HEYGEN_API_KEY:'fake-test-key'}}={}){
  const dir=mkdtempSync(join(tmpdir(),'heygen-test-')),store=new Store(join(dir,'db'));
  const provider={look:async()=>avatar,...heygen},service=new VideoService({store,env:{...env,DAILY_VIDEO_LIMIT:String(limit)},dataDir:dir,checkFresh:async()=>{},local:true,media,logos:{acquire:async()=>({path:presenterPath,domain:'test.example',hash:'fixture-logo',screening:{relativeLuminance:.02}})},delivery:{deliver:async(job,dir,save)=>{job.status='delivered';save(job);}},heygen:provider});
  service.avatars.set(avatar.id,avatar);service.voices.set(voice.id,voice);
  return {dir,store,service,parent:shortParent(store),close(){service.closed=true;store.close();rmSync(dir,{recursive:true,force:true});}};
}
const idle=async(service,id)=>{for(let i=0;i<200&&service.active.has(id);i++)await new Promise(r=>setTimeout(r,10));assert.equal(service.active.has(id),false);};

test('mismatched manual profiles and saved setups cannot consume the daily allowance or call HeyGen',async()=>{
 const h=harness();try{
  const female={...voice,id:'female_fixture',gender:'female'};h.service.voices.set(female.id,female);
  assert.throws(()=>h.service.automation.configure(h.parent.id,{enabled:true,avatarId:avatar.id,voiceId:female.id,acceptCost:true,maxEstimatedCost:2},'Arvie'),/GENDER_MISMATCH/);
  await assert.rejects(h.service.create(h.parent.id,{...hgSettings,voiceId:female.id},'Arvie'),/GENDER_MISMATCH/);
  const j=await h.service.create(h.parent.id,hgSettings,'Arvie'),saved=h.service.get(j.id);saved.voice=female;h.service.save(saved);
  await assert.rejects(h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:2},'Arvie'),/GENDER_MISMATCH/);
  assert.deepEqual(h.service.get(j.id).requests,{});assert.equal(h.store.db.prepare('SELECT count(*) AS n FROM video_spend').get().n,0);
 }finally{h.close();}
});

test('LiteAvatar selection blocks every HeyGen spend path and routes historical live Google approvals to the CPU worker',async()=>{
  let providerCalls=0;const queued=[],h=harness({env:{HEYGEN_API_KEY:'still-present-but-disabled',VIDEO_PROVIDER:'liteavatar_worker',STUDIO_WORKER_TOKEN:'worker-secret'.padEnd(32,'x')},heygen:{looks:async()=>{providerCalls++;return {data:[]};},submit:async()=>{providerCalls++;throw new Error('HeyGen must not be called.');}}});
  try{
    h.parent.mode='live_google';h.store.save(h.parent);h.service.tasks={enqueue:task=>{queued.push(task);return {id:'liteavatar-task-'+queued.length,status:'queued'};}};
    await assert.rejects(h.service.library('avatars'),/HeyGen API generation is disabled/);
    await assert.rejects(h.service.create(h.parent.id,hgSettings,'Arvie'),/HeyGen API generation is disabled/);
    const legacy={...prepareHeyGen(h.parent,hgSettings,avatar,voice),id:'historical-heygen-ready',identity:'historical-heygen-ready',created:new Date().toISOString(),status:'prepared'};h.service.save(legacy);
    await assert.rejects(h.service.start(legacy.id,'render',{acceptCost:true,acceptedEstimate:legacy.renderEstimate},'Arvie'),/HeyGen API generation is disabled/);
    h.service.automation.enqueue(h.parent.id,'Keziah',0);
    let run;for(let i=0;i<100;i++){run=h.service.automation.view(h.parent.id).lastRun;if(run?.status==='submitted')break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(run?.status,'submitted',run?.error);assert.equal(queued.length,1);assert.equal(queued[0].type,'media_liteavatar');
    const generated=h.service.get(run.videos[0]);assert.equal(generated.provider,'liteavatar_worker');assert.equal(generated.renderEstimate,0);assert.equal(providerCalls,0);
  }finally{h.close();}
});

test('self-hosted composition failures remain visible and saved footage can be resumed without another worker render',async()=>{
  const h=harness({env:{VIDEO_PROVIDER:'liteavatar_worker',STUDIO_WORKER_TOKEN:'worker-secret'.padEnd(32,'x')}});try{
    const j={id:'worker-composition',identity:'worker-composition',parentId:h.parent.id,provider:'liteavatar_worker',status:'compositing',stage:'compositing',files:{original:true,voice:true},requests:{liteavatar:{id:'completed-worker-task',state:'completed'}},reviews:[]};h.service.save(j);
    h.service.compose=async()=>{throw new Error('SOURCE_FRAMING_INCOMPATIBLE: fixture failure.');};
    await assert.rejects(finishWorkerVideo(h.service,j),/fixture failure/);assert.equal(h.service.get(j.id).status,'needs_attention');assert.match(h.service.get(j.id).error,/fixture failure/);
    h.service.compose=async()=>({passed:true,framingMode:'portrait_source_side_crop'});h.service.validate=async()=>{};j.status='compositing';j.error=null;h.service.save(j);h.service.resumeWorkerComposition(j);await idle(h.service,j.id);
    const completed=h.service.get(j.id);assert.equal(completed.status,'visual_review');assert.equal(completed.files.video,true);assert.equal(completed.error,null);
  }finally{h.close();}
});

test('HeyGen request binds approved text and public presenter without an image or separate voice request',()=>{
  const h=harness();try{
    const j=prepareHeyGen(h.parent,hgSettings,avatar,voice);j.id='test-uuid';const body=requestBody(j);
    assert.equal(body.script,scriptText(h.parent.plan.videos[0]));assert.equal(body.avatar_id,avatar.id);assert.equal(body.voice_id,voice.id);assert.equal(body.engine.type,'avatar_iv');
    assert.equal(body.resolution,'1080p');assert.equal(body.aspect_ratio,'auto');assert.equal(body.fit,'contain');assert.equal(j.format.aspectRatio,'9:16');assert.equal(j.sourceFraming.version,'preserve-source-1');assert.equal(body.image_url,undefined);assert.equal(body.audio_url,undefined);assert.equal(body.caption.style,undefined);
    assert.equal(estimate('studio_avatar'),2);assert.equal(estimate('photo_avatar'),1.5);
    const landscape=prepareHeyGen(h.parent,{...hgSettings,aspectRatio:'16:9'},avatar,voice);assert.deepEqual(landscape.format,{width:1920,height:1080,aspectRatio:'16:9'});assert.notEqual(landscape.identity,j.identity);
    assert.throws(()=>prepareHeyGen(h.parent,{...hgSettings,aspectRatio:'1:1'},avatar,voice),/portrait 9:16 or landscape 16:9/);
    assert.throws(()=>prepareHeyGen(h.parent,hgSettings,null,voice),/library/);
    assert.throws(()=>prepareHeyGen(h.parent,hgSettings,{...avatar,type:'photo_avatar'},voice),/Photo Avatars are disabled/);
    const longer=structuredClone(h.parent);longer.plan.videos[0].sentences=Array(8).fill(longer.plan.videos[0].sentences[0]);approveFixture(longer,0);assert.throws(()=>prepareHeyGen(longer,hgSettings,avatar,voice),/content checks/);
    longer.plan.videos[0].runtimeReason='Test fixture only. Additional source qualifications require this extra explanation.';longer.scriptTargetSeconds=60;approveFixture(longer,0);const minute=prepareHeyGen(longer,hgSettings,avatar,voice);assert.equal(minute.targetSeconds,60);assert.ok(minute.renderEstimate>2);
  }finally{h.close();}
});

test('HeyGen API authenticates only fixed API host and sends a stable idempotency key',async()=>{
  let calls=0;const provider=new HeyGen(()=> 'fake-test-key',async(url,options)=>{
    calls++;assert.equal(url,'https://api.heygen.com/v3/videos');assert.equal(options.redirect,'error');assert.equal(options.headers['x-api-key'],'fake-test-key');assert.equal(options.headers['Idempotency-Key'],'stable-id');
    return Response.json({data:{video_id:'v_example',status:'waiting'}});
  });assert.equal((await provider.submit({type:'avatar'},'stable-id')).id,'v_example');assert.equal(calls,1);
  for(const url of ['https://heygen.ai.evil.test/x','http://files.heygen.ai/x','https://user:password@files.heygen.ai/x','https://127.0.0.1/x','https://files.heygen.ai:444/x'])assert.throws(()=>heygenURL(url));
  const redirects=new HeyGen(()=> 'secret',async(url,options)=>{assert.equal(options.headers,undefined);return new Response(null,{status:302,headers:{location:'http://localhost/private'}});});
  await assert.rejects(redirects.bytes('https://files.heygen.ai/preview',100),/unexpected/);
  const overflow=new HeyGen(()=> 'secret',async()=>new Response('too much data'));await assert.rejects(overflow.bytes('https://files.heygen.ai/preview',3),/limit/);
});

test('public library validates engine availability and preserves paging without exposing provider asset URLs',async()=>{
  const calls=[],h=harness({heygen:{looks:async(type,token)=>{calls.push([type,token]);return {data:[{...avatar,preview_image_url:'https://files.heygen.ai/test.jpg'},{id:'unsupported',supported_api_engines:['avatar_v']}],has_more:true,next_token:'next-page'};},voices:async()=>({data:[{voice_id:voice.id,name:voice.name,language:'English',preview_audio_url:'https://files.heygen.ai/test.mp3'}]})}});
  try{const page=await h.service.library('avatars','studio_avatar');assert.equal(page.items.length,1);assert.equal(page.nextToken,'next-page');assert.match(page.items[0].preview,/^\/api\/video-preview/);assert.equal(page.items[0].previewURL,undefined);await h.service.library('avatars','studio_avatar');assert.equal(calls.length,1);await assert.rejects(h.service.library('avatars','photo_avatar','next-page'),/Photo Avatars/);await h.service.library('avatars','studio_avatar','next-page');assert.deepEqual(calls[1],['studio_avatar','next-page']);assert.equal((await h.service.library('voices')).items[0].id,voice.id);await assert.rejects(h.service.library('avatars','private'),/Studio Avatar/);}finally{h.close();}
});

test('library skips older-engine-only pages and caches the first compatible result',async()=>{
  const calls=[],h=harness({heygen:{looks:async(type,token)=>{calls.push(token);return token==='second'?{data:[avatar],has_more:true,next_token:'third'}:{data:[{id:'old',supported_api_engines:['avatar_iii']}],has_more:true,next_token:token==='first'?'second':'first'};}}});
  try{const page=await h.service.library('avatars');assert.deepEqual(calls,['','first','second']);assert.equal(page.items[0].id,avatar.id);assert.equal(page.nextToken,'third');await h.service.library('avatars');assert.equal(calls.length,3);}finally{h.close();}
});

test('SRT validation checks every word, timing bounds and uppercase question without inventing word timing',()=>{
  const srt='1\n00:00:00,000 --> 00:00:01,500\nWhat is this? A test.\n\n2\n00:00:01,500 --> 00:00:03,000\nIt works.';
  const cues=subtitles(srt,'What is this? A test. It works.','What is this?',3);
  assert.equal(cues[0].text,'What is this? A test.');assert.equal(cues[0].end,1.5);assert.equal(cues[1].start,1.5);
  assert.throws(()=>subtitles(srt,'What is this? An invented test. It works.','What is this?',3),/every word/);
  assert.throws(()=>subtitles(srt,'What is this? A test. It works.','What is this?',2),/timing/);
  assert.throws(()=>subtitles(srt.replace('00:00:01,500 -->','00:00:00,900 -->'),'What is this? A test. It works.','What is this?',3),/overlap/);
});

test('HeyGen refuses unaccepted and legacy spending; repeated setup is free and idempotent for members',async()=>{
  const h=harness();try{
    const j=await h.service.create(h.parent.id,hgSettings,'Arvie');assert.equal((await h.service.create(h.parent.id,hgSettings,'Macy')).id,j.id);
    await assert.rejects(h.service.start(j.id,'render',{acceptCost:false,acceptedEstimate:2},'Arvie'),/estimate/);
    await assert.rejects(h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:1.5},'Arvie'),/estimate/);
    const legacy=h.service.get(j.id);delete legacy.provider;h.service.save(legacy);
    await assert.rejects(h.service.start(j.id,'speech',{acceptCost:true},'Arvie'),/saved fal.ai/);assert.equal(publicJob(legacy).legacy,true);
  }finally{h.close();}
});

test('unknown HeyGen submission survives restart and cannot buy a duplicate; daily cap includes uncertainty',async()=>{
  let submits=0;const h=harness({limit:1,heygen:{submit:async()=>{submits++;throw new Error('Connection lost');}}});
  try{
    const j=await h.service.create(h.parent.id,hgSettings,'Arvie');await h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:2},'Arvie');await idle(h.service,j.id);
    assert.equal(h.service.get(j.id).status,'needs_reconciliation');assert.equal(h.service.get(j.id).requests.video.idempotencyKey,j.id);assert.equal(submits,1);
    h.service.closed=true;const restarted=new VideoService({store:h.store,env:{HEYGEN_API_KEY:'fake',DAILY_VIDEO_LIMIT:'1'},dataDir:h.dir,checkFresh:async()=>{},local:true,media:{check:async()=>true},heygen:{look:async()=>avatar}});
    try{await assert.rejects(restarted.start(j.id,'resume',{},'Arvie'),/cannot be resumed/);assert.equal(submits,1);}finally{restarted.closed=true;}
    const next=await h.service.create(h.parent.id,{...hgSettings,index:1},'Arvie');h.service.closed=false;await assert.rejects(h.service.start(next.id,'render',{acceptCost:true,acceptedEstimate:2},'Arvie'),/daily/);assert.equal(submits,1);
  }finally{h.close();}
});

test('resume polls the existing HeyGen ID, while changed approval blocks spending',async()=>{
  let submits=0,statusCalls=0;const h=harness({heygen:{submit:async()=>{submits++;},status:async id=>{assert.equal(id,'existing');statusCalls++;return {status:'completed',video_url:'https://files.heygen.ai/test.mp4'};}}});
  try{const j=await h.service.create(h.parent.id,hgSettings,'Arvie'),saved=h.service.get(j.id);saved.requests.video={id:'existing',state:'processing'};h.service.save(saved);assert.equal((await h.service.queued(saved)).status,'completed');assert.equal(submits,0);assert.equal(statusCalls,1);recordQuestionReview(h.parent,0,{decision:'reject',note:'Reject only this question.'});h.store.save(h.parent);await assert.rejects(h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:2},'Arvie'),/review/);assert.equal(submits,0);}finally{h.close();}
});

test('cropped source gets one free corrected setup; resuming cannot repeat the failed assembly or spend',async()=>{
  let submits=0;const h=harness({heygen:{submit:async()=>{submits++;}}});
  try{
    const old={...prepareHeyGen(h.parent,hgSettings,avatar,voice),id:'cropped-source',identity:'old-portrait-cover',status:'paused',error:'SOURCE_FRAMING_INCOMPATIBLE: source edges missing.',files:{original:true,voice:true},requests:{video:{id:'already-paid',state:'completed'}}};
    delete old.sourceFraming;h.service.save(old);const before=h.service.get(old.id);
    await assert.rejects(h.service.start(old.id,'resume',{},'Macy'),/cannot restore missing edges/);
    const fixed=await h.service.revisions.replaceFraming(old.id,'Keziah');
    assert.equal((await h.service.revisions.replaceFraming(old.id,'Macy')).id,fixed.id);
    assert.equal(fixed.status,'prepared');assert.equal(fixed.sourceFraming.aspectRatio,'auto');assert.equal(fixed.sourceFraming.fit,'contain');assert.equal(fixed.format.aspectRatio,'9:16');
    assert.equal(fixed.script,old.script);assert.deepEqual(fixed.avatar,old.avatar);assert.deepEqual(fixed.voice,old.voice);assert.deepEqual(fixed.requests,{});assert.equal(fixed.authorization,undefined);
    assert.deepEqual(h.service.get(old.id),before);assert.equal(submits,0);
    await assert.rejects(h.service.start(fixed.id,'render',{acceptCost:false},'Arvie'),/estimate/);assert.equal(submits,0);
  }finally{h.close();}
});

test('output beyond the processing allowance is retained for inspection and never cut or purchased twice',async()=>{
  let submits=0;const h=harness({media:{check:async()=>true,probe:async()=>({format:{duration:'181'},streams:[{codec_type:'audio'},{codec_type:'video'}]})},heygen:{submit:async()=>{submits++;return {id:'v_long',state:'waiting'};},status:async()=>({status:'completed',video_url:'https://files.heygen.ai/long.mp4'}),download:async(url,path)=>writeFileSync(path,'test fixture only')}});
  try{const j=await h.service.create(h.parent.id,hgSettings,'Arvie');await h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:2},'Macy');await idle(h.service,j.id);const result=h.service.get(j.id);assert.equal(result.status,'needs_attention');assert.equal(result.files.original,true);assert.equal(result.files.video,undefined);assert.equal(submits,1);await assert.rejects(h.service.start(j.id,'resume',{},'Macy'),/cannot be resumed/);}finally{h.close();}
});

test('missing HeyGen key never falls back to an existing fal key',async()=>{
  const h=harness({env:{FAL_KEY:'old-fal-key'}});try{assert.equal((await h.service.catalog()).configured,false);await assert.rejects(h.service.library('avatars'),/HEYGEN_API_KEY/);const j=await h.service.create(h.parent.id,hgSettings,'Arvie');await assert.rejects(h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:2},'Arvie'),/HEYGEN_API_KEY/);assert.equal(h.service.get(j.id).status,'prepared');}finally{h.close();}
});


test('one mocked HeyGen generation automatically assembles real media then waits for Macy review',async t=>{
  if(!process.env.LOGO_CHROMIUM_PATH)return t.skip('Set LOGO_CHROMIUM_PATH for the local Chromium composition check.');
  const media=mediaTools();try{await media.check();}catch{return t.skip('FFmpeg required.');}
  // This test isolates composition/review with a gray synthetic clip. Real face tracking is checked separately.
  media.analyzeVisual=async()=>({crop:{x:0,y:0,width:1080,height:1920},faceProtected:{left:.3,top:.12,right:.6,bottom:.4},texts:[],fixture:true});
  let submits=0,spoken='';const h=harness({media});
  try{
    await media.run(['-f','lavfi','-i','color=c=gray:s=1080x1920:r=25:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','raw.mp4'],h.dir);
    h.service.heygen={look:async()=>avatar,submit:async(input,key)=>{submits++;spoken=input.script;assert.ok(key);assert.equal(input.image_url,undefined);return {id:'v_mock',state:'waiting'};},status:async()=>({status:'completed',video_url:'https://files.heygen.ai/mock.mp4',subtitle_url:'https://files.heygen.ai/mock.srt'}),download:async(url,path)=>copyFileSync(join(h.dir,'raw.mp4'),path),bytes:async()=>{
      const words=spoken.split(/\s+/),groups=[];for(let i=0;i<words.length;i+=7)groups.push(words.slice(i,i+7).join(' '));
      const stamp=n=>'00:00:'+Math.floor(n/1000).toString().padStart(2,'0')+','+(n%1000).toString().padStart(3,'0');
      return {body:Buffer.from(groups.map((g,i)=>`${i+1}\n${stamp(Math.round(i*3000/groups.length))} --> ${stamp(Math.round((i+1)*3000/groups.length))}\n${g}`).join('\n\n'))};
    }};
    const j=await h.service.create(h.parent.id,hgSettings,'Arvie');await h.service.start(j.id,'render',{acceptCost:true,acceptedEstimate:2},'Arvie');
    for(let i=0;i<1200&&h.service.active.has(j.id);i++)await new Promise(r=>setTimeout(r,25));
    const result=h.service.get(j.id);assert.equal(result.status,'visual_review',result.error);assert.equal(submits,1);assert.equal(result.technicalQA.native1080,true);assert.equal(result.technicalQA.aspectRatio,'9:16');assert.equal(result.technicalQA.logoIncluded,true);assert.equal(result.technicalQA.logoBackground.color,'#FFFFFF');assert.equal(result.technicalQA.logoBackground.tone,'light');assert.equal(result.files.video,true);assert.equal(result.files.captions,true);assert.equal(result.source.folderUrl,h.parent.row.folderUrl);assert.ok(existsSync(join(h.service.directory(result),'thumbnail.png')));
    await assert.rejects(h.service.review(j.id,{decision:'approve',note:'Test approval without checks'},'Macy'),/Check lips/);
    const revised=await h.service.review(j.id,{decision:'reject',note:'Automated fixture: increase caption size for readability.',changeType:'layout',visualSettings:{captionSize:64,captionBottom:115,logoScale:1}},'Macy');assert.equal(revised.status,'compositing');
    for(let i=0;i<1200&&h.service.active.has(j.id);i++)await new Promise(r=>setTimeout(r,25));
    const afterRevision=h.service.get(j.id);assert.equal(afterRevision.status,'visual_review',afterRevision.error);assert.equal(afterRevision.outputRevision,2);assert.equal(afterRevision.reviews.length,0);assert.equal(afterRevision.reviewHistory.length,1);assert.equal(submits,1);assert.ok(existsSync(join(h.service.directory(afterRevision),'revisions','1','final.mp4')));
    assert.ok(['delivery_pending','delivered'].includes((await h.service.review(j.id,{decision:'approve',note:'AUTOMATED FIXTURE ONLY, not human quality acceptance.',checkedVideo:true,checkedCaptions:true,checkedContacts:true,checkedFraming:true,checkedNoNap:true,checkedEndCard:true},'Macy')).status));await idle(h.service,j.id);assert.equal(h.service.get(j.id).status,'delivered');assert.equal(submits,1);
  }finally{h.close();}
});


test('Macy free-text requests remain pending and script requests return to content review',async()=>{
  const h=harness();try{
    const j=await h.service.create(h.parent.id,hgSettings,'Arvie'),saved=h.service.get(j.id);saved.status='visual_review';saved.files.video=true;saved.detectorVersion=config.video.faceDetectorVersion;h.service.save(saved);
    await h.service.review(j.id,{decision:'reject',note:'Please make the answer easier to understand.'},'Macy');assert.equal(h.service.get(j.id).status,'revision_pending');assert.match(h.service.get(j.id).error,/manual correction/);
    let handedOff;h.service.onScriptChanges=async(id,note)=>{handedOff={id,note};};await h.service.revisions.apply(j.id,{changeType:'script'},'Macy');assert.equal(handedOff.id,h.parent.id);assert.match(handedOff.note,/easier/);assert.equal(h.store.get(h.parent.id).status,'partially_reviewed');
  }finally{h.close();}
});
test('Macy paid replacement requires cost acceptance and preserves the older video',async()=>{
  let submits=0;const h=harness({heygen:{submit:async()=>{submits++;return {id:'mock-replacement',state:'waiting'};},status:async()=>({status:'completed'})}});
  try{
    const initial=await h.service.create(h.parent.id,hgSettings,'Arvie'),saved=h.service.get(initial.id);saved.status='visual_review';saved.files.video=true;saved.detectorVersion=config.video.faceDetectorVersion;h.service.save(saved);
    await assert.rejects(h.service.review(initial.id,{decision:'reject',note:'The speaking motion needs another render.',changeType:'render'},'Macy'),/cost/);assert.equal(submits,0);
    const next=await h.service.review(initial.id,{decision:'reject',note:'The speaking motion needs another render.',changeType:'render',acceptCost:true,acceptedEstimate:2},'Macy');await idle(h.service,next.id);assert.notEqual(next.id,initial.id);assert.equal(h.service.get(next.id).previousVideoId,initial.id);assert.equal(h.service.get(initial.id).status,'changes_requested');assert.equal(submits,1);
    await assert.rejects(h.service.review(initial.id,{decision:'reject',note:'The speaking motion needs another render.',changeType:'render',acceptCost:true,acceptedEstimate:2},'Macy'),/completed render/);assert.equal(submits,1);
  }finally{h.close();}
});
