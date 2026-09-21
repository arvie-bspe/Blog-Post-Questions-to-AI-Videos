import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {directDocumentReference,directSource} from '../src/integrations.mjs';
import {validateDirectPlan} from '../src/domain.mjs';
import {DirectAIResolver,directInstructions} from '../src/direct-ai.mjs';
import {TaskQueue} from '../src/task-queue.mjs';
import {Store} from '../src/store.mjs';
import {ScriptWorkflow} from '../src/script-workflow.mjs';
import {prepareLocal,prepareWorkerVideo} from '../src/local-video.mjs';
import {recordQuestionReview} from '../src/question-approval.mjs';
import {directMode,scriptPolicyHash} from '../src/workflow-config.mjs';

const paragraph=(text,startIndex,style='NORMAL_TEXT')=>({startIndex,paragraph:{paragraphStyle:{namedStyleType:style},elements:[{textRun:{content:text+'\n'}}]}});
const googleDoc={documentId:'direct-doc-123',title:'Tabbed article',revisionId:'rev-1',tabs:[
  {tabProperties:{tabId:'overview',title:'Overview'},documentTab:{body:{content:[paragraph('Overview',1,'TITLE'),paragraph('Overview text.',10)]}}},
  {tabProperties:{tabId:'article',title:'Article'},documentTab:{body:{content:[paragraph('How Does This Work?',1,'TITLE'),paragraph('How does filing work?',20,'HEADING_2'),paragraph('The firm files the form electronically.',40),paragraph('Example Law Firm',80),paragraph('123 Main Street',100),paragraph('(555) 010-0200',120),paragraph('Attorney Alex says he handles these matters.',140)]}}}
]};

test('direct Google Doc input keeps the selected document tab and never needs a Monthly Sheet',async()=>{
  assert.deepEqual(directDocumentReference('https://docs.google.com/document/d/direct-doc-123/edit?tab=article'),{documentId:'direct-doc-123',documentUrl:'https://docs.google.com/document/d/direct-doc-123/edit',tabId:'article'});
  const read=async url=>{assert.match(url,/documents\/direct-doc-123/);return googleDoc;};
  await assert.rejects(directSource({documentUrl:'https://docs.google.com/document/d/direct-doc-123/edit'},{read}),error=>error.status===409&&error.details.tabs.length===2);
  const source=await directSource({documentUrl:'https://docs.google.com/document/d/direct-doc-123/edit?tab=article',clientKey:'Unassigned'},{read});
  assert.equal(source.row.order,'Direct Google Doc');assert.equal(source.row.tabId,'article');assert.equal(source.doc.selectedTabId,'article');assert.equal(source.doc.pageTitle,'How Does This Work?');assert.equal(source.doc.paragraphs.some(item=>item.text==='Overview text.'),false);
});

test('new direct validation is source-grounded without reapplying retired content wording rules',()=>{
  const doc={sourceHash:'source',questionSelectionMode:'ai_independent',paragraphs:[{id:'p1',style:'NORMAL_TEXT',text:'Generally, the firm files the form electronically.'}]};
  const plan={articleIdentity:{name:'',address:'',phone:'',evidence:[]},presenterContext:{gender:'unspecified',lawyerBlurbParagraphIds:[]},videos:[{candidateId:'formulated-1',question:'How does filing work?',reason:'This gives viewers a direct procedural answer.',thumbnailTitle:'How Filing Works',selectionKind:'formulated_source',supportingParagraphIds:['p1'],runtimeReason:'',sentences:[{text:'Generally, the firm files the form electronically.',evidence:[{paragraphId:'p1',quote:'Generally, the firm files the form electronically.'}]}],cta:'',disclaimer:'',reviewFlags:[]}],skipped:[]};
  assert.deepEqual(validateDirectPlan(plan,doc,2),{errors:[],warnings:[]});
  assert.match(directInstructions(),/previous Video Content and Script Rules document is retired/i);
});

