import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../src/accounts.mjs';
import {createApp,isCurrentVideo} from '../src/server.mjs';
import {recordQuestionReview,approvedQuestion} from '../src/question-approval.mjs';
import {prepareWorkerVideo,queueWorkerVideo} from '../src/local-video.mjs';
import {appearanceRulesHash,config,rulesHash} from '../src/rules.mjs';
import {directMode,scriptPolicyHash} from '../src/workflow-config.mjs';
import {videoNeedsRebuild} from '../public/video-ui.js';

const doc={pageTitle:'Synthetic QA article',sourceHash:'synthetic-source',questionSelectionMode:'ai_independent',paragraphs:[{id:'p1',style:'NORMAL_TEXT',text:'The firm files the form electronically.'},{id:'p2',style:'NORMAL_TEXT',text:'Example Law Firm'},{id:'p3',style:'NORMAL_TEXT',text:'123 Main Street'},{id:'p4',style:'NORMAL_TEXT',text:'(555) 010-0200'},{id:'p5',style:'NORMAL_TEXT',text:'The lawyer handles these matters, and his practice focuses on them.'}]};
const plan={articleIdentity:{name:'Example Law Firm',address:'123 Main Street',phone:'(555) 010-0200',evidence:[{field:'name',paragraphId:'p2',quote:'Example Law Firm'},{field:'address',paragraphId:'p3',quote:'123 Main Street'},{field:'phone',paragraphId:'p4',quote:'(555) 010-0200'}]},presenterContext:{gender:'male',lawyerBlurbParagraphIds:['p5']},videos:[{candidateId:'q1',question:'How does filing work?',reason:'A useful direct explanation.',thumbnailTitle:'How Filing Works',selectionKind:'formulated_source',supportingParagraphIds:['p1'],runtimeReason:'',sentences:[{text:'The firm files the form electronically.',evidence:[{paragraphId:'p1',quote:'The firm files the form electronically.'}]}],cta:'',disclaimer:'',reviewFlags:[]}],skipped:[]};
const source=id=>({identity:id,mode:directMode,scriptRulesHash:scriptPolicyHash,rulesHash,appearanceRulesHash,doc:structuredClone(doc),plan:structuredClone(plan),row:{documentUrl:'https://docs.google.com/document/d/synthetic-doc/edit',pageUrl:'https://example.test/article',folderUrl:'https://drive.google.com/drive/folders/synthetic-folder'},client:{key:'Example',name:'Example Law Firm',homepage:'https://example.test'},setupIssues:[],questionReviews:[],reviews:[],status:'content_review',origin:'Local Codex worker draft with source audit',auditRequired:true,audit:{passed:true,issues:[]}});
const approve=job=>{recordQuestionReview(job,0,{actor:'Reviewer',decision:'approve',note:'Synthetic evidence and wording checked.',at:'2026-09-17T00:00:00Z'});return job;};

test('all AI providers must pass the source audit before approval',()=>{
  for(const origin of ['OpenAI API draft with separate semantic review','Local Codex worker draft with source audit','Claude API draft with source audit']){
    const job=approve({...source(origin),origin,audit:{passed:false,issues:['Synthetic unsupported claim.']}});
    assert.throws(()=>approvedQuestion(job,0),/audit/,origin);
  }
  const manual=approve({...source('manual'),origin:'Manual revision with source evidence; no API generation',auditRequired:false,audit:{passed:null,issues:[]}});
  assert.doesNotThrow(()=>approvedQuestion(manual,0));
});

test('LiteAvatar uses the appearance hash and current failures remain visible to progress',()=>{
  const parent=approve(source('current-video')),video=prepareWorkerVideo(parent,0,'liteavatar_worker');
  video.status='failed';video.error='Synthetic exhausted render failure';
  const settings={layoutVersion:config.video.layoutVersion,detectorVersion:config.video.faceDetectorVersion,rulesHash:appearanceRulesHash};
  assert.equal(videoNeedsRebuild({...video,detectorVersion:config.video.faceDetectorVersion},settings),false);
  assert.equal(isCurrentVideo(video,parent,'liteavatar_worker'),true);
});

test('terminal AI and video failures reconcile their parent state and a render can retry safely',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'terminal-repair-')),env={HOST:'127.0.0.1',PORT:'4197',APP_ORIGIN:'http://127.0.0.1:4197',DATA_DIR:dir,VIDEO_PROVIDER:'liteavatar_worker',AI_PROVIDER:'codex_worker',STUDIO_WORKER_TOKEN:'synthetic-worker-token-123456789'};
  const app=createApp(env);app.scripts.checkFresh=async()=>{};app.video.checkFresh=async()=>{};try{
    const analysis=app.store.create({...source('failed-analysis'),plan:null,status:'inspected'});await app.scripts.startDirect(analysis.id);app.store.db.prepare("UPDATE worker_tasks SET max_attempts=1 WHERE status='queued'").run();
    let task=app.tasks.claim({workerId:'synthetic-ai',types:['ai_codex']});app.tasks.fail(task.id,task.leaseToken,'Synthetic exhausted AI failure',true);
    assert.equal(app.store.get(analysis.id).status,'failed');

    const parent=app.store.create(approve(source('failed-video')));app.video.ensureLogo=async()=>{};const video=await queueWorkerVideo(app.video,parent,0,'Reviewer');app.store.db.prepare("UPDATE worker_tasks SET max_attempts=1 WHERE id=?").run(video.workerTaskId);
    task=app.tasks.claim({workerId:'synthetic-media',types:['media_liteavatar']});app.tasks.fail(task.id,task.leaseToken,'Synthetic exhausted render failure',true);
    assert.equal(app.video.get(video.id).status,'failed');
    const retried=await queueWorkerVideo(app.video,parent,0,'Reviewer');assert.equal(retried.id,video.id);assert.equal(retried.status,'working');assert.notEqual(retried.workerTaskId,video.workerTaskId);assert.equal(app.video.list(parent.id).length,1);
  }finally{app.video.closed=true;app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('a logo failure resumes the same setup and queues exactly one render',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'logo-repair-')),app=createApp({HOST:'127.0.0.1',PORT:'4198',APP_ORIGIN:'http://127.0.0.1:4198',DATA_DIR:dir,VIDEO_PROVIDER:'liteavatar_worker',STUDIO_WORKER_TOKEN:'synthetic-worker-token-123456789'});app.video.checkFresh=async()=>{};
  try{const parent=app.store.create(approve(source('logo-retry')));let calls=0;app.video.ensureLogo=async()=>{calls++;if(calls===1)throw new Error('Synthetic logo failure');};
    await assert.rejects(queueWorkerVideo(app.video,parent,0,'Reviewer'),/logo/);const retried=await queueWorkerVideo(app.video,parent,0,'Reviewer');
    assert.equal(calls,2);assert.equal(retried.status,'working');assert.ok(retried.workerTaskId);assert.equal(app.video.list(parent.id).length,1);
  }finally{app.video.closed=true;app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('account creation rejects identifiers that would make login ambiguous',()=>{
  const db=new DatabaseSync(':memory:');try{const accounts=new AccountStore(db),first=accounts.create({name:'First Reviewer',email:'shared@example.test',password:'synthetic-password-one'},null);assert.ok(first);
    assert.throws(()=>accounts.create({name:'shared@example.test',email:'second@example.test',password:'synthetic-password-two'},null),/conflicts/);
  }finally{db.close();}
});
