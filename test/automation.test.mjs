import {approveFixture} from './question-fixture.mjs';
import {questionState,approvedQuestion,recordQuestionReview} from '../src/question-approval.mjs';
import {config} from '../src/rules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspect,parseClients,parseMonthly} from '../src/domain.mjs';
import {rulesHash} from '../src/rules.mjs';
import {preparedExample} from '../src/sample.mjs';
import {Store} from '../src/store.mjs';
import {presenterPath} from '../src/media.mjs';
import {VideoService} from '../src/video-service.mjs';
import {presenterPool} from '../src/presenter-selection.mjs';
import {fixture} from './fixture-data.mjs';
const avatar={id:'mock_studio',name:'Mock speaking presenter',type:'studio_avatar',gender:'male',supported_api_engines:['avatar_iv'],status:'completed'};
const voice={id:'mock_voice',name:'Mock English voice',language:'English',gender:'male'};
const settings={enabled:true,avatarId:avatar.id,voiceId:voice.id,maxEstimatedCost:2,acceptCost:true};
function harness(key='mock-key'){
  const dir=mkdtempSync(join(tmpdir(),'approval-video-')),store=new Store(join(dir,'db')),submissions=[];
  const source=fixture('paul'),doc=inspect(source),row=parseMonthly(fixture('monthly')).find(r=>r.documentId===source.documentId),client=parseClients(fixture('clients'))[0];
  const parent=store.create({identity:'auto-test',rulesHash,doc,row,client,mode:'saved_snapshot'});parent.plan=preparedExample(doc);parent.origin='Prepared test';parent.status='content_review';store.save(parent);
  const service=new VideoService({store,dataDir:dir,env:{HEYGEN_API_KEY:key,DAILY_VIDEO_LIMIT:'2'},local:true,checkFresh:async()=>{},logos:{acquire:async()=>({path:presenterPath,domain:'test.example',hash:'fixture-logo'})},media:{check:async()=>true},heygen:{look:async()=>avatar,submit:async(body,id)=>{submissions.push({body,id});return {id:'mock-'+id,state:'waiting'};},status:async()=>({status:'completed'})}});
  service.avatars.set(avatar.id,avatar);service.voices.set(voice.id,voice);
  return {dir,store,parent,service,submissions,approve(index=0){approveFixture(parent,index);store.save(parent);},close(){service.closed=true;store.close();rmSync(dir,{recursive:true,force:true});}};
}
async function settle(h){for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,5));if(!h.service.automation.active.size&&!h.service.active.size)return;}assert.fail('Mock automation did not settle.');}

