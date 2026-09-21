import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspect,parseClients,parseMonthly,validatePlan,recordIdentity} from '../src/domain.mjs';
import {rulesHash,config,rules,clientRules} from '../src/rules.mjs';
import {preparedExample} from '../src/sample.mjs';
import {Store} from '../src/store.mjs';
import {reconcileRules} from '../src/rules-migration.mjs';
import {fixture} from './fixture-data.mjs';
test('all source sections, Russell-only rules and required logo acquisition survive synchronization',()=>{
  assert.equal(config.version,'1.4.4');assert.equal(config.workflow.approvalScope,'per_question');assert.equal([...rules.matchAll(/^### C\d{2} /gm)].length,36);
  assert.equal(config.video.presenterGenderEvidenceSource,'lawyer_blurb_only');assert.equal(config.video.reviewerGenderCorrection,'new_cpu_render_with_same_gender_voice');assert.match(rules,/Only use gender information found in the lawyer blurb/);
  assert.equal([...rules.matchAll(/^#### C32\.\d /gm)].length,7);assert.equal([...rules.matchAll(/^### V\d{2,3} /gm)].length,100);
  assert.match(clientRules('Russell Chicago'),/source|body/i);assert.doesNotMatch(clientRules('Paul'),/Russell Chicago/);
  assert.match(rules,/persistent caching by domain/);
  assert.equal(config.video.logoAcquisition.implementationStatus,'implemented_google_authorization_separate');
  assert.deepEqual(config.workflow.productionPipeline.orderedStages,['google_doc','codex_cli_script','keziah_script_approval','heygen_presenter_and_voiceover','railway_video_assembly','macy_video_review','google_drive_delivery']);
  assert.equal(config.workflow.productionPipeline.scriptAuthor,'codex_cli');assert.equal(config.workflow.productionPipeline.videoProvider,'heygen');assert.equal(config.workflow.productionPipeline.assembler,'railway');
  assert.equal(config.video.logoBackground.required,true);assert.equal(config.video.logoBackground.darkLogoBackground,'#FFFFFF');assert.equal(config.video.logoBackground.lightLogoBackground,'#111111');
  assert.match(rules,/Google Doc → Codex CLI writes the script → Keziah approves → HeyGen creates the video presenter and voiceover → Railway assembles the video → Macy reviews → Google Drive/);
});
test('only Russell Chicago can use substantive body questions and grounded topics',()=>{
  const source={documentId:'test',title:'Article title',body:{content:[
    {startIndex:1,paragraph:{paragraphStyle:{namedStyleType:'HEADING_1'},elements:[{textRun:{content:'What Is This Article About?'}}]}},
    {startIndex:2,paragraph:{paragraphStyle:{namedStyleType:'NORMAL_TEXT'},elements:[{textRun:{content:'What evidence is needed? The application needs written evidence and a signed statement.'}}]}},
    {startIndex:3,paragraph:{paragraphStyle:{namedStyleType:'NORMAL_TEXT'},elements:[{textRun:{content:'The signed statement describes the facts relevant to the application.'}}]}},
    {startIndex:4,paragraph:{paragraphStyle:{namedStyleType:'NORMAL_TEXT'},elements:[{textRun:{content:'Contact us for a consultation.'}}]}}
  ]}};
  const doc=inspect(source,'','Russell Chicago'),normal=inspect(source,'','Paul');
  assert.equal(normal.candidates.length,0);assert.equal(doc.candidates.length,1);
  const client={key:'Russell Chicago',maxVideos:4};
  const v={candidateId:'topic:statement',question:'What does the signed statement describe?',reason:'The body explicitly explains the purpose of the signed statement.',selectionKind:'formulated_body',supportingParagraphIds:['t.0:3'],runtimeReason:'',sentences:[{text:'It describes the facts relevant to the application.',evidence:[{paragraphId:'t.0:3',quote:'The signed statement describes the facts relevant to the application.'}]}],cta:'',disclaimer:'',reviewFlags:[]};
  const plan={videos:[v],skipped:[]};assert.deepEqual(validatePlan(plan,doc,client).errors,[]);
  assert.ok(validatePlan(plan,normal,{key:'Paul'}).errors.length);
  assert.ok(validatePlan({...plan,videos:[{...v,question:doc.pageTitle}]},doc,client).errors.some(e=>e.includes('title')));
  assert.ok(validatePlan({...plan,videos:[{...v,supportingParagraphIds:['t.0:4']}]},doc,client).errors.some(e=>e.includes('substantive')));
  assert.ok(validatePlan({...plan,videos:[v,{...v,candidateId:'topic:duplicate'}]},doc,client).errors.some(e=>e.includes('duplicate question')));
});
test('rule migration preserves exact draft/history, clears current approval and reuses the article record',()=>{
  const dir=mkdtempSync(join(tmpdir(),'rules-update-')),store=new Store(join(dir,'db'));
  try{
    const source=fixture('paul'),doc=inspect(source),row=parseMonthly(fixture('monthly')).find(r=>r.documentId===source.documentId),client=parseClients(fixture('clients'))[0];
    const job=store.create({identity:'old-rules-identity',rulesHash:'old',rulesVersion:'1.0.3',doc,row,client,mode:'saved_snapshot'});
    job.plan=preparedExample(doc);job.origin='Prepared in Codex';job.reviews=[{actor:'Keziah',decision:'approve',note:'Old approval.'}];job.status='pilot_reviewed';store.save(job);const old=structuredClone(job);
    reconcileRules(store);const updated=store.get(job.id);
    assert.deepEqual(updated.plan,old.plan);assert.deepEqual(updated.history[0].reviews,old.reviews);assert.deepEqual(updated.reviews,[]);assert.equal(updated.status,'content_review');assert.equal(updated.rulesHash,rulesHash);
    assert.equal(store.create({identity:recordIdentity(row,doc,'saved_snapshot',rulesHash,client)}).id,old.id);
    reconcileRules(store);assert.equal(store.get(job.id).revision,updated.revision);assert.equal(store.list().length,1);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
