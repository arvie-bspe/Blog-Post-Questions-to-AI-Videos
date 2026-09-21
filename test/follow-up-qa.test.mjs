import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../src/server.mjs';
import {questionHash,recordQuestionReview,assertSourceAudit,approvedQuestion} from '../src/question-approval.mjs';
import {prepareWorkerVideo,retryWorkerVideo} from '../src/local-video.mjs';
import {presenterGender,permittedPresenterGender} from '../src/article-identity.mjs';
import {directMode,scriptPolicyHash} from '../src/workflow-config.mjs';
import {appearanceRulesHash,rulesHash,config} from '../src/rules.mjs';
import {mountVideo} from '../public/video-ui.js';
import {scriptText} from '../src/video-domain.mjs';

function source(identity){
  const doc={sourceHash:'qa-source',questionSelectionMode:'ai_independent',paragraphs:[
    {id:'p1',style:'NORMAL_TEXT',text:'The firm files the form electronically. Filing uses the court portal.'},
    {id:'p2',style:'NORMAL_TEXT',text:'Example Law Firm'},
    {id:'p3',style:'NORMAL_TEXT',text:'123 Main Street'},
    {id:'p4',style:'NORMAL_TEXT',text:'(555) 010-0200'},
    {id:'p5',style:'NORMAL_TEXT',text:'Jordan is a woman admitted to the state bar who specializes in appeals.'}
  ]};
  const plan={articleIdentity:{name:'Example Law Firm',address:'123 Main Street',phone:'(555) 010-0200',evidence:[{field:'name',paragraphId:'p2',quote:'Example Law Firm'},{field:'address',paragraphId:'p3',quote:'123 Main Street'},{field:'phone',paragraphId:'p4',quote:'(555) 010-0200'}]},presenterContext:{gender:'female',lawyerBlurbParagraphIds:['p5']},videos:[{candidateId:'q1',question:'How does filing work?',reason:'A useful procedural explanation.',thumbnailTitle:'How Filing Works',selectionKind:'formulated_source',supportingParagraphIds:['p1'],runtimeReason:'',sentences:[{text:'The firm files the form electronically.',evidence:[{paragraphId:'p1',quote:'The firm files the form electronically.'}]}],cta:'',disclaimer:'',reviewFlags:[]}],skipped:[]};
  return {identity,mode:directMode,scriptRulesHash:scriptPolicyHash,rulesHash,appearanceRulesHash,doc,plan,row:{documentUrl:'https://docs.google.com/document/d/qa-synthetic/edit',pageUrl:'https://example.test/article',folderUrl:'https://drive.google.com/drive/folders/qa-folder'},client:{key:'Example',name:'Example Law Firm',homepage:'https://example.test'},setupIssues:[],questionReviews:[],reviews:[],status:'content_review',origin:'Local Codex worker draft with source audit',auditRequired:true,audit:{passed:true,issues:[]}};
}
function appFor(t){
  const dir=mkdtempSync(join(tmpdir(),'follow-up-qa-'));
  const app=createApp({HOST:'127.0.0.1',PORT:'4199',APP_ORIGIN:'http://127.0.0.1:4199',DATA_DIR:dir,VIDEO_PROVIDER:'liteavatar_worker',AI_PROVIDER:'codex_worker',STUDIO_WORKER_TOKEN:'synthetic-qa-worker-token-only',DAILY_ANALYSIS_LIMIT:'100'});
  app.scripts.checkFresh=async()=>{};app.video.checkFresh=async()=>{};app.video.ensureLogo=async()=>{};
  t.after(()=>{app.video.closed=true;app.store.close();rmSync(dir,{recursive:true,force:true});});
  return app;
}
const approve=job=>{recordQuestionReview(job,0,{actor:'QA Reviewer',decision:'approve',note:'Synthetic source evidence checked.',at:new Date().toISOString()});return job;};
const result=(plan,passed=true)=>({plan:structuredClone(plan),audit:{passed,issues:passed?[]:['Synthetic unresolved source concern.']}});
const claim=app=>app.tasks.claim({workerId:'qa-worker',types:['ai_codex']});

test('full drafts and scoped rewrites remove repeated openings before saving review hashes',async t=>{
  const app=appFor(t),job=app.store.create(source('title-once')),plan=structuredClone(job.plan),answer=plan.videos[0].sentences[0].text;
  plan.videos[0].sentences[0].text=plan.videos[0].question+' '+answer;
  for(const index of [undefined,0]){
    await app.scripts.startDirect(job.id,'Keep the title once and preserve the answer.',index);
    const task=claim(app);await app.tasks.complete(task.id,task.leaseToken,result(plan));
    const current=app.store.get(job.id);assert.equal(current.plan.videos[0].sentences[0].text,answer);
    assert.equal(current.questionReviews?.some(review=>review.draftHash===questionHash(current,0)),false);
    if(index===0)assert.equal(current.questionAudits[0].draftHash,questionHash(current,0));
    assert.doesNotThrow(()=>approvedQuestion(approve(current),0));
    assert.equal(scriptText(current.plan.videos[0]),plan.videos[0].question+'\n\n'+answer);
  }
});

