import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {inspect,parseClients,validatePlan} from '../src/domain.mjs';
import {rulesHash,config} from '../src/rules.mjs';
import {preparedExample} from '../src/sample.mjs';
import {Store} from '../src/store.mjs';
import {manualRevision} from '../src/manual-revision.mjs';
import {ScriptWorkflow} from '../src/script-workflow.mjs';
import {questionHash,questionState,recordQuestionReview,approvedQuestion} from '../src/question-approval.mjs';
import {reconcileRules} from '../src/rules-migration.mjs';
import {createApp} from '../src/server.mjs';
import {approveFixture} from './question-fixture.mjs';
const fixture=n=>JSON.parse(readFileSync(new URL('../fixtures/'+n+'.json',import.meta.url)));
const source=()=>{const doc=inspect(fixture('paul'));return {identity:'question-test',doc,plan:preparedExample(doc),client:parseClients(fixture('clients'))[0],mode:'saved_snapshot',rulesHash,origin:'Manual draft',status:'content_review',reviews:[],revision:1};};
test('only a changed question loses approval, and source identity changes invalidate all affected approvals',()=>{
 const j=source();approveFixture(j);const sibling=approvedQuestion(j,1),plan=structuredClone(j.plan);plan.videos[0].sentences[0].text='Support letters provide independent evidence of sobriety.';
 const next=manualRevision(j,{expectedRevision:j.revision,plan,note:'Change only the first answer for this fixture.'},'Arvie');
 assert.equal(questionState(next,0).status,'pending');assert.equal(questionState(next,1).status,'approved');assert.equal(approvedQuestion(next,1),sibling);assert.equal(next.status,'partially_reviewed');
 next.doc.sourceHash='changed-source';assert.throws(()=>approvedQuestion(next,1),/review/);
});
test('a scoped rewrite keeps the other script and approval intact, even with OpenAI connected',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'one-rewrite-')),store=new Store(join(dir,'db'));try{
  const j=store.create(source());j.origin='Manual';approveFixture(j,0);recordQuestionReview(j,1,{actor:'Keziah',decision:'reject',note:'Revise only the second answer.'});store.save(j);const fingerprint=approvedQuestion(j,0),script=structuredClone(j.plan.videos[0]);
  let calls=0;const workflow=new ScriptWorkflow({store,env:{OPENAI_API_KEY:'test'},checkFresh:async()=>{},analyzer:async(d,c,args)=>{calls++;assert.equal(args.previousPlan.videos.length,1);assert.equal(c.maxVideos,1);const plan=structuredClone(args.previousPlan);plan.videos[0].sentences.pop();return {plan,validation:validatePlan(plan,d,c),audit:{passed:true,issues:[]}};}});
  await workflow.start(j.id,'Revise only the second answer.',1);for(let i=0;i<100&&workflow.active.size;i++)await new Promise(r=>setTimeout(r,5));
  const next=store.get(j.id);assert.equal(calls,1);assert.deepEqual(next.plan.videos[0],script);assert.equal(approvedQuestion(next,0),fingerprint);assert.equal(questionState(next,1).status,'pending');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('bulk legacy approvals are archived but never converted into two question approvals',()=>{
 const dir=mkdtempSync(join(tmpdir(),'per-question-migration-')),store=new Store(join(dir,'db'));try{
  const j=store.create({...source(),rulesHash:config.rules.perQuestionMigrationFromHashes[0]});j.status='pilot_reviewed';j.reviews=[{actor:'Keziah',decision:'approve',note:'Old bulk review'}];store.save(j);reconcileRules(store);const next=store.get(j.id);
  assert.ok(next.history.some(h=>h.reviews.some(r=>r.note==='Old bulk review')));assert.equal(questionState(next,0).status,'pending');assert.equal(questionState(next,1).status,'pending');assert.equal(next.plan.videos.length,2);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('one approved question and one skipped question complete selection without a second video',()=>{
 const j=source();recordQuestionReview(j,0,{actor:'Reviewer',decision:'approve',note:'This question is approved for video.'});recordQuestionReview(j,1,{actor:'Reviewer',decision:'skip',note:'This question is not a useful video candidate.'});
 assert.equal(j.status,'pilot_reviewed');assert.equal(questionState(j,0).status,'approved');assert.equal(questionState(j,1).status,'skipped');assert.doesNotThrow(()=>approvedQuestion(j,0));assert.throws(()=>approvedQuestion(j,1),/review/);
});
test('HTTP approval requires one index, scopes generation, and lets one rejected script coexist with an approved sibling',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'one-approval-http-')),app=createApp({HOST:'127.0.0.1',PORT:'4180',APP_ORIGIN:'http://127.0.0.1:4180',DATA_DIR:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const j=app.store.create(source()),calls=[];app.video.automation.enqueue=(id,actor,index)=>{calls.push(index);};
 const request=body=>new Promise((resolve,reject)=>{const req=httpRequest(`http://127.0.0.1:${app.server.address().port}/api/jobs/${j.id}/review`,{method:'POST',headers:{Host:'127.0.0.1:4180',Origin:'http://127.0.0.1:4180','Content-Type':'application/json','X-Reviewer':'Keziah'}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));});req.on('error',reject);req.end(JSON.stringify(body));});
 try{const data={decision:'approve',note:'Automated fixture only; evidence checked.',checkedEvidence:true,checkedWarnings:true};
  assert.equal((await request(data)).status,400);assert.equal((await request({...data,index:99})).status,400);assert.deepEqual(calls,[]);
  const a=await request({...data,index:0,expectedQuestionHash:questionHash(j,0)});assert.equal(a.status,200,a.body.error);assert.equal(a.body.questionStates[0].status,'approved');assert.equal(a.body.questionStates[1].status,'pending');assert.deepEqual(calls,[0]);const approved=approvedQuestion(app.store.get(j.id),0);
  assert.equal((await request({...data,index:0})).status,409);const b=await request({...data,index:1,decision:'reject',note:'Please revise only this second question.'});assert.equal(b.status,200);assert.equal(b.body.questionStates[1].status,'revision_pending');assert.equal(b.body.questionStates[1].request.status,'awaiting_manual_update');assert.equal(approvedQuestion(app.store.get(j.id),0),approved);assert.deepEqual(calls,[0]);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
