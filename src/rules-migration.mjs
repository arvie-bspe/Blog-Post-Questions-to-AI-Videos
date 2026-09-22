import {config,rulesHash} from './rules.mjs';
import {validatePlan,withClientSelection,recordIdentity} from './domain.mjs';

// Content changes require fresh approval; an explicitly declared appearance-only update preserves it.
export function reconcileRules(store){
  for(const job of store.list()){
    if(!job.rulesHash||job.rulesHash===rulesHash)continue;
    const perQuestion=config.rules.perQuestionMigrationFromHashes?.includes(job.rulesHash);
    const visualOnly=config.rules.visualOnlyFromHashes?.includes(job.rulesHash);
    const approvalCompatible=config.rules.approvalCompatibleFromHashes?.includes(job.rulesHash);
    const preserveApproval=visualOnly||approvalCompatible;
    // Appearance and future-render workflow changes do not manufacture, revoke
    // or replay script reviews.
    if(preserveApproval)job.scriptRulesHash=job.scriptRulesHash||job.rulesHash;else delete job.scriptRulesHash;
    job.history=[...(job.history||[]),{at:job.updated,plan:job.plan,reviews:job.reviews,origin:job.origin,audit:job.audit,validation:job.validation,revision:job.revision,rulesHash:job.rulesHash,rulesVersion:job.rulesVersion,reason:'Global rules updated; fresh review required.'}];
    job.rulesHash=rulesHash;job.rulesVersion=config.version;if(!preserveApproval)job.reviews=[];if(perQuestion){job.questionReviews=[];job.questionRequests={};job.questionAudits={};}
    job.doc=withClientSelection(job.doc,job.client.key);
    if(!preserveApproval)job.layoutNotice='Updated September 16: new script approval required. Previous scripts, feedback and videos remain in history.';
    const nextIdentity=job.row?recordIdentity(job.row,job.doc,job.mode,rulesHash,job.client):job.identity;
    if(job.plan){job.validation=validatePlan(job.plan,job.doc,job.client);if(!preserveApproval)job.status=job.validation.errors.length?'needs_review':'content_review';}
    else job.status='inspected';
    if(!preserveApproval&&(job.auditRequired===true||/^(?:OpenAI API|Local Codex worker|Claude API) draft\b/i.test(job.origin||'')))job.audit={passed:false,issues:['The content rules changed. Run a fresh source audit before approving this draft.']};
    if(visualOnly){job.history.at(-1).reason='Appearance-only update. Existing script and content decisions preserved.';job.layoutNotice='The current layout rules apply to regenerated videos. Existing videos need the updated layout and a fresh video review.';}
    else if(approvalCompatible){job.history.at(-1).reason='Future-render workflow update. Existing scripts, approvals and videos preserved.';job.layoutNotice='Avatar and voice rotation applies to future paid renders. Existing scripts, approvals and videos are unchanged.';job.error=null;}
    else job.error='Global rules were updated. The saved script is unchanged; a script reviewer must review it under the current rules before video generation.';
    if(perQuestion){job.layoutNotice='Approval is now per question. Review each script card separately. Existing paid videos are kept and can be reused after the matching question is approved.';job.error=null;}
    store.db.exec('BEGIN IMMEDIATE');
    try{
      if(!store.db.prepare('SELECT id FROM jobs WHERE identity=? AND id<>?').get(nextIdentity,job.id)){
        job.identity=nextIdentity;store.db.prepare('UPDATE jobs SET identity=? WHERE id=?').run(nextIdentity,job.id);
      }
      store.save(job);store.record(job.id,'system',visualOnly?'appearance_rules_updated_content_approval_preserved':approvalCompatible?'future_render_rules_updated_content_approval_preserved':'global_rules_updated_review_required');store.db.exec('COMMIT');
    }catch(e){store.db.exec('ROLLBACK');throw e;}
  }
}
