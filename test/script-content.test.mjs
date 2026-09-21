import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeScriptOpening,repeatsScriptHeading} from '../src/script-content.mjs';
import {validateDirectResult} from '../src/direct-ai.mjs';
import {validateDirectPlan,validatePlan} from '../src/domain.mjs';
import {scriptText} from '../src/video-domain.mjs';
import {approvedQuestion,questionHash,recordQuestionReview} from '../src/question-approval.mjs';
import {directMode,scriptPolicyHash} from '../src/workflow-config.mjs';

const answer='The firm files the form electronically.';
const evidence=[{paragraphId:'p1',quote:answer}];
const video=()=>({candidateId:'q1',question:'How does filing work?',thumbnailTitle:'How Filing Works',reason:'A useful procedural explanation.',selectionKind:'formulated_source',supportingParagraphIds:['p1'],runtimeReason:'',sentences:[{text:answer,evidence}],cta:'',disclaimer:'',reviewFlags:[]});
const doc={sourceHash:'source',questionSelectionMode:'ai_independent',paragraphs:[{id:'p1',style:'NORMAL_TEXT',text:answer}],candidates:[{id:'q1',question:'How does filing work?'}]};
const planFor=v=>({videos:[v],skipped:[]});

test('AI opening cleanup keeps one spoken question and preserves answer evidence',()=>{
  for(const opening of ['How does filing work?','HOW DOES FILING WORK!','How  does\nfiling work?','**How does filing work?**','How Filing Works:']){
    const input=video();input.sentences[0].text=opening+' '+answer;
    const before=structuredClone(input),clean=normalizeScriptOpening(input);
    assert.deepEqual(clean.sentences,[{text:answer,evidence}]);assert.deepEqual(input,before);
    assert.equal(scriptText(clean),'How does filing work?\n\n'+answer);
  }
});

test('standalone and consecutive duplicate headings are removed before draft validation',()=>{
  const input=video();input.sentences=[{text:'How does filing work?',evidence:[]},{text:'How Filing Works',evidence:[]},{text:'How does filing work? '+answer,evidence}];
  const result=validateDirectResult({plan:planFor(input),audit:{passed:true,issues:[]}},{doc});
  assert.deepEqual(result.validation.errors,[]);assert.deepEqual(result.plan.videos[0].sentences,[{text:answer,evidence}]);
  assert.equal(input.sentences.length,3);
});

test('cleanup leaves substantive wording and overlapping title phrases intact',()=>{
  for(const text of ['How filing works depends on the court.','How does filing work differ between courts?','The firm explains how filing works.','How filing works, including exceptions, is described here.']){
    const input=video();input.sentences[0].text=text;
    assert.deepEqual(normalizeScriptOpening(input),input);assert.equal(repeatsScriptHeading(input),false);
  }
});

test('a title alone cannot become an empty approved answer or conceal missing evidence',()=>{
  const input=video();input.sentences=[{text:input.question,evidence}];
  assert.match(validateDirectResult({plan:planFor(input),audit:{passed:true,issues:[]}},{doc}).validation.errors.join(' '),/empty answer/);
  input.sentences=[{text:input.question+' '+answer,evidence:[]}];
  assert.match(validateDirectResult({plan:planFor(input),audit:{passed:true,issues:[]}},{doc}).validation.errors.join(' '),/each sentence needs article evidence/);
});

test('remaining repeats are blocked in both validation paths and narration',()=>{
  for(const repeated of [input=>input.sentences.push({text:input.question,evidence}),input=>{input.sentences[0].text=answer+' '+input.question;},input=>{input.cta=input.question;}]){
    const input=video();repeated(input);const plan=planFor(input);
    assert.match(validateDirectPlan(plan,doc).errors.join(' '),/repeats its title/);
    assert.match(validatePlan(plan,doc,{}).errors.join(' '),/repeats its title/);
    assert.throws(()=>scriptText(input),/repeats its title/);
  }
});

test('historical approval cannot render a repeated title and saved wording remains intact',()=>{
  const input=video();input.sentences[0].text=input.question+' '+answer;
  const job={mode:directMode,scriptRulesHash:scriptPolicyHash,doc,client:{},plan:planFor(input),auditRequired:true,audit:{passed:true,issues:[]}};
  recordQuestionReview(job,0,{decision:'approve',actor:'Reviewer'});const before=structuredClone(job),fingerprint=questionHash(job,0);
  assert.throws(()=>approvedQuestion(job,0),/content checks/);assert.deepEqual(job,before);assert.equal(questionHash(job,0),fingerprint);
});
