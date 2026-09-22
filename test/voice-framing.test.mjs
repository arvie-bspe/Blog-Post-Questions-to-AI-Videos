import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {matchingPresenter,presenterIssue,presenterPool} from '../src/presenter-compatibility.mjs';
import {choosePresenter} from '../src/presenter-selection.mjs';
import {Store} from '../src/store.mjs';
import {config,rulesHash} from '../src/rules.mjs';
import {reconcileRules} from '../src/rules-migration.mjs';
import {questionState,approvedQuestion} from '../src/question-approval.mjs';
import {inspect,parseClients,parseMonthly} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {approveFixture} from './question-fixture.mjs';
import {VideoService} from '../src/video-service.mjs';
import {scriptText} from '../src/video-domain.mjs';
import {captionCase} from '../src/heygen-domain.mjs';
const avatar=presenterPool.avatars.find(a=>a.gender==='male'),male=presenterPool.voices.find(v=>v.gender==='male'),female=presenterPool.voices.find(v=>v.gender==='female');
import {fixture} from './fixture-data.mjs';
function parent(store,hash=rulesHash){const raw=fixture('paul'),doc=inspect(raw),row=parseMonthly(fixture('monthly')).find(r=>r.documentId===raw.documentId),client=parseClients(fixture('clients')).find(c=>c.key===row.clientKey);const p=store.create({identity:'voice-test',doc,row,client,rulesHash:hash,mode:'saved_snapshot'});p.plan=preparedExample(doc);p.origin='Manual fixture';store.save(p);return p;}
test('catalog gender is required and legacy known IDs are resolved without guessing',()=>{
 assert.throws(()=>matchingPresenter(avatar,female),/GENDER_MISMATCH/);
 assert.throws(()=>matchingPresenter({id:'unknown'},{id:'unknown'}),/GENDER_UNVERIFIED/);
 assert.throws(()=>matchingPresenter(avatar,{...female,gender:'male'}),/GENDER_MISMATCH/);
 assert.equal(matchingPresenter({id:avatar.id},{id:male.id}).voice.gender,'male');
 assert.equal(presenterIssue(avatar,male),null);
 const doc=inspect(fixture('paul')),p={id:'pool',doc,client:{key:'Paul'},plan:preparedExample(doc)};
 for(let i=0;i<50;i++){const selected=choosePresenter({...p,id:String(i)},i);assert.equal(selected.avatar.gender,selected.voice.gender);}
});
test('reused captions restore script casing without altering cue times or words',()=>{
 const cues=[{start:.26,end:1.92,text:'HOW DO SUPPORT LETTERS HELP?'},{start:2,end:3,text:'They help.'}];
 const result=captionCase(cues,'How Do Support Letters Help?\n\nThey help.');
 assert.equal(result[0].text,'How Do Support Letters Help?');assert.equal(result[0].start,.26);assert.equal(result[0].end,1.92);assert.equal(cues[0].text,'HOW DO SUPPORT LETTERS HELP?');
 assert.throws(()=>captionCase(cues,'Different script.'),/do not match/);
});
test('appearance migration preserves existing per-question decisions without granting the sibling approval',()=>{
 const dir=mkdtempSync(join(tmpdir(),'voice-migration-')),store=new Store(join(dir,'db'));
 try{const p=parent(store,config.rules.visualOnlyFromHashes.at(-1));approveFixture(p,0);store.save(p);const before=questionState(p,0),sibling=questionState(p,1);reconcileRules(store);const next=store.get(p.id);assert.equal(next.rulesHash,rulesHash);assert.equal(questionState(next,0).draftHash,before.draftHash);assert.equal(questionState(next,0).status,'approved');assert.equal(questionState(next,1).draftHash,sibling.draftHash);assert.equal(questionState(next,1).status,'pending');assert.doesNotThrow(()=>approvedQuestion(next,0));}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('future-render rotation migration preserves existing script approvals and videos',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rotation-migration-')),store=new Store(join(dir,'db'));
 try{const p=parent(store,config.rules.approvalCompatibleFromHashes.at(-1));approveFixture(p,0);store.save(p);const before=questionState(p,0);reconcileRules(store);const next=store.get(p.id);assert.equal(next.rulesHash,rulesHash);assert.equal(questionState(next,0).draftHash,before.draftHash);assert.equal(questionState(next,0).status,'approved');assert.doesNotThrow(()=>approvedQuestion(next,0));assert.match(next.layoutNotice,/future paid renders/i);assert.equal(next.error,null);assert.match(next.history.at(-1).reason,/Future-render workflow/);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('paid mismatch is blocked; a matching older source is rebuilt after only its own approval with no provider call',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'voice-rebuild-')),store=new Store(join(dir,'db'));let paid=0;
 const s=new VideoService({store,env:{},dataDir:dir,local:true,checkFresh:async()=>{},media:{check:async()=>{}},heygen:{submit:async()=>{paid++;}},logos:{},delivery:{}});
 try{
  const p=parent(store);approveFixture(p,0);store.save(p);
  const bad={id:'bad-pair',identity:'bad',parentId:p.id,provider:'heygen',index:0,layoutVersion:config.video.layoutVersion,sourceFraming:{version:'preserve-source-1'},source:{sourceHash:p.doc.sourceHash,rulesHash:config.rules.visualOnlyFromHashes[0]},script:scriptText(p.plan.videos[0]),question:p.plan.videos[0].question,avatar,voice:female,requests:{video:{id:'already-paid',state:'completed'}},files:{original:true,voice:true},cues:[{start:0,end:1,text:'fixture'}],reviews:[],status:'needs_attention'};
  bad.cues=[{start:0,end:20,text:bad.script.toUpperCase()}];s.save(bad);await assert.rejects(s.automation.reuse(p,0,approvedQuestion(p,0)),/GENDER_MISMATCH/);await assert.rejects(s.revisions.upgrade(bad.id,'Arvie'),/GENDER_MISMATCH/);
  const good={...bad,id:'good-pair',identity:'good',voice:male,requests:{video:{id:'already-paid-male',state:'completed'}}};s.save(good);for(const n of ['presenter.mp4','voice.wav'])writeFileSync(join(s.directory(good),n),'fixture');
  s.ensureLogo=async()=>{};s.work=async j=>{j.status='visual_review';s.save(j);};
  const out=await s.automation.reuse(p,0,approvedQuestion(p,0));await new Promise(r=>setTimeout(r,10));
  assert.equal(out.layoutRebuild.providerRequests,0);assert.equal(out.previousVideoId,good.id);assert.equal(out.voice.gender,'male');assert.equal(paid,0);assert.equal(questionState(store.get(p.id),1).status,'pending');assert.deepEqual(s.get(bad.id).voice,female);
  const again=await s.automation.reuse(p,0,approvedQuestion(p,0));assert.equal(again.id,out.id);assert.equal(s.list().length,3);
 }finally{s.closed=true;store.close();rmSync(dir,{recursive:true,force:true});}
});
test('real local face detector distinguishes jacket folds from two visible people',async t=>{
 if(!process.env.VISUAL_PYTHON_PATH)return t.skip('Set the local visual Python runtime.');
 const result=await promisify(execFile)(process.env.VISUAL_PYTHON_PATH,[fileURLToPath(new URL('./face-detector-test.py',import.meta.url))],{timeout:60000,windowsHide:true});assert.match(result.stderr,/OK/);
});
