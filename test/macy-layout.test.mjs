import {approveFixture} from './question-fixture.mjs';
import {recordQuestionReview} from '../src/question-approval.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {containsContact,endCardData,layoutVersion} from '../src/visual-checks.mjs';
import {layoutText} from '../src/layout-text.mjs';
import {visualSettings} from '../src/portrait-media.mjs';
import {rules,config,rulesHash} from '../src/rules.mjs';
import {Store} from '../src/store.mjs';
import {reconcileRules} from '../src/rules-migration.mjs';
import {VideoService} from '../src/video-service.mjs';
import {inspect,parseClients,parseMonthly} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {scriptText} from '../src/video-domain.mjs';
import {fixture} from './fixture-data.mjs';
function parent(store,old=false){const raw=fixture('paul'),row=parseMonthly(fixture('monthly')).find(r=>r.documentId===raw.documentId),doc=inspect(raw),client=parseClients(fixture('clients')).find(c=>c.key===row.clientKey),j=store.create({identity:'source',row,doc,client,mode:'saved_snapshot',rulesHash:old?'previous-1.3-rules':rulesHash,rulesVersion:old?'1.2.0':config.version});j.plan=preparedExample(doc);j.origin='Prepared in Codex';j.status='pilot_reviewed';j.reviews=[{actor:'Keziah',decision:'approve',note:'Automated fixture only'}];approveFixture(j);store.save(j);return j;}

test('the two updated sources replace the standalone layout specification',()=>{
 const ids=[...rules.matchAll(/^### L(\d{2}) /gm)].map(m=>m[1]);assert.equal(ids.length,0);assert.equal(config.sources.macyLayout,undefined);assert.equal([...rules.matchAll(/^### C\d{2} /gm)].length,36);assert.equal([...rules.matchAll(/^### V\d{2,3} /gm)].length,100);
 assert.equal(config.video.endCardSeconds,3);assert.equal(config.video.endCardTargetUrlSource,'monthly_page_url_column_E');assert.equal(config.video.mainSceneFit,'cover_crop');assert.equal(config.video.mainSceneContactFields,false);
});
test('missing target URL and contact-bearing transcripts/assets are held instead of inferred or rewritten',()=>{
 const j={articleIdentity:{name:'Example Firm',address:'123 Main Street',phone:'(555) 123-4567'},script:'What happens next? Review the evidence.',endCard:{targetUrl:'https://example.com/article'}};
 assert.equal(endCardData(j).targetUrl,j.endCard.targetUrl);assert.throws(()=>endCardData({...j,endCard:{},articleIdentity:{...j.articleIdentity,homepage:'https://example.com/'}}),/targetUrl/);
 assert.throws(()=>endCardData({...j,script:'Call (555) 123-4567 today.'}),/SCRIPT_NAP_CONFLICT/);
 assert.equal(containsContact('123 Main Street'),true);assert.equal(containsContact('Call 555 123 4567'),true);assert.equal(containsContact('www.example.com'),true);assert.equal(containsContact('Example Law Firm'),false);
 assert.throws(()=>visualSettings({captionBottom:70}),/108/);assert.throws(()=>visualSettings({logoScale:1.1}),/1.08/);
});
test('content migration archives the exact approval and requires fresh review once',()=>{
 const dir=mkdtempSync(join(tmpdir(),'layout-rule-')),store=new Store(join(dir,'db'));
 try{const j=parent(store,true),before=structuredClone(j);reconcileRules(store);const after=store.get(j.id);assert.deepEqual(after.plan,before.plan);assert.deepEqual(after.history[0].reviews,before.reviews);assert.deepEqual(after.reviews,[]);assert.equal(after.status,'content_review');assert.match(after.layoutNotice,/September 16/);const revision=after.revision;reconcileRules(store);assert.equal(store.get(j.id).revision,revision);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('captions keep actual cue timing and URL wrapping preserves the exact value',async t=>{
 if(!process.env.LOGO_CHROMIUM_PATH)return t.skip('Set a local Chromium binary.');
 const url='https://example.com/blog/a-long-article-address-that-must-remain-visible-without-an-ellipsis/';
 const text='The exact approved speech stays readable.',layout=await layoutText([{start:0,end:20,text}],{name:'Example Firm',address:'123 Main Street, Sample City',phone:'(555) 123-4567',targetUrl:url},62);
 assert.equal(layout.captions.length,1);assert.ok(layout.captions.every(c=>c.lines.length<=2));assert.equal(layout.captions.map(c=>c.lines.join(' ')).join(' '),text);assert.equal(layout.captions[0].start,0);assert.equal(layout.captions.at(-1).end,20);assert.equal(layout.fields[3].lines.join(''),url);assert.deepEqual(layout.fields.map(f=>f.key),['name','address','phone','targetUrl']);
 await assert.rejects(layoutText([{start:0,end:20,text:'This entire long answer has no word timings. '.repeat(8)}],{name:'Example Firm',address:'123 Main Street',phone:'(555) 123-4567',targetUrl:url},62),/CAPTION_TIMING_REQUIRED/);
});
test('old-layout upgrade reuses source media once without any provider call or changing the older record',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'layout-upgrade-')),store=new Store(join(dir,'db'));let paid=0;
 const s=new VideoService({store,env:{},dataDir:dir,local:true,checkFresh:async()=>{},media:{check:async()=>{}},heygen:{submit:async()=>{paid++;}},logos:{},delivery:{}});
 try{
  const p=parent(store),old={id:'old-video',identity:'old',avatar:{id:'Brandon_Business_Sitting_Front_public'},voice:{id:'00e3d285aba44b27a83c47c02c9c2d9c'},parentId:p.id,provider:'heygen',layoutVersion:'earlier',approvalHash:'earlier',source:{sourceHash:p.doc.sourceHash,folderUrl:p.row.folderUrl},client:p.client,index:0,script:scriptText(p.plan.videos[0]),requests:{video:{id:'existing-provider-id',state:'completed'}},files:{original:true,voice:true,video:true},reviews:[],status:'visual_review'};old.cues=[{start:0,end:20,text:old.script.toUpperCase()}];s.save(old);const before=s.get(old.id),folder=s.directory(old);writeFileSync(join(folder,'presenter.mp4'),'source footage fixture');writeFileSync(join(folder,'voice.wav'),'speech fixture');
  s.ensureLogo=async()=>{};s.work=async j=>{j.status='visual_review';s.save(j);};
  const next=await s.revisions.upgrade(old.id,'Macy');await new Promise(r=>setTimeout(r,20));const repeat=await s.revisions.upgrade(old.id,'Macy');assert.equal(repeat.id,next.id);assert.equal(paid,0);assert.deepEqual(s.get(old.id),before);assert.equal(next.layoutVersion,layoutVersion);assert.deepEqual(next.reviews,[]);assert.equal(next.endCard.targetUrl,p.row.pageUrl);assert.equal(readFileSync(join(s.directory(next),'presenter.mp4'),'utf8'),'source footage fixture');await assert.rejects(s.validate(old),/previous layout/);
 }finally{s.closed=true;store.close();rmSync(dir,{recursive:true,force:true});}
});
