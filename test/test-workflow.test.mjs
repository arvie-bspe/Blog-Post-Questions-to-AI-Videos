import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {ScriptWorkflow} from '../src/script-workflow.mjs';
import {DriveDelivery} from '../src/drive-delivery.mjs';
import {GoogleConnection,googleScopes} from '../src/google-connection.mjs';
import {LogoService} from '../src/logos.mjs';
import {publicIP,webURL} from '../src/safe-web.mjs';
import {liveSource} from '../src/integrations.mjs';
import {inspect,parseClients,validatePlan} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {rulesHash} from '../src/rules.mjs';
const fixture=n=>JSON.parse(readFileSync(new URL('../fixtures/'+n+'.json',import.meta.url)));
const wait=async()=>new Promise(r=>setTimeout(r,20));
test('live inspection reads the selected row in J/L, discovers visible tabs, and refuses ineligible orders',async()=>{
  const monthly=fixture('monthly'),source=fixture('paul'),header=monthly.data[0].rowData[0],target=monthly.data[0].rowData[1],calls=[];
  const sheet={sheetId:123,title:'October 2026',gridProperties:{rowCount:200}};
  let bad=false;
  const read=async url=>{calls.push(url);if(url.includes('fields=sheets.properties'))return {sheets:[{properties:sheet}]};if(url.includes('includeGridData')){const row=structuredClone(target);if(bad)row.values[1]={formattedValue:'Social Post'};return {sheets:[{properties:sheet,data:[{startRow:0,rowData:[header]},{startRow:99,rowData:[row]}]}]};}if(url.includes('/values/'))return {values:fixture('clients')};return source;};
  const result=await liveSource(sheet.title,100,{read});assert.equal(result.row.rowNumber,100);assert.equal(result.row.documentId,source.documentId);assert.match(result.client.homepage,/michigandefenselaw/);assert.ok(calls.some(u=>decodeURIComponent(u).includes('A100:L100')));
  bad=true;await assert.rejects(liveSource(sheet.title,100,{read}),/not eligible/);await assert.rejects(liveSource('Hidden tab',100,{read}),/visible worksheet/);
});
test('without OpenAI, feedback creates a visible revision request and keeps original script and review',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'script-feedback-')),store=new Store(join(dir,'db'));try{
    const doc=inspect(fixture('paul')),client=parseClients(fixture('clients'))[0],job=store.create({identity:'feedback',rulesHash,doc,client});job.plan=preparedExample(doc);job.reviews=[{actor:'Keziah',decision:'reject',note:'Remove repeated explanation.'}];store.save(job);
    const before=structuredClone(job.plan),workflow=new ScriptWorkflow({store,env:{},checkFresh:async()=>{}}),result=await workflow.start(job.id,'Remove repeated explanation.');assert.equal(result.status,'revision_pending');assert.deepEqual(result.plan,before);assert.equal(result.reviews.length,1);assert.equal(result.revisionRequest.status,'awaiting_manual_update');assert.match(result.error,/no automatic rewrite/);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('connected script rewrite receives feedback and prior draft, saves history, and requires new review',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'script-auto-')),store=new Store(join(dir,'db'));try{
    const doc=inspect(fixture('paul')),client=parseClients(fixture('clients'))[0],job=store.create({identity:'rewrite',rulesHash,doc,client});job.plan=preparedExample(doc);job.origin='Prepared test';job.reviews=[{actor:'Keziah',decision:'reject',note:'Shorten the second answer.'}];store.save(job);const before=structuredClone(job.plan);
    let calls=0,release;const gate=new Promise(r=>release=r),workflow=new ScriptWorkflow({store,env:{OPENAI_API_KEY:'mock'},checkFresh:async()=>{},analyzer:async(d,c,options)=>{calls++;assert.deepEqual(options.previousPlan,before);assert.equal(options.feedback,'Shorten the second answer.');await gate;const plan=structuredClone(before);plan.videos[1].sentences.pop();return {plan,validation:validatePlan(plan,d,c),audit:{passed:true,issues:[]}};}});
    await workflow.start(job.id,'Shorten the second answer.');await assert.rejects(workflow.start(job.id),/already/);release();await wait();const after=store.get(job.id);assert.equal(calls,1);assert.equal(after.status,'content_review');assert.equal(after.reviews.length,0);assert.deepEqual(after.history[0].plan,before);assert.equal(after.revisionRequest.status,'applied');
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('Google OAuth checks authentication, state, PKCE and scopes, and keeps the refresh token out of status',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'google-connect-')),old=process.env.GOOGLE_REFRESH_TOKEN;
  try{
    const env={GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'},g=new GoogleConnection({env,dataDir:dir,origin:'https://studio.test',fetcher:async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.ok(options.body.get('code_verifier'));return Response.json({refresh_token:'test-refresh',scope:googleScopes.join(' ')});}});
    assert.throws(()=>g.start(''),/Sign in/);await assert.rejects(g.callback(new URLSearchParams({state:'bogus',code:'test'})),/expired/);
    const url=new URL(g.start('Workspace admin').url);assert.equal(url.searchParams.get('code_challenge_method'),'S256');await g.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'test-code'}));assert.equal(g.status().connected,true);assert.doesNotMatch(JSON.stringify(g.status()),/test-refresh|test-secret/);assert.ok(existsSync(join(dir,'google-connection.private.json')));
    await assert.rejects(g.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'test-code'})),/expired/);
  }finally{if(old===undefined)delete process.env.GOOGLE_REFRESH_TOKEN;else process.env.GOOGLE_REFRESH_TOKEN=old;rmSync(dir,{recursive:true,force:true});}
});
test('Drive delivery requires approval and reconciles an uncertain upload using the same ID',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drive-delivery-'));try{
    for(const name of ['final.mp4','thumbnail.png','captions.vtt'])writeFileSync(join(dir,name),'test-data');
    const remote=new Map(),sessions=new Map();let counter=0,uploads=0,loseResponse=true;
    const fetcher=async(url,o)=>{
      assert.equal(o.headers.Authorization,'Bearer mock-google-token');
      if(url.includes('/files/folder123?'))return Response.json({id:'folder123',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
      if(url.includes('/generateIds?'))return Response.json({ids:['id'+(++counter)]});
      if(o.method==='POST'){const data=JSON.parse(o.body);sessions.set(data.id,data);return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/test/'+data.id}});}
      if(o.method==='PUT'){const id=url.split('/').at(-1),data={...sessions.get(id),size:'9',webViewLink:'https://drive.google.com/file/d/'+id+'/view'};remote.set(id,data);uploads++;let bytes=0;for await(const chunk of o.body)bytes+=chunk.length;assert.equal(bytes,9);if(loseResponse){loseResponse=false;throw new Error('Simulated response loss after upload');}return Response.json(data);}
      const id=new URL(url).pathname.split('/').at(-1);return remote.has(id)?Response.json(remote.get(id)):new Response(null,{status:404});
    };
    const delivery=new DriveDelivery({fetcher,token:async()=> 'mock-google-token'}),j={id:'video-test',thumbnailTitle:'Test Video Only',status:'visual_review',outputRevision:1,source:{folderUrl:'https://drive.google.com/drive/folders/folder123'},reviews:[]};
    await assert.rejects(delivery.deliver(j,dir,()=>{},async()=>{}),/reviewer/);assert.equal(uploads,0);
    j.status='delivery_pending';j.reviews=[{actor:'Macy',decision:'approve'}];await assert.rejects(delivery.deliver(j,dir,()=>{},async()=>{}),/response loss/);const first=j.delivery.files['final.mp4'].id;
    await delivery.deliver(j,dir,()=>{},async()=>{});assert.equal(j.status,'delivered');assert.equal(j.delivery.files['final.mp4'].id,first);assert.equal(uploads,3);assert.equal(remote.size,3);assert.ok(Object.values(j.delivery.files).every(f=>f.state==='complete'));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('logo downloads reject local networks, credentials and unexpected protocols',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','169.254.169.254','192.168.1.1','::1','fc00::1','::ffff:127.0.0.1'])assert.equal(publicIP(ip),false);
  for(const url of ['http://example.com','https://localhost/','https://127.0.0.1/','https://user:secret@example.com/','file:///private'])assert.throws(()=>webURL(url));assert.equal(publicIP('8.8.8.8'),true);
});
test('SVG homepage logo is rasterised with Chromium and cached by domain',async t=>{
  if(!process.env.LOGO_CHROMIUM_PATH)return t.skip('Set LOGO_CHROMIUM_PATH for the local Chromium integration check.');
  const dir=mkdtempSync(join(tmpdir(),'logo-svg-')),calls=[];
  try{
    const logo=new LogoService(dir,{fetcher:async url=>{calls.push(url);return url.endsWith('/brand.svg')?{url,headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="#253963"/><text x="20" y="65" font-size="40" fill="white">TEST FIRM</text></svg>')}:{url,headers:{'content-type':'text/html'},body:Buffer.from('<img alt="Firm logo" src="/brand.svg">')};}});
    const parent={client:{name:'Test Firm',homepage:'https://firm.example/'},row:{}};const first=await logo.acquire(parent),second=await logo.acquire(parent);assert.equal(first.domain,'firm.example');assert.equal(first.hash,second.hash);assert.equal(calls.length,2);assert.equal(readFileSync(first.path).subarray(1,4).toString(),'PNG');assert.equal(first.sourceContentType,'image/svg+xml');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