test('full redraft invalidates old question audits, but a later scoped repair can approve',async t=>{
  const app=appFor(t),job=app.store.create(source('stale-audit')),plan=structuredClone(job.plan);
  await app.scripts.startDirect(job.id,'Check the question evidence.',0);
  let task=claim(app);await app.tasks.complete(task.id,task.leaseToken,result(plan));
  assert.equal(app.store.get(job.id).questionAudits[0].passed,true);
  await app.scripts.startDirect(job.id,'Draft the whole article again.');
  task=claim(app);await app.tasks.complete(task.id,task.leaseToken,result(plan,false));
  let current=app.store.get(job.id);
  assert.equal(current.status,'needs_review');assert.equal(current.audit.passed,false);
  assert.throws(()=>assertSourceAudit(current,0),/audit/);
  approve(current);
  assert.throws(()=>approvedQuestion(current,0),/audit/);
  assert.throws(()=>prepareWorkerVideo(current,0,'liteavatar_worker'),/audit/);
  await app.scripts.startDirect(job.id,'Resolve the latest source concern.',0);
  task=claim(app);await app.tasks.complete(task.id,task.leaseToken,result(plan));
  current=approve(app.store.get(job.id));
  assert.doesNotThrow(()=>approvedQuestion(current,0));
  assert.doesNotThrow(()=>prepareWorkerVideo(current,0,'liteavatar_worker'));
});

test('a second in-progress rewrite is rejected without replacing its request or consuming usage',async t=>{
  const app=appFor(t),job=app.store.create(source('overlap'));
  await app.scripts.startDirect(job.id,'First requested correction.',0);
  const before=app.store.get(job.id),usage=app.store.db.prepare('SELECT count FROM usage').get().count;
  await assert.rejects(app.scripts.startDirect(job.id,'Second overlapping correction.',0),/already|running|progress/i);
  assert.deepEqual(app.store.get(job.id),before);
  assert.equal(app.store.db.prepare('SELECT count FROM usage').get().count,usage);
  assert.equal(app.tasks.list(job.id+':question:0').length,1);
});

for(const outcome of ['success','invalid-result','failure'])test(`obsolete rewrite ${outcome} cannot mutate a newer saved request`,async t=>{
  const app=appFor(t),job=app.store.create(source('obsolete-'+outcome));
  await app.scripts.startDirect(job.id,'First requested correction.',0);
  const older=claim(app),current=app.store.get(job.id);
  // Recreate a pair already queued by the old application before this fix.
  const newer=app.scripts.directResolver.submit(current,{index:0,draftHash:questionHash(current,0),feedback:'Newer requested correction.',maxVideos:1,attemptToken:2,requestId:'newer-request'}).task;
  current.questionRequests[0]={...current.questionRequests[0],taskId:newer.id,requestId:'newer-request',attempt:2,status:'working',error:'Preserve current error until current task finishes.'};app.store.save(current);
  const newerClaim=claim(app);assert.equal(newerClaim.id,newer.id);
  const before=app.store.get(job.id);
  if(outcome==='failure')app.tasks.fail(older.id,older.leaseToken,'Obsolete failure',false);
  else{
    const oldResult=result(job.plan);oldResult.plan.videos[0].thumbnailTitle='Older Filing Answer';
    await app.tasks.complete(older.id,older.leaseToken,outcome==='invalid-result'?{}:oldResult);
  }
  assert.deepEqual(app.store.get(job.id),before);
  assert.ok(app.tasks.get(older.id).appliedAt);
  const newResult=result(job.plan);newResult.plan.videos[0].thumbnailTitle='Current Filing Answer';
  await app.tasks.complete(newer.id,newerClaim.leaseToken,newResult);
  const finished=app.store.get(job.id);
  assert.equal(finished.plan.videos[0].thumbnailTitle,'Current Filing Answer');
  assert.equal(finished.questionRequests[0].status,'applied');
  assert.equal(finished.questionRequests[0].error,null);
  assert.equal(finished.questionAudits[0].passed,true);
});

