import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {inspect,parseClients} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {manualRevision} from '../src/manual-revision.mjs';
import {createApp} from '../src/server.mjs';
import {rulesHash} from '../src/rules.mjs';
import {fixture} from './fixture-data.mjs';
const doc=inspect(fixture('paul')),client=parseClients(fixture('clients'))[0];
const original=()=>({id:'00000000-0000-0000-0000-000000000001',identity:'manual-test',doc,client,plan:preparedExample(doc),revision:5,status:'changes_requested',rulesHash,mode:'saved_snapshot',reviews:[{actor:'Keziah',decision:'reject',note:'Shorten both scripts to 30 seconds.'}],origin:'Prepared in Codex',updated:'2026-09-15T00:00:00Z'});
const edit=j=>{const plan=structuredClone(j.plan);for(const v of plan.videos)v.sentences=v.sentences.slice(0,1);return {expectedRevision:j.revision,note:'Manual shortening test only; the team must review the resulting text.',plan};};
test('manual update preserves old wording and feedback and requires a fresh review',()=>{
  const j=original(),before=structuredClone(j),result=manualRevision(j,edit(j),'Arvie');
  assert.deepEqual(j,before);assert.equal(result.status,'content_review');assert.equal(result.audit.passed,null);assert.deepEqual(result.reviews,[]);
  assert.deepEqual(result.history[0].plan,before.plan);assert.deepEqual(result.history[0].reviews,before.reviews);assert.equal(result.draftVersion,2);
  assert.notDeepEqual(result.plan,before.plan);assert.equal(result.scriptTargetSeconds,30);
});
test('manual update blocks unauthenticated, stale, unsupported, and overlong replacements',()=>{
  const j=original();assert.throws(()=>manualRevision(j,edit(j),''),/administrator/);
  assert.throws(()=>manualRevision(j,{...edit(j),expectedRevision:4},'Arvie'),/changed/);
  const unsupported=edit(j);unsupported.plan.videos[0].sentences[0].evidence[0].quote='Invented source quote which is absent from this article.';
  assert.throws(()=>manualRevision(j,unsupported,'Arvie'),/evidence/);
  const longer=edit(j);longer.plan.videos[0].sentences=Array(8).fill(longer.plan.videos[0].sentences[0]);
  assert.throws(()=>manualRevision(j,longer,'Arvie'),/accuracy\/context reason/);
  longer.plan.videos[0].runtimeReason='Test fixture only. Necessary source qualifications require additional explanation.';
  const permitted=manualRevision(j,longer,'Arvie');assert.equal(permitted.status,'content_review');assert.ok(permitted.validation.warnings.some(w=>w.includes('runtime')));
});
test('manual HTTP update works without an API key and refuses a duplicate old revision',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'manual-revision-http-')),app=createApp({HOST:'127.0.0.1',PORT:'4173',APP_ORIGIN:'http://127.0.0.1:4173',DATA_DIR:dir});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const j=original();app.store.save(j);const body=edit(j);
  const request=(actor,payload)=>new Promise((resolve,reject)=>{
    const req=httpRequest(`http://127.0.0.1:${app.server.address().port}/api/jobs/${j.id}/manual-revision`,{method:'POST',headers:{Host:'127.0.0.1:4173',Origin:'http://127.0.0.1:4173','Content-Type':'application/json','X-Reviewer':actor}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.end(JSON.stringify(payload));
  });
  try{
    assert.equal((await request('Macy',body)).status,403);
    const saved=await request('Arvie',body);assert.equal(saved.status,200);assert.equal(saved.body.status,'content_review');
    assert.equal((await request('Arvie',body)).status,409);assert.equal(app.store.get(j.id).history.length,1);
    assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM usage').get().n,0);
  }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
