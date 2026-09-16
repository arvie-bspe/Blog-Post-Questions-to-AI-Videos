import {existsSync,readFileSync} from 'node:fs';
import {config,rulesHash} from './rules.mjs';
import {hash,normalize,orderAllowed,googleId,recordIdentity,validatePlan} from './domain.mjs';

// Add explicitly prepared, unapproved test drafts once. Existing user edits always win.
export function importSavedReviews(store,path=new URL('../bootstrap/saved-reviews.json',import.meta.url)){
  if(!existsSync(path))return [];
  const batch=JSON.parse(readFileSync(path,'utf8'));
  if(batch.rulesHash!==rulesHash)return [];
  if(!Array.isArray(batch.reviews)||batch.reviews.length>10)throw new Error('Invalid saved-review batch.');
  for(const item of batch.reviews){
    const {row,client,doc,plan}=item;
    if(!item.key||!orderAllowed(row.order)||normalize(row.clientKey)!==normalize(client.key)||googleId(row.documentUrl,'document')!==doc.documentId||doc.sourceHash!==hash(doc.paragraphs))throw new Error('Saved review source does not match its row and client.');
    if(row.issues.some(issue=>issue!=='A Visual folder link is required in L.'))throw new Error('Saved review has unresolved source issues.');
    const check=validatePlan(plan,doc,client);if(check.errors.length)throw new Error(check.errors.join(' '));
  }
  store.db.exec('CREATE TABLE IF NOT EXISTS saved_review_imports(seed TEXT PRIMARY KEY, job TEXT NOT NULL); BEGIN IMMEDIATE');
  const added=[];
  try{
    for(const item of batch.reviews){
      const key=batch.id+':'+item.key;if(store.db.prepare('SELECT job FROM saved_review_imports WHERE seed=?').get(key))continue;
      const {row,client,doc,plan}=item,identity=recordIdentity(row,doc,'saved_snapshot',rulesHash,client);
      const existing=store.db.prepare('SELECT id FROM jobs WHERE identity=?').get(identity);
      if(existing){store.db.prepare('INSERT INTO saved_review_imports VALUES(?,?)').run(key,existing.id);continue;}
      const job=store.create({row,client,doc,identity,mode:'saved_snapshot',rulesHash,rulesVersion:config.version});
      Object.assign(job,{plan,validation:validatePlan(plan,doc,client),status:'content_review',origin:'Prepared in Codex from a current Google source snapshot; no API generation',audit:{passed:null,issues:['Keziah must review the script and cited source before approval.']},setupIssues:[...row.issues],sourceCapturedAt:batch.capturedAt,preparedBy:'Codex',seedKey:key,history:[]});
      store.save(job);store.record(job.id,'Arvie','import_requested_saved_draft');
      store.db.prepare('INSERT INTO saved_review_imports VALUES(?,?)').run(key,job.id);added.push(job.id);
    }
    store.db.exec('COMMIT');return added;
  }catch(error){store.db.exec('ROLLBACK');throw error;}
}