test('one approval submits only its question; repeated approval and resume cannot submit its sibling',async()=>{
 const h=harness();try{
  h.service.heygen.look=async id=>({...presenterPool.avatars.find(a=>a.id===id),supported_api_engines:['avatar_iv'],status:'completed'});
  h.approve(0);const entry=h.service.automation.enqueue(h.parent.id,'Keziah',0);await settle(h);
  assert.equal(h.submissions.length,1,h.service.automation.view(h.parent.id).lastRun?.error);assert.equal(questionState(h.store.get(h.parent.id),1).status,'pending');
  assert.throws(()=>h.service.automation.enqueue(h.parent.id,'Keziah'),/specific question/);assert.throws(()=>h.service.automation.enqueue(h.parent.id,'Keziah',1),/review/);
  h.service.automation.enqueue(h.parent.id,'Keziah',0);await h.service.automation.run(entry);await settle(h);assert.equal(h.submissions.length,1);
  h.approve(1);h.service.automation.enqueue(h.parent.id,'Keziah',1);await settle(h);assert.equal(h.submissions.length,2);assert.equal(h.service.automation.view(h.parent.id).runs.length,2);
 }finally{h.close();}
});
test('an approved question with no automation run is exposed for one guarded recovery',async()=>{
 const h=harness();try{
  h.approve(0);let state=h.service.automation.view(h.parent.id);
  assert.deepEqual(state.missingApproved,[{index:0,question:h.parent.plan.videos[0].question}]);
  h.service.closed=true;const entry=h.service.automation.startMissing(h.parent.id,'Arvie',0);await Promise.resolve();
  state=h.service.automation.view(h.parent.id);assert.equal(state.missingApproved.length,0);assert.equal(state.runs.length,1);assert.equal(state.runs[0].id,entry.id);
  assert.throws(()=>h.service.automation.startMissing(h.parent.id,'Arvie',0),/already has/);
  assert.throws(()=>h.service.automation.startMissing(h.parent.id,'Arvie',1),/not approved/);
 }finally{h.close();}
});
test('an explicit recovery starts one worker video while a historical article profile stays disabled',async()=>{
 const h=harness();try{
  h.service.automation.configure(h.parent.id,settings,'Arvie');h.service.automation.configure(h.parent.id,{enabled:false},'Arvie');h.approve(0);
  h.service.env.VIDEO_PROVIDER='liteavatar_worker';h.service.closed=true;
  const entry=h.service.automation.startMissing(h.parent.id,'Arvie',0),state=h.service.automation.view(h.parent.id);
  assert.equal(entry.manualRecovery,true);assert.equal(entry.profile.mode,'single_approved_recovery');assert.equal(entry.status,'queued');
  assert.equal(state.missingApproved.length,0);assert.equal(state.runs.length,1);assert.equal(state.profile.enabled,false);
 }finally{h.close();}
});
test('a missing key holds only the selected question; adding the key resumes exactly one submission',async()=>{
 const h=harness('');try{
  h.service.automation.configure(h.parent.id,settings,'Arvie');h.approve();h.service.automation.enqueue(h.parent.id,'Keziah',0);await settle(h);
  const entry=h.service.automation.view(h.parent.id).lastRun;assert.equal(entry.status,'blocked');assert.match(entry.error,/HEYGEN_API_KEY/);assert.equal(h.submissions.length,0);
  h.service.env.HEYGEN_API_KEY='mock';await h.service.automation.run(entry);await settle(h);assert.equal(h.submissions.length,1);assert.equal(questionState(h.store.get(h.parent.id),1).status,'pending');
 }finally{h.close();}
});
test('disabled profile, rejected question and excess estimate cannot spend',async()=>{
 for(const scenario of ['disabled','rejected','estimate']){const h=harness();try{
  if(scenario==='estimate'){h.parent.plan.videos[0].sentences=Array(8).fill(h.parent.plan.videos[0].sentences[0]);h.parent.plan.videos[0].runtimeReason='Automated fixture only. Required source context needs additional time.';h.store.save(h.parent);}
  h.service.automation.configure(h.parent.id,settings,'Arvie');h.approve();h.service.closed=true;const entry=h.service.automation.enqueue(h.parent.id,'Keziah',0);await Promise.resolve();
  if(scenario==='disabled')h.service.automation.configure(h.parent.id,{enabled:false},'Arvie');
  if(scenario==='rejected'){recordQuestionReview(h.parent,0,{actor:'Keziah',decision:'reject',note:'Test change request'});h.store.save(h.parent);}
  h.service.closed=false;await h.service.automation.run(entry);await settle(h);assert.equal(h.submissions.length,0);assert.equal(h.service.automation.view(h.parent.id).lastRun.status,'blocked');
 }finally{h.close();}}
});
test('retired batch queues cannot be replayed',async()=>{
 const h=harness();try{h.approve(0);h.approve(1);const old={id:'old-batch',parent:h.parent.id,approvalHash:'old',profile:h.service.automation.profile(h.parent.id),status:'blocked',videos:[]};await h.service.automation.run(old);assert.equal(old.status,'retired');assert.equal(h.submissions.length,0);}finally{h.close();}
});
test('matching paid output is rebound after individual approval without creating or purchasing another video',async()=>{
 const h=harness();try{
  h.service.automation.configure(h.parent.id,settings,'Arvie');h.approve();const created=await h.service.create(h.parent.id,{index:0,avatarId:avatar.id,voiceId:voice.id,presenterAccepted:true,thumbnailTitle:'Support Letters for Your Appeal'},'Arvie');const v=h.service.get(created.id);
  v.approvalHash='old-bulk-hash';v.source.rulesHash=rulesHash;v.detectorVersion=config.video.faceDetectorVersion;v.requests={video:{id:'already-paid-provider-id',state:'completed'}};v.status='visual_review';h.service.save(v);
  h.service.automation.enqueue(h.parent.id,'Keziah',0);await settle(h);const result=h.service.get(v.id);
  assert.equal(h.submissions.length,0);assert.equal(h.service.list().length,1);assert.equal(result.requests.video.id,'already-paid-provider-id');assert.equal(result.approvalHash,approvedQuestion(h.parent,0));assert.equal(result.approvalHistory[0].approvalHash,'old-bulk-hash');assert.equal(h.service.automation.view(h.parent.id).lastRun.reusedExisting,true);assert.equal(questionState(h.parent,1).status,'pending');
 }finally{h.close();}
});
