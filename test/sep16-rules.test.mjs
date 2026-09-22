import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspect,withClientSelection,validatePlan} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {requireArticleIdentity,presenterGender} from '../src/article-identity.mjs';
import {assertFreshPresenterPair,choosePresenter,paidPresenterHistory,presenterPool} from '../src/presenter-selection.mjs';
import {Store} from '../src/store.mjs';
import {ScriptWorkflow} from '../src/script-workflow.mjs';
import {adoptSourceIdentity} from '../src/source-records.mjs';
import {fixture} from './fixture-data.mjs';
const raw=fixture('paul'),doc=inspect(raw),plan=preparedExample(doc);
test('refresh links empty duplicate inspections while preserving every record and any existing draft',()=>{
 const dir=mkdtempSync(join(tmpdir(),'source-link-')),store=new Store(join(dir,'db'));
 try{const old=store.create({identity:'snapshot',plan}),empty=store.create({identity:'live'});
 assert.equal(adoptSourceIdentity(store,old,'live'),true);store.save(old);assert.equal(store.list().length,2);assert.equal(store.get(empty.id).supersededBy,old.id);assert.deepEqual(store.get(old.id).plan,plan);
 const withDraft=store.create({identity:'another-live',plan});assert.equal(adoptSourceIdentity(store,old,'another-live'),false);assert.equal(store.get(withDraft.id).supersededBy,undefined);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('article identity requires article evidence and never falls back to a directory office',()=>{
 assert.equal(requireArticleIdentity(doc,plan.articleIdentity).address,plan.articleIdentity.address);
 assert.throws(()=>requireArticleIdentity(doc,{...plan.articleIdentity,address:'123 Different Office'}),/address/);
 assert.throws(()=>requireArticleIdentity(doc,{name:'Client Directory',address:'Directory office',phone:'555-123-4567'}),/MISSING_REQUIRED_END_CARD_DATA/);
});
test('presenter selection respects explicit blurb information and rotates people within a batch',()=>{
 const parent={id:'test',client:{key:'Paul'},doc,plan};
 assert.equal(presenterGender(doc,plan.presenterContext),'male');
 const maleFirst=choosePresenter(parent,0),maleSecond=choosePresenter(parent,1,[],[maleFirst]);assert.equal(maleFirst.avatar.gender,'male');assert.notEqual(maleSecond.avatar.personKey,maleFirst.avatar.personKey);assert.notEqual(maleSecond.voice.id,maleFirst.voice.id);
 assert.equal(presenterGender(doc,{gender:'female',lawyerBlurbParagraphIds:[]}),null);
 const unknown={...parent,plan:{...plan,presenterContext:{gender:'unspecified',lawyerBlurbParagraphIds:[]}}};
 const first=choosePresenter(unknown,0),second=choosePresenter(unknown,1,[],[first]);
 assert.notEqual(first.avatar.personKey,second.avatar.personKey);assert.notEqual(first.voice.id,second.voice.id);
 const history=[{client:{key:'Different client'},avatar:first.avatar,voice:first.voice,requests:{video:{id:'paid-once',submittedAt:'2026-09-22T10:00:00Z'}},created:'2026-09-22T10:00:00Z'}];
 const rotated=choosePresenter(unknown,0,history);assert.notEqual(rotated.avatar.personKey,first.avatar.personKey);assert.notEqual(rotated.voice.id,first.voice.id);assert.doesNotThrow(()=>assertFreshPresenterPair(rotated,history));assert.throws(()=>assertFreshPresenterPair(first,history),/different avatar/);
 assert.deepEqual(choosePresenter(unknown,0),first);
 assert.ok(presenterPool.voices.some(v=>v.id===first.voice.id));
 const rebuild={...history[0],id:'free-layout-copy',created:'2026-09-22T11:00:00Z'};assert.equal(paidPresenterHistory([history[0],rebuild]).length,1);
 const onePair={version:'one-pair-test',avatars:[{id:'only-avatar',personKey:'Only Person',name:'Only',type:'studio_avatar',gender:'male'}],voices:[{id:'only-voice',name:'Only Voice',type:'heygen_voice',gender:'male'}]};
 const only=choosePresenter(parent,0,[],[],onePair),used=[{avatar:only.avatar,voice:only.voice,requests:{video:{id:'only-paid',submittedAt:'2026-09-22T12:00:00Z'}}}];assert.throws(()=>choosePresenter(parent,1,used,[],onePair),/ROTATION_UNAVAILABLE/);
});
test('H4 and lawyer-hiring topics are excluded; FAQ evidence must independently come from main H2/H3 content',()=>{
 const p=(text,namedStyleType,startIndex)=>({text,namedStyleType,startIndex});
 const d=withClientSelection(inspect({title:'Source',paragraphs:[p('Source','HEADING_1',1),p('What proof is needed?','HEADING_2',2),p('Signed records provide proof of the event.','NORMAL_TEXT',3),p('What secondary rule applies?','HEADING_4',4),p('A minor subheading detail.','NORMAL_TEXT',5),p('Do I need a lawyer?','HEADING_2',6),p('Speak with a lawyer.','NORMAL_TEXT',7),p('Frequently Asked Questions','HEADING_2',8),p('How do records help?','HEADING_3',9),p('FAQ-only discussion of the topic.','NORMAL_TEXT',10)]}),'Sample');
 assert.ok(!d.candidates.some(c=>/secondary|lawyer/.test(c.question)));
 const faq=d.candidates.find(c=>c.requiresMainBodySupport),body=d.paragraphs.find(p=>p.text==='Signed records provide proof of the event.'),faqBody=d.paragraphs.find(p=>p.text==='FAQ-only discussion of the topic.');
 assert.ok(faq);
 const v={candidateId:faq.id,question:faq.question,selectionKind:'supported_faq',reason:'The main-body evidence independently answers this topic.',supportingParagraphIds:[body.id],sentences:[{text:'Signed records provide proof of the event.',evidence:[{paragraphId:body.id,quote:body.text}]}]};
 assert.deepEqual(validatePlan({videos:[v],skipped:[]},d,{key:'Sample'}).errors,[]);
 v.sentences[0].evidence=[{paragraphId:faqBody.id,quote:faqBody.text}];
 assert.match(validatePlan({videos:[v],skipped:[]},d,{key:'Sample'}).errors.join(' '),/above the FAQs/);
});
test('manual revision requests retain every current reviewer note without claiming an API rewrite',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'script-feedback-')),store=new Store(join(dir,'db'));
 try{const j=store.create({identity:'notes',plan,reviews:[{decision:'reject',note:'Make the flow smoother.'},{decision:'reject',note:'Replace the FAQ question.'}]});j.reviews=[{decision:'reject',note:'Make the flow smoother.'},{decision:'reject',note:'Replace the FAQ question.'}];store.save(j);
 const workflow=new ScriptWorkflow({store,env:{},checkFresh:async()=>{}});await workflow.start(j.id,'Replace the FAQ question.');const next=store.get(j.id);
 assert.equal(next.status,'revision_pending');assert.match(next.revisionRequest.feedback,/flow smoother/);assert.equal(next.revisionRequest.feedback.match(/Replace the FAQ question/g).length,1);assert.deepEqual(next.plan,plan);assert.match(next.error,/no automatic rewrite/);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
