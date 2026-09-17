import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {importSavedReviews} from '../src/saved-reviews.mjs';
import {prepare} from '../src/heygen-domain.mjs';
import {validatePlan} from '../src/domain.mjs';
import {rulesHash} from '../src/rules.mjs';
import {savedReviewBatch} from './fixture-data.mjs';
const batch=()=>savedReviewBatch();
function harness(){const dir=mkdtempSync(join(tmpdir(),'saved-review-')),store=new Store(join(dir,'reviews.sqlite')),source=join(dir,'saved-reviews.json');writeFileSync(source,JSON.stringify(batch()));return {dir,store,source,close(){store.close();rmSync(dir,{recursive:true,force:true});}};}

test('imports three source-backed, unapproved reviews and preserves the existing review',()=>{
 const h=harness();try{
  const previous=h.store.create({identity:'existing-paul',title:'Existing user draft'});
  previous.plan={videos:[{question:'Existing reviewed question'}]};previous.reviews=[{actor:'Keziah',decision:'request_changes',note:'Keep this history'}];h.store.save(previous);
  const ids=importSavedReviews(h.store,h.source);assert.equal(ids.length,3);assert.equal(h.store.list().length,4);assert.deepEqual(h.store.get(previous.id),previous);
  for(const id of ids){const j=h.store.get(id);assert.equal(j.status,'content_review');assert.deepEqual(j.reviews,[]);assert.equal(j.audit.passed,null);assert.equal(j.rulesHash,rulesHash);assert.equal(j.plan.videos.length,2);assert.deepEqual(validatePlan(j.plan,j.doc,j.client).errors,[]);assert.equal(j.mode,'saved_snapshot');}
  assert.deepEqual(ids.map(id=>h.store.get(id).client.key),['Roman','Ryan','Adam']);
 }finally{h.close();}
});

test('restarts never overwrite reviewer edits, history, or changed identities',()=>{
 const h=harness();try{
  const ids=importSavedReviews(h.store,h.source),j=h.store.get(ids[0]);j.plan.videos[0].sentences[0].text='A subsequent user edit';j.reviews=[{actor:'Keziah',decision:'request_changes',note:'Keep my feedback'}];j.identity='identity-after-a-rule-migration';h.store.save(j);
  const before=h.store.list();assert.deepEqual(importSavedReviews(h.store,h.source),[]);assert.deepEqual(h.store.list(),before);
 }finally{h.close();}
});

test('drafts missing Visual folders cannot reach HeyGen preparation even after script approval',()=>{
 const h=harness();try{
  const ids=importSavedReviews(h.store,h.source),jobs=ids.map(id=>h.store.get(id));
  assert.equal(jobs[0].setupIssues.length,0);
  for(const j of jobs.slice(1)){assert.equal(j.setupIssues.length,1);assert.equal(j.row.folderId,null);j.status='pilot_reviewed';j.reviews=[{actor:'Keziah',decision:'approve',note:'Automated test only'}];assert.throws(()=>prepare(j,{},null,null),/Visual folder/);}
 }finally{h.close();}
});

test('invalid source evidence stops the batch before any records are inserted; outdated rules skip it',()=>{
 const h=harness();try{
  const invalid=batch(),path=join(h.dir,'batch.json');invalid.reviews[2].plan.videos[0].sentences[0].evidence[0].quote='Invented source quote that does not exist';writeFileSync(path,JSON.stringify(invalid));
  assert.throws(()=>importSavedReviews(h.store,path),/evidence/);assert.deepEqual(h.store.list(),[]);
  invalid.rulesHash='outdated';writeFileSync(path,JSON.stringify(invalid));assert.deepEqual(importSavedReviews(h.store,path),[]);assert.deepEqual(h.store.list(),[]);
 }finally{h.close();}
});
