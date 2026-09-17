import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {Store} from '../src/store.mjs';
import {createSecurity} from '../src/security.mjs';
import {createApp} from '../src/server.mjs';
import {responseJSON} from '../src/ai.mjs';
test('durable jobs suppress duplicates and interrupted requests require explicit retry',()=>{
  const dir=mkdtempSync(join(tmpdir(),'video-store-'));
  try{let store=new Store(join(dir,'db'));const j=store.create({identity:'one'});assert.equal(store.create({identity:'one'}).id,j.id);j.status='analyzing';store.save(j);store.consume(1);assert.throws(()=>store.consume(1),/limit/);store.close();store=new Store(join(dir,'db'));assert.equal(store.get(j.id).status,'interrupted');store.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('public hosting requires HTTPS origin and three distinct strong passwords',()=>{
  assert.throws(()=>createSecurity({HOST:'0.0.0.0'}),/HTTPS/);
  assert.throws(()=>createSecurity({HOST:'0.0.0.0',APP_ORIGIN:'https://studio.test'}),/passwords/);
  const s=createSecurity({HOST:'0.0.0.0',APP_ORIGIN:'https://studio.test',ARVIE_PASSWORD:'arvie-long-test-password',KEZIAH_PASSWORD:'keziah-long-test-password',MACY_PASSWORD:'macy-long-test-password'});
  assert.equal(s.actor({headers:{}}),null);const token=s.login('Keziah','keziah-long-test-password','test');assert.equal(s.actor({headers:{cookie:'studio_session='+token}}),'Keziah');assert.match(s.cookie(token),/HttpOnly/);assert.match(s.cookie(token),/Secure/);
});
test('API rejects incomplete/refused output without accepting a draft',async()=>{
  const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='mock-only';
  try{
    for(const body of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]}])await assert.rejects(responseJSON({schema:{},name:'test',instructions:'',data:{},fetcher:async()=>({ok:true,json:async()=>body})}),/incomplete|declined/);
    const value=await responseJSON({schema:{},name:'test',instructions:'',data:{},fetcher:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]})})});assert.deepEqual(value,{ok:true});
  }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
test('local pilot inspect, example, review, permissions, failures, and exports',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'video-http-')),app=createApp({HOST:'127.0.0.1',PORT:'4173',APP_ORIGIN:'http://127.0.0.1:4173',DATA_DIR:dir,SYNTHETIC_TEST_FIXTURES:'true'});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const root=`http://127.0.0.1:${app.server.address().port}`;
  const request=(path,body,actor='Arvie',origin='http://127.0.0.1:4173')=>new Promise((resolve,reject)=>{
    const req=httpRequest(root+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Host:'127.0.0.1:4173',Origin:origin,'Content-Type':'application/json','X-Reviewer':actor}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(text)});}catch(e){reject(e);}});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  try{
    assert.equal((await request('bootstrap')).status,200);
    assert.equal((await request('inspect',{article:'paul'},'Arvie','https://evil.test')).status,403);
    const dispatches=[],enqueue=app.video.automation.enqueue.bind(app.video.automation);app.video.automation.enqueue=(id,actor,index)=>{dispatches.push({id,actor,index});return enqueue(id,actor,index);};
    let {body:job}=await request('inspect',{article:'paul'});assert.ok(job.doc.candidates.length);assert.ok(!job.doc.candidates.some(c=>/need.*lawyer/i.test(c.question)));
    const deferred=await request(`jobs/${job.id}/verify-task`,{});assert.equal(deferred.status,409);assert.match(deferred.body.error,/deferred/);
    assert.equal((await request('inspect',{article:'paul'})).body.id,job.id);
    assert.equal((await request(`jobs/${job.id}/analyze`,{})).status,400);
    job=(await request(`jobs/${job.id}/example`,{})).body;assert.equal(job.plan.videos.length,2);
    assert.equal((await request(`jobs/${job.id}/example`,{})).status,409);
    assert.equal((await request(`jobs/${job.id}/review`,{index:0,decision:'approve',note:'Source reviewed carefully.'},'Keziah')).status,400);
    const approval=await request(`jobs/${job.id}/review`,{index:0,decision:'approve',note:'Automated QA exercise only. A team member must do the actual source review.',checkedEvidence:true},'Macy');assert.equal(approval.status,200,approval.body.error);job=approval.body;
    assert.equal(job.status,'partially_reviewed');assert.equal(job.questionStates[1].status,'pending');assert.equal(job.reviews[0].testOnly,true);assert.equal(job.reviews[0].authenticated,false);
    const settings={index:0,avatarId:'unknown-presenter',voiceId:'unknown-voice',presenterAccepted:true,thumbnailTitle:'Support Letters for Your Appeal'};
    const video=await request(`jobs/${job.id}/videos`,settings,'Macy');
    assert.equal(video.status,400);assert.match(video.body.error,/HeyGen public library/);
    assert.equal((await request(`jobs/${job.id}/videos`)).body.length,0);
    assert.equal((await request(`jobs/${job.id}/videos`,settings,'Keziah')).status,400);
    const videoConfig=(await request('video-config')).body;assert.equal(videoConfig.backend,'HeyGen');assert.equal(videoConfig.configured,false);
    const noKey=await request('video-library?kind=avatars');assert.equal(noKey.status,400);assert.match(noKey.body.error,/HEYGEN_API_KEY/);
    assert.equal((await request('video-settings',{falKey:'old-fal-key'})).status,403);
    assert.equal((await request(`jobs/${job.id}/export`)).body.doc.sourceHash,job.doc.sourceHash);
    assert.equal((await request(`jobs/${job.id}/review`,{index:0,decision:'approve',note:'Repeated approval must not run twice.',checkedEvidence:true},'Keziah')).status,409);
    assert.deepEqual(dispatches,[{id:job.id,actor:'Macy',index:0}]);
    job.status='content_review';job.questionReviews=[];job.origin='OpenAI API draft with separate semantic review';job.audit={passed:false,issues:['Unsupported claim.']};app.store.save(job);
    assert.match((await request(`jobs/${job.id}/review`,{index:0,decision:'approve',note:'Attempting to bypass failed audit.',checkedEvidence:true},'Keziah')).body.error,/unresolved/);
    job.validation={errors:['test']};job.status='analyzing';app.store.save(job);assert.equal((await request(`jobs/${job.id}/review`,{decision:'reject',note:'Cannot review during analysis.'},'Keziah')).status,409);
  }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