test('Codex resolver creates a provider-neutral durable task',()=>{
  const calls=[],tasks={enqueue:value=>{calls.push(value);return {id:'task-1',status:'queued'};}},resolver=new DirectAIResolver({env:{AI_PROVIDER:'codex_worker',STUDIO_WORKER_TOKEN:'x'.repeat(32)},tasks});
  const job={id:'job-1',doc:{sourceHash:'source',paragraphs:[]},client:{},plan:null,maxVideos:2};
  const result=resolver.submit(job);
  assert.equal(result.provider,'codex_worker');assert.equal(calls[0].type,'ai_codex');assert.match(calls[0].idempotencyKey,/^[a-f0-9]{64}$/);assert.equal(calls[0].payload.context.sourceHash,'source');assert.equal(calls[0].payload.outputSchema.additionalProperties,false);
});

test('a queued Codex draft survives a Railway restart and duplicate retries are suppressed',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'direct-recovery-')),store=new Store(join(dir,'studio.sqlite'));
  try{
    const queue=new TaskQueue({db:store.db,dataDir:dir,env:{STUDIO_WORKER_TOKEN:'secret-'.padEnd(32,'x')}}),resolver=new DirectAIResolver({env:{AI_PROVIDER:'codex_worker',STUDIO_WORKER_TOKEN:'secret-'.padEnd(32,'x')},tasks:queue});
    const job=store.create({identity:'recover-direct',mode:directMode,status:'inspected',doc:{sourceHash:'source',paragraphs:[]},client:{},row:{},maxVideos:2});
    for(let attempt=1;attempt<=4;attempt++){job.analysisAttempt=attempt;const submitted=resolver.submit(job);job.analysisTaskId=submitted.task.id;}
    job.status='interrupted';job.error='The application restarted during analysis.';job.revisionRequest={status:'working'};store.save(job);
    const workflow=new ScriptWorkflow({store,env:{AI_PROVIDER:'codex_worker',STUDIO_WORKER_TOKEN:'secret-'.padEnd(32,'x')},checkFresh:async()=>assert.fail('A saved pending task must be reused.'),directResolver:resolver});
    workflow.recoverPendingTasks();
    let current=store.get(job.id);assert.equal(current.status,'analyzing');assert.equal(current.error,null);
    const tasks=queue.list(job.id+':analysis');assert.equal(tasks.filter(task=>task.status==='queued').length,1);assert.equal(tasks.filter(task=>task.status==='failed').length,3);
    const before=tasks.length;current=await workflow.startDirect(job.id);assert.equal(current.analysisTaskId,job.analysisTaskId);assert.equal(queue.list(job.id+':analysis').length,before);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('worker queue leases once, records heartbeats, and applies one completion',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'worker-queue-')),store=new Store(join(dir,'studio.sqlite')),applied=[];
  try{
    const queue=new TaskQueue({db:store.db,dataDir:dir,env:{STUDIO_WORKER_TOKEN:'secret-'.padEnd(32,'x')},onComplete:async task=>applied.push(task.id)}),task=queue.enqueue({type:'ai_codex',subject:'job:analysis',payload:{value:1},idempotencyKey:'stable-task'});
    assert.equal(queue.enqueue({type:'ai_codex',subject:'job:analysis',payload:{value:2},idempotencyKey:'stable-task'}).id,task.id);
    const claimed=queue.claim({workerId:'worker-one',types:['ai_codex'],leaseSeconds:90});assert.equal(claimed.id,task.id);assert.equal(queue.claim({workerId:'worker-two',types:['ai_codex']}),null);
    queue.heartbeat(task.id,claimed.leaseToken,90);await queue.complete(task.id,claimed.leaseToken,{ok:true});
    assert.deepEqual(applied,[task.id]);assert.equal(queue.get(task.id).status,'completed');assert.equal(queue.workers()[0].online,true);
    await assert.rejects(queue.complete(task.id,claimed.leaseToken,{ok:true}),/lease/);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('worker retries use backoff and stop at the configured attempt limit',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worker-retry-')),store=new Store(join(dir,'studio.sqlite'));
  try{
    const queue=new TaskQueue({db:store.db,dataDir:dir,env:{STUDIO_WORKER_TOKEN:'secret-'.padEnd(32,'x')}}),task=queue.enqueue({type:'media_local',subject:'video-1',payload:{},idempotencyKey:'retry-task',maxAttempts:2});
    let claimed=queue.claim({workerId:'worker-one',types:['media_local']});queue.fail(task.id,claimed.leaseToken,'temporary failure',true);
    assert.equal(queue.claim({workerId:'worker-one',types:['media_local']}),null);
    store.db.prepare('UPDATE worker_tasks SET available_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),task.id);
    claimed=queue.claim({workerId:'worker-one',types:['media_local']});queue.fail(task.id,claimed.leaseToken,'still unavailable',true);
    assert.equal(queue.get(task.id).status,'failed');assert.equal(queue.get(task.id).attempts,2);assert.equal(queue.claim({workerId:'worker-one',types:['media_local']}),null);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('approved direct script prepares a zero-provider-charge local video with matching avatar and voice',()=>{
  const dir=mkdtempSync(join(tmpdir(),'local-video-')),store=new Store(join(dir,'studio.sqlite'));
  try{
    const doc={sourceHash:'source',questionSelectionMode:'ai_independent',paragraphs:[{id:'p1',style:'NORMAL_TEXT',text:'The firm files the form electronically.'},{id:'p2',style:'NORMAL_TEXT',text:'Example Law Firm'},{id:'p3',style:'NORMAL_TEXT',text:'123 Main Street'},{id:'p4',style:'NORMAL_TEXT',text:'(555) 010-0200'},{id:'p5',style:'NORMAL_TEXT',text:'Attorney Alex says he handles these matters.'}]};
    const plan={articleIdentity:{name:'Example Law Firm',address:'123 Main Street',phone:'(555) 010-0200',evidence:[{field:'name',paragraphId:'p2',quote:'Example Law Firm'},{field:'address',paragraphId:'p3',quote:'123 Main Street'},{field:'phone',paragraphId:'p4',quote:'(555) 010-0200'}]},presenterContext:{gender:'male',lawyerBlurbParagraphIds:['p5']},videos:[{candidateId:'q1',question:'How does filing work?',reason:'A useful direct explanation.',thumbnailTitle:'How Filing Works',selectionKind:'formulated_source',supportingParagraphIds:['p1'],runtimeReason:'',sentences:[{text:'The firm files the form electronically.',evidence:[{paragraphId:'p1',quote:'The firm files the form electronically.'}]}],cta:'',disclaimer:'',reviewFlags:[]}],skipped:[]};
    const job=store.create({identity:'local-direct',mode:directMode,scriptRulesHash:scriptPolicyHash,rulesHash:'appearance',doc,plan,row:{documentUrl:'https://docs.google.com/document/d/direct-doc-123/edit',pageUrl:'https://example.com/article',folderUrl:'https://drive.google.com/drive/folders/folder123'},client:{key:'Example',name:'Example Law Firm',homepage:'https://example.com'},setupIssues:[],questionReviews:[],reviews:[]});
    recordQuestionReview(job,0,{actor:'Keziah',decision:'approve',note:'Evidence and wording checked.',checkedEvidence:true,checkedWarnings:true,at:new Date().toISOString()});store.save(job);
    const video=prepareLocal(job,0);assert.equal(video.provider,'local_worker');assert.equal(video.renderEstimate,0);assert.equal(video.avatar.gender,video.voice.gender);assert.equal(video.script,'How does filing work?\n\nThe firm files the form electronically.');
    const lite=prepareWorkerVideo(job,0,'liteavatar_worker');assert.equal(lite.provider,'liteavatar_worker');assert.equal(lite.models.video,'LiteAvatar CPU natural motion v2');assert.equal(lite.avatar.type,'liteavatar_profile');assert.equal(lite.avatar.gender,lite.voice.gender);assert.equal(lite.avatar.gender,'male');assert.equal(lite.renderEstimate,0);
    const femaleJob=structuredClone(job);femaleJob.id='female-direct';femaleJob.doc.paragraphs.find(p=>p.id==='p5').text='Attorney Alex says she handles these matters.';femaleJob.plan.presenterContext.gender='female';femaleJob.questionReviews=[];recordQuestionReview(femaleJob,0,{actor:'Keziah',decision:'approve',note:'Female presenter context and evidence checked.',checkedEvidence:true,checkedWarnings:true,at:new Date().toISOString()});const female=prepareWorkerVideo(femaleJob,0,'liteavatar_worker');assert.equal(female.avatar.gender,'female');assert.equal(female.voice.gender,'female');assert.equal(female.voice.id,'af_heart');
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
