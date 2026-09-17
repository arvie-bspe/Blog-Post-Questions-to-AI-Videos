import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect,paragraphsFromGoogle,parseMonthly,parseClients,selectClient,validatePlan,containsTerm,orderAllowed,cellText,identity} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {clientRules,globalContent,rulesHash,config} from '../src/rules.mjs';
import {fixture as read} from './fixture-data.mjs';
const doc=inspect(read('paul')),client=parseClients(read('clients'))[0];
const plan=()=>preparedExample(doc);
test('Paul example uses 2 real body questions, exact quotes, and passes local checks',()=>{
  assert.ok(!doc.candidates.some(c=>/need.*lawyer/i.test(c.question)));assert.equal(plan().videos.length,2);assert.deepEqual(validatePlan(plan(),doc,client),{errors:[],warnings:[]});
  assert.equal(doc.excluded.filter(h=>h.reason.startsWith('Page title')).length,1);
});
test('monthly mapping requires article J and Visual L, never substitutes PR doc K',()=>{
  const sheet=read('monthly');assert.equal(parseMonthly(sheet)[0].documentId,doc.documentId);
  sheet.data[0].rowData[0].values[9].formattedValue='PR Doc';assert.throws(()=>parseMonthly(sheet),/column J/);
});
test('eligible orders include the known spacing alias but reject unrelated orders',()=>{
  assert.equal(orderAllowed('Rewrite - URL Change'),true);assert.equal(orderAllowed('Technical SEO'),false);
});
test('sheet link extraction accepts smart links and rejects ambiguity',()=>{
  assert.equal(cellText({chipRuns:[{chip:{richLinkProperties:{uri:'https://docs.google.com/document/d/test/edit'}}}]}),'https://docs.google.com/document/d/test/edit');
  assert.throws(()=>cellText({hyperlink:'https://a.test',textFormatRuns:[{format:{link:{uri:'https://b.test'}}}]}),/multiple links/);
});
test('question-shaped title and normal-text questions are excluded',()=>{
  const p=(text,namedStyleType,startIndex)=>({text,namedStyleType,startIndex});
  const inspected=inspect({title:'How do I apply?',paragraphs:[p('How do I apply?','HEADING_1',1),p('What is needed?','NORMAL_TEXT',2),p('Application requirements','HEADING_2',3),p('What proof is needed?','HEADING_2',4),p('The proof is described here.','NORMAL_TEXT',5)]});
  assert.deepEqual(inspected.candidates.map(c=>c.question),['What proof is needed?']);
});
test('tabs without a primary heading are held; nested tables and tabs are read',()=>{
  const paragraph={elements:[{textRun:{content:'What evidence?\n'}}],paragraphStyle:{namedStyleType:'HEADING_2'}};
  const d={tabs:[{tabProperties:{tabId:'first'},documentTab:{body:{content:[{startIndex:1,paragraph}]}},childTabs:[{tabProperties:{tabId:'child'},documentTab:{body:{content:[{table:{tableRows:[{tableCells:[{content:[{startIndex:2,paragraph}]}]}]}}]}}}]}]};
  assert.equal(paragraphsFromGoogle(d).length,2);assert.equal(inspect(d).candidates.length,0);
});
test('unsupported quotes, invented headings, duplicates and excess videos fail',()=>{
  const p=plan();p.videos[0].sentences[0].evidence[0].quote='Invented legal fact which is not in this source.';p.videos[1].question='An invented question?';p.videos.push(...p.videos,...p.videos);
  const errors=validatePlan(p,doc,client).errors.join(' ');assert.match(errors,/evidence/);assert.match(errors,/eligible heading/);assert.match(errors,/duplicate/);assert.match(errors,/maximum/);
});
test('zero videos is valid, and client maximum is respected',()=>{
  assert.deepEqual(validatePlan({videos:[],skipped:[]},doc,client).errors,[]);assert.match(validatePlan(plan(),doc,{...client,maxVideos:1}).errors.join(' '),/maximum/);
});
test('conditional terms remain review flags; prohibited words use boundaries and case folding',()=>{
  assert.equal(containsTerm('ENSURE compliance','ensure'),true);assert.equal(containsTerm('reinsurance','ensure'),false);
  const p=plan();p.videos[0].sentences[0].text='Never assume the letters are sufficient.';
  const r=validatePlan(p,doc,client);assert.equal(r.errors.length,0);assert.match(r.warnings.join(' '),/never/);
  p.videos[0].sentences[0].text='Generally, ensure compliance.';assert.match(validatePlan(p,doc,client).errors.join(' '),/generally/);
});
test('unapproved CTA, prohibited punctuation, and prohibited starts fail',()=>{
  const p=plan();p.videos[0].cta='Call us now.';p.videos[0].sentences[0].text='Because evidence matters: this is required.';
  const errors=validatePlan(p,doc,client).errors.join(' ');assert.match(errors,/cta/);assert.match(errors,/colon/);assert.match(errors,/Because/);
});
test('a real quote does not guarantee entailment; local validation is deliberately not a semantic pass',()=>{
  const p=plan();p.videos[0].sentences[0].text='Two unsigned letters are enough for every hearing.';
  assert.equal(validatePlan(p,doc,client).errors.length,0); // Independent source audit + human review must catch this.
});
test('malformed entries fail without crashing',()=>{assert.ok(validatePlan({videos:[null],skipped:[]},doc,client).errors.length);assert.ok(validatePlan({videos:[{sentences:[null]}],skipped:[]},doc,client).errors.length);});
test('client matching and specific rules cannot leak between clients',()=>{
  assert.throws(()=>selectClient([client,client],'Paul'),/one exact match/);assert.equal(clientRules('Paul'),'');assert.match(clientRules('Davies'),/trustor/i);assert.doesNotMatch(clientRules('Davies'),/Khan Law/);assert.doesNotMatch(globalContent,/#### C32\.4/);
});
test('idempotency covers source and rules, independent of monthly row number',()=>{
  const row=parseMonthly(read('monthly'))[0];assert.equal(identity(row,doc,'test',rulesHash),identity({...row,rowNumber:99,sheetName:'August 2026'},doc,'test',rulesHash));assert.notEqual(identity(row,doc,'test',rulesHash),identity(row,{...doc,sourceHash:'changed'},'test',rulesHash));
});
test('latest override requires logo and defers colors and stores the unverified Paul task',()=>{
  assert.equal(config.video.testBranding.logoEnabled,true);assert.equal(config.video.testBranding.brandColorsEnabled,false);assert.equal(config.workflow.testTaskMappings[0].taskId,'z90hj2zccq');assert.equal(config.workflow.testTaskMappings[0].verification,'pending');assert.equal(config.workflow.automaticTriggersEnabled,false);
});
test('manual pilot ignores missing or malformed ClickUp cells',()=>{
  const sheet=read('monthly');sheet.data[0].rowData[0].values[7]={};sheet.data[0].rowData[0].values[8]={};
  sheet.data[0].rowData[1].values[8]={hyperlink:'https://a.test',textFormatRuns:[{format:{link:{uri:'https://b.test'}}}]};
  const row=parseMonthly(sheet)[0];assert.equal(row.documentId,doc.documentId);assert.deepEqual(row.issues,[]);assert.equal(row.taskUrl,'');assert.equal(config.workflow.approvalChecksEnabled,false);
});
