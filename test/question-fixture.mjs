import {recordQuestionReview} from '../src/question-approval.mjs';
export function approveFixture(job,index){
 const ids=index===undefined?job.plan.videos.map((_,i)=>i):[index];
 for(const i of ids)recordQuestionReview(job,i,{actor:'Keziah',decision:'approve',note:'AUTOMATED TEST FIXTURE ONLY.',at:'2026-09-16T00:00:00Z'});
 return job;
}