test('a scoped result from before a full redraft cannot restore an obsolete passing audit',async t=>{
  const app=appFor(t),job=app.store.create(source('old-scope-new-full'));
  await app.scripts.startDirect(job.id,'Old scoped request.',0);const oldTask=claim(app);
  await app.scripts.startDirect(job.id,'New whole-article request.');const fullTask=claim(app);
  await app.tasks.complete(fullTask.id,fullTask.leaseToken,result(job.plan,false));
  const before=app.store.get(job.id);
  await app.tasks.complete(oldTask.id,oldTask.leaseToken,result(job.plan));
  assert.deepEqual(app.store.get(job.id),before);assert.throws(()=>assertSourceAudit(before,0),/audit/);
});

for(const outcome of ['success','failure'])test(`obsolete promise-provider ${outcome} cannot mutate a new full draft`,async t=>{
  const app=appFor(t),job=app.store.create(source('promise-'+outcome)),pending=[];
  app.scripts.directResolver={configured:()=>true,provider:()=> 'claude',submit:()=>({promise:new Promise((resolve,reject)=>pending.push({resolve,reject}))})};
  await app.scripts.startDirect(job.id,'Old scoped promise.',0);
  await app.scripts.startDirect(job.id,'New full draft promise.');
  pending[1].resolve(result(job.plan,false));await new Promise(setImmediate);
  const before=app.store.get(job.id);assert.equal(before.audit.passed,false);
  if(outcome==='success')pending[0].resolve(result(job.plan));else pending[0].reject(new Error('Obsolete provider error.'));
  await new Promise(setImmediate);assert.deepEqual(app.store.get(job.id),before);
});

