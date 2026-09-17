import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspect,parseClients} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {rulesHash} from '../src/rules.mjs';
import {questionState,recordQuestionReview} from '../src/question-approval.mjs';
import {workflowStep} from '../src/workflow-step.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL('../fixtures/'+name+'.json',import.meta.url)));
const job=()=>{const doc=inspect(fixture('paul'));return {id:'step-test',identity:'step-test',doc,client:parseClients(fixture('clients'))[0],plan:preparedExample(doc),mode:'saved_snapshot',rulesHash,origin:'Manual draft',status:'content_review',reviews:[]};};

test('current step reports mixed per-question progress instead of an article-wide approval',()=>{
  const value=job();assert.equal(workflowStep(value).label,'2 scripts ready for review');
  recordQuestionReview(value,0,{actor:'Reviewer',decision:'approve',note:'Evidence checked for this script.'});recordQuestionReview(value,1,{actor:'Reviewer',decision:'skip',note:'This question is not needed for video.'});
  assert.equal(value.status,'pilot_reviewed');assert.equal(questionState(value,1).status,'skipped');
  const step=workflowStep(value,[{index:0,status:'visual_review'}]);assert.equal(step.label,'1 video ready for review');assert.equal(step.tab,'video');
});

test('a pending sibling stays visible while an approved question video is processing',()=>{
  const value=job();recordQuestionReview(value,0,{actor:'Reviewer',decision:'approve',note:'Evidence checked for this script.'});
  const step=workflowStep(value,[{index:0,status:'working'}]);assert.equal(step.label,'1 video processing · 1 script ready for review');assert.equal(value.status,'partially_reviewed');
});