test('prepared worker recovery UI uses the worker retry endpoint instead of HeyGen render',async t=>{
  const app=appFor(t),parent=app.store.create(approve(source('worker-retry-ui'))),saved=prepareWorkerVideo(parent,0,'liteavatar_worker');
  saved.currentApproval=true;const calls=[],listeners=new Map(),previousDocument=globalThis.document;
  const root={isConnected:true,innerHTML:'',querySelectorAll:()=>[],querySelector:selector=>selector==='#retry-worker'&&root.innerHTML.includes('id="retry-worker"')?{addEventListener:(event,fn)=>listeners.set(event,fn)}:null};
  globalThis.document={querySelector:()=>root};t.after(()=>{root.isConnected=false;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
  const api=async(path,body)=>{
    if(path==='video-config')return {...config.video,provider:'liteavatar_worker',configured:true,appearanceRulesHash};
    if(path===`jobs/${parent.id}/videos`)return [saved];
    if(path===`jobs/${parent.id}/video-automation`)return {runs:[]};
    calls.push({path,body});return saved;
  };
  await mountVideo(parent,api,message=>assert.fail(message),{name:'QA Reviewer'});
  assert.match(root.innerHTML,/Retry this saved video/);assert.doesNotMatch(root.innerHTML,/id="render-video"/);
  assert.ok(listeners.has('click'));await listeners.get('click')();
  assert.deepEqual(calls,[{path:`videos/${saved.id}/retry-worker`,body:{}}]);
});

test('missing approved video UI starts exactly the absent automatic run',async t=>{
  const app=appFor(t),parent=app.store.create(approve(source('missing-approved-ui'))),calls=[],previousDocument=globalThis.document;
  let startButton=null;const root={isConnected:true,innerHTML:'',querySelector:()=>null,querySelectorAll:selector=>{
    if(selector==='[data-start-approved]'&&root.innerHTML.includes('data-start-approved="0"')){startButton={dataset:{startApproved:'0'},onclick:null};return [startButton];}
    return [];
  }};
  globalThis.document={querySelector:()=>root};t.after(()=>{root.isConnected=false;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
  const missing={index:0,question:parent.plan.videos[0].question};
  const api=async(path,body)=>{
    if(path==='video-config')return {...config.video,provider:'liteavatar_worker',configured:true,appearanceRulesHash};
    if(path===`jobs/${parent.id}/videos`)return [];
    if(path===`jobs/${parent.id}/video-automation`&&body===undefined)return {runs:[],missingApproved:[missing]};
    calls.push({path,body});return {runs:[{index:0,status:'queued'}],missingApproved:[]};
  };
  await mountVideo(parent,api,message=>assert.fail(message),{name:'QA Reviewer'});
  assert.match(root.innerHTML,/approved, but automatic generation has not started/);assert.ok(startButton?.onclick);
  await startButton.onclick();
  assert.deepEqual(calls,[{path:`jobs/${parent.id}/video-automation`,body:{action:'start-approved',index:0}}]);
});

for(const changeType of ['render','gender'])test(`${changeType} replacement recovers from logo failure using the same saved video`,async t=>{
  const app=appFor(t),data=source('replacement-'+changeType);
  data.doc.paragraphs.find(p=>p.id==='p5').text='One lawyer says she handles appeals; another says he handles hearings.';
  data.plan.presenterContext.gender='mixed';
  const parent=app.store.create(approve(data));
  const original=prepareWorkerVideo(parent,0,'liteavatar_worker');
  original.status='visual_review';original.detectorVersion=config.video.faceDetectorVersion;original.files={video:true};app.video.save(original);
  const requested=original.avatar.gender==='male'?'female':'male';
  app.video.ensureLogo=async()=>{throw new Error('Synthetic transient logo failure.');};
  await assert.rejects(app.video.review(original.id,{decision:'reject',changeType,presenterGender:requested,note:'Please correct this synthetic video.',expectedOutputRevision:1},'QA Reviewer'),/logo/);
  const savedOriginal=app.video.get(original.id),replacement=app.video.get(savedOriginal.revisionRequest.replacementId);
  assert.equal(replacement.status,'needs_attention');assert.equal(replacement.stage,'logo_setup');assert.match(replacement.error,/logo/);
  assert.equal(replacement.workerTaskId,null);assert.equal(replacement.previousVideoId,original.id);assert.equal(savedOriginal.status,'changes_requested');
  app.video.ensureLogo=async()=>{};
  const resumed=await retryWorkerVideo(app.video,replacement.id,'QA Reviewer');
  assert.equal(resumed.id,replacement.id);assert.equal(resumed.status,'working');assert.equal(resumed.error,null);
  assert.equal(app.tasks.list(replacement.id).length,1);assert.equal(app.video.list(parent.id).length,2);
  assert.equal(resumed.previousVideoId,original.id);assert.equal(app.video.get(original.id).revisionRequest.replacementId,resumed.id);
  if(changeType==='gender'){assert.equal(resumed.avatar.gender,requested);assert.equal(resumed.voice.gender,requested);}
  await assert.rejects(retryWorkerVideo(app.video,replacement.id,'QA Reviewer'),/failed|active|processing/i);
  assert.equal(app.tasks.list(replacement.id).length,1);
});

test('a prepared worker replacement left by the previous version can be retried',async t=>{
  const app=appFor(t),parent=app.store.create(approve(source('old-prepared')));
  const saved=prepareWorkerVideo(parent,0,'liteavatar_worker');saved.previousVideoId='synthetic-original';app.video.save(saved);
  const resumed=await retryWorkerVideo(app.video,saved.id,'QA Reviewer');
  assert.equal(resumed.id,saved.id);assert.equal(resumed.status,'working');assert.equal(app.tasks.list(saved.id).length,1);
});

test('explicit woman/man wording governs automatic presenter selection and corrections',()=>{
  for(const [word,gender]of [['woman','female'],['women','female'],['man','male'],['men','male'],['female','female'],['male','male'],['she','female'],['he','male']]){
    for(let i=0;i<8;i++){
      const job=source(`word-${word}-${i}`);job.id=job.identity;
      job.doc.paragraphs.find(p=>p.id==='p5').text=`Attorney background explicitly says ${word}.`;
      job.plan.presenterContext.gender=gender;approve(job);
      assert.equal(presenterGender(job.doc,job.plan.presenterContext),gender,word);
      const video=prepareWorkerVideo(job,0,'liteavatar_worker');
      assert.equal(video.avatar.gender,gender,word);assert.equal(video.voice.gender,gender,word);
      assert.throws(()=>permittedPresenterGender(job.doc,job.plan.presenterContext,gender==='female'?'male':'female'),/MISMATCH/,word);
    }
  }
});

test('presenter evidence remains blurb-only, mixed-aware, and independent of unsupported AI labels',()=>{
  const job=source('gender-controls'),context=job.plan.presenterContext,blurb=job.doc.paragraphs.find(p=>p.id==='p5');
  blurb.text='Jordan handles appeals.';job.doc.paragraphs.push({id:'other',style:'NORMAL_TEXT',text:'A woman explains the general filing process.'});
  assert.equal(presenterGender(job.doc,context),null);
  blurb.text='Jordan represents women in appeals.';context.gender='unspecified';assert.equal(presenterGender(job.doc,context),null);
  blurb.text='One attorney is a woman; another is a man.';context.gender='mixed';assert.equal(presenterGender(job.doc,context),null);
  assert.equal(permittedPresenterGender(job.doc,context,'male'),'male');assert.equal(permittedPresenterGender(job.doc,context,'female'),'female');
  blurb.text='She handles appeals.';context.gender='male';assert.equal(presenterGender(job.doc,context),null);
});
