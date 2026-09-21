import {resolveArticleIdentity} from './article-identity.mjs';
import {repeatsScriptHeading} from './script-content.mjs';
import {createHash} from 'node:crypto';
export const normalize=s=>String(s??'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const orders=['New Page','New Blog Post','Re-Write','Boost Post','Rewrite-URL Change'];
export const orderAllowed=v=>orders.some(o=>normalize(o).replace(/\s*-\s*/g,'-')===normalize(v).replace(/\s*-\s*/g,'-'));
export function googleId(value,kind) {
  let u;try{u=new URL(value);}catch{return null;}
  if(u.protocol!=='https:')return null;
  if(kind==='document'&&u.hostname==='docs.google.com')return u.pathname.match(/^\/document\/d\/([\w-]+)/)?.[1]||null;
  if(kind==='folder'&&u.hostname==='drive.google.com')return u.pathname.match(/\/folders\/([\w-]+)/)?.[1]||null;
  return null;
}
export function cellText(c) {
  const links=[c?.hyperlink,...(c?.textFormatRuns||[]).map(r=>r.format?.link?.uri),...(c?.chipRuns||[]).map(r=>r.chip?.richLinkProperties?.uri)].filter(Boolean);
  if(new Set(links).size>1)throw new Error('A cell contains multiple links. Resolve it before processing.');
  if(links.length)return links[0];
  const formula=c?.userEnteredValue?.formulaValue;
  if(formula)return formula.match(/^=HYPERLINK\("((?:[^"]|"")+)"/i)?.[1]?.replace(/""/g,'"')||'';
  return String(c?.formattedValue??c?.userEnteredValue?.stringValue??'').trim();
}
export function parseMonthly(sheet,{includeTaskMetadata=false}={}) {
  const p=sheet.properties, rows=sheet.data?.[0]?.rowData||[],header=rows[0]?.values||[];
  for(const [i,name]of[[0,'Client Name'],[1,'Order'],[9,'Google Doc'],[11,'Visual'],...(includeTaskMetadata?[[7,'Task ID'],[8,'Task URL']]:[])]){
    if(normalize(cellText(header[i]))!==normalize(name))throw new Error(`${p.title}: ${name} must be in column ${String.fromCharCode(65+i)}. Review this month's mapping.`);
  }
  return rows.slice(1).flatMap((r,i)=>{
    const v=Array.from({length:12},(_,j)=>!includeTaskMetadata&&[7,8].includes(j)?'':cellText(r.values?.[j]));
    if(!v[0]&&!v[1]&&!v[9])return [];
    const row={sheetId:p.sheetId,sheetName:p.title,rowNumber:i+2,clientKey:v[0],order:v[1],pageUrl:v[4],titleHint:v[5],taskId:v[7],taskUrl:v[8],documentUrl:v[9],folderUrl:v[11],documentId:googleId(v[9],'document'),folderId:googleId(v[11],'folder'),listId:v[8].match(/\/li\/([\w-]+)/)?.[1]||null};
    row.issues=[];
    if(!orderAllowed(row.order))row.issues.push('Order is not eligible.');
    if(!row.clientKey)row.issues.push('Client name is missing.');
    if(!row.documentId)row.issues.push('A Google Doc link is required in J.');
    if(!row.folderId)row.issues.push('A Visual folder link is required in L.');
    return [row];
  });
}
export function parseClients(values) {
  if(normalize(values[0]?.[0])!=='client'||normalize(values[0]?.[3])!=='law firm name')throw new Error('Client directory headers changed.');
  return values.slice(2).filter(r=>r[0]).map(r=>({key:String(r[0]).trim(),homepage:String(r[1]||'').trim(),name:String(r[3]||'').trim(),attorneys:r.slice(5,8).filter(x=>x&&x!=='--'),address:r[9]||'',phone:r[10]||'',cta:'',disclaimer:'',ctaRequired:false,disclaimerRequired:false}));
}
export function selectClient(clients,key) {
  const result=clients.filter(c=>normalize(c.key)===normalize(key));
  if(result.length!==1)throw new Error('Client must have one exact match in the directory.');
  return result[0];
}
export function paragraphsFromGoogle(doc) {
  if(Array.isArray(doc.paragraphs))return doc.paragraphs;
  const result=[];
  const read=(items,tabId)=>{for(const e of items||[]){
    if(e.paragraph)result.push({text:(e.paragraph.elements||[]).map(x=>x.textRun?.content||'').join('').trim(),startIndex:e.startIndex,tabId,namedStyleType:e.paragraph.paragraphStyle?.namedStyleType||'NORMAL_TEXT'});
    for(const row of e.table?.tableRows||[])for(const cell of row.tableCells||[])read(cell.content,tabId);
  }};
  const tabs=items=>{for(const t of items||[]){read(t.documentTab?.body?.content,t.tabProperties?.tabId||'t.0');tabs(t.childTabs);}};
  if(doc.tabs?.length)tabs(doc.tabs);else read(doc.body?.content,'t.0');
  return result;
}
export function documentTabs(doc){
  const result=[];const walk=tabs=>{for(const t of tabs||[]){result.push({id:t.tabProperties?.tabId||'t.0',title:t.tabProperties?.title||doc.title||'Document'});walk(t.childTabs);}};walk(doc.tabs);return result.length?result:[{id:'t.0',title:doc.title||'Document'}];
}
export function inspectDirect(doc,{tabId=null}={}){
  const tabs=documentTabs(doc);if(tabId&&!tabs.some(t=>t.id===tabId))throw new Error('The selected Google Doc tab no longer exists.');
  const selected=tabId||tabs[0].id;
  const paragraphs=paragraphsFromGoogle(doc).filter(p=>(!doc.tabs?.length||p.tabId===selected)&&p.text?.trim()).map((p,i)=>({id:`${p.tabId||selected}:${p.startIndex??i}`,text:p.text.trim(),style:p.namedStyleType||'NORMAL_TEXT',tabId:p.tabId||selected}));
  if(!paragraphs.length)throw new Error('The selected document tab is empty.');
  if(paragraphs.reduce((n,p)=>n+p.text.length,0)>150000)throw new Error('The selected document tab exceeds the current 150,000-character processing limit. Split the article before analysis.');
  const title=paragraphs.find(p=>['TITLE','HEADING_1'].includes(p.style))?.text||tabs.find(t=>t.id===selected)?.title||doc.title;
  const candidates=[];
  for(let i=0;i<paragraphs.length;i++){
    const p=paragraphs[i];if(!p.text.endsWith('?')||['TITLE','HEADING_1'].includes(p.style))continue;
    const paragraphIds=[];for(let j=i+1;j<paragraphs.length;j++){const q=paragraphs[j];if(/^HEADING_[1-6]$/.test(q.style)||q.style==='TITLE')break;if(q.style==='NORMAL_TEXT')paragraphIds.push(q.id);}
    candidates.push({id:p.id,question:p.text,paragraphIds,selectionKind:/^HEADING_/.test(p.style)?'explicit_source':'explicit_source'});
  }
  return {documentId:doc.documentId,title:doc.title,pageTitle:title,revisionId:doc.revisionId||null,selectedTabId:selected,availableTabs:tabs,sourceHash:hash(paragraphs),paragraphs,candidates,excluded:[],questionSelectionMode:'ai_independent'};
}
export function inspect(doc,titleHint='',clientKey='') {
  const paragraphs=paragraphsFromGoogle(doc).filter(p=>p.text?.trim()).map((p,i)=>({id:`${p.tabId||'t.0'}:${p.startIndex??i}`,text:p.text.trim(),style:p.namedStyleType||'NORMAL_TEXT',tabId:p.tabId||'t.0'}));
  if(!paragraphs.length)throw new Error('The article is empty.');
  if(paragraphs.reduce((n,p)=>n+p.text.length,0)>150000)throw new Error('The article exceeds the pilot size limit.');
  const primary=paragraphs.filter(p=>['TITLE','HEADING_1'].includes(p.style));
  const titles=new Set([doc.title,titleHint,...primary.map(p=>p.text),...paragraphs.filter(p=>/^title tag\s*:/i.test(p.text)).map(p=>p.text.replace(/^title tag\s*:\s*/i,''))].filter(Boolean).map(normalize));
  const candidates=[],excluded=[];
  for(let i=0;i<paragraphs.length;i++){
    const p=paragraphs[i];if(!/^HEADING_[1-6]$/.test(p.style)&&p.style!=='TITLE')continue;
    let reason='';
    if(['TITLE','HEADING_1'].includes(p.style)||titles.has(normalize(p.text)))reason='Page title / H1 is context only.';
    else if(!p.text.endsWith('?'))reason='This heading is not an explicit question.';
    else if(!primary.some(t=>t.tabId===p.tabId))reason='This tab needs a marked primary title before questions can be selected.';
    const section=[];
    if(!reason)for(let j=i+1;j<paragraphs.length;j++){
      const q=paragraphs[j];
      if(q.tabId!==p.tabId||q.style==='TITLE'||(/^HEADING_[1-6]$/.test(q.style)&&Number(q.style.slice(-1))<=Number(p.style.slice(-1))))break;
      section.push(q);
    }
    if(!reason&&!section.some(q=>q.style==='NORMAL_TEXT'))reason='No answer text follows this heading.';
    if(reason)excluded.push({id:p.id,question:p.text,reason});
    else candidates.push({id:p.id,question:p.text,paragraphIds:section.map(q=>q.id)});
  }
  const result={documentId:doc.documentId,title:doc.title,pageTitle:primary[0]?.text||titleHint||doc.title,revisionId:doc.revisionId||null,sourceHash:hash(paragraphs),paragraphs,candidates,excluded};
  return withClientSelection(result,clientKey);
}
export const alternateClient=key=>normalize(key)==='russell chicago';
export const lawyerHiringQuestion=q=>/\b(?:need|hire|hiring|retain|require|required|must have|should have)\b.*\b(?:lawyer|attorney|counsel|representation)\b|\b(?:lawyer|attorney)\b.*\b(?:required|necessary)\b/i.test(q||'');
export function mainBodySelection(doc){
  const copy=structuredClone(doc),mainIds=new Set(),faqIds=new Set(),sections=[],faqByTab=new Set();let section=null;
  for(const p of copy.paragraphs){
    if(/^(?:frequently asked questions|faqs?)(?:\b|\s)/i.test(p.text))faqByTab.add(p.tabId);
    if(faqByTab.has(p.tabId)){faqIds.add(p.id);continue;}
    if(['HEADING_2','HEADING_3'].includes(p.style)){section={id:p.id,heading:p.text,tabId:p.tabId,paragraphIds:[]};sections.push(section);}
    if(section&&section.tabId===p.tabId&&p.style==='NORMAL_TEXT'&&!/^(title tag|meta description|HTML Code)\s*:|^[\uE000-\uF8FF]*</i.test(p.text)){mainIds.add(p.id);section.paragraphIds.push(p.id);}
  }
  const kept=[];
  for(const c of copy.candidates){
    const p=copy.paragraphs.find(p=>p.id===c.id);let reason='';
    if(lawyerHiringQuestion(c.question))reason='Questions about needing or hiring a lawyer are excluded.';
    else if(!['HEADING_2','HEADING_3'].includes(p?.style))reason='Default selection requires an explicit H2 or H3 question.';
    else if(faqIds.has(c.id)){
      // A possible FAQ topic is retained only as a conditional candidate. Sentence evidence must all come from main sections.
      if(!sections.some(s=>s.paragraphIds.length))reason='FAQ-only topic: no substantive main H2/H3 sections exist.';
      else {c.selectionKind='supported_faq';c.requiresMainBodySupport=true;c.paragraphIds=[...mainIds];}
    }else {c.paragraphIds=c.paragraphIds.filter(id=>mainIds.has(id));if(!c.paragraphIds.length)reason='No substantive main-body answer follows this question.';}
    if(reason)copy.excluded.push({...c,reason});else kept.push(c);
  }
  copy.candidates=kept;copy.mainBodyParagraphIds=[...mainIds];copy.mainBodySections=sections;copy.faqParagraphIds=[...faqIds];copy.questionSelectionMode='main_body_h2_h3';return copy;
}
export const substantiveBody=doc=>doc.paragraphs.filter(p=>!['TITLE','HEADING_1'].includes(p.style)&&!normalize(p.text).includes('meta description:')&&!/^(title tag|about the author|author bio|related articles|related posts|contact us|copyright|all rights reserved|privacy policy|navigation)\b/i.test(p.text));
export function withClientSelection(doc,key){
  if(!alternateClient(key))return mainBodySelection(doc);
  const copy=structuredClone(doc);copy.questionSelectionMode='russell_chicago_body';
  const seen=new Set(copy.candidates.map(c=>normalize(c.question)));
  for(const p of substantiveBody(copy)){
    let n=0;for(const match of p.text.matchAll(/(?:^|[.!]\s+)([^?\n]{5,200}\?)/g)){
      const question=match[1].trim();if(seen.has(normalize(question))||normalize(question)===normalize(copy.pageTitle)||normalize(question)===normalize(copy.title))continue;
      if(lawyerHiringQuestion(question))continue;
      seen.add(normalize(question));copy.candidates.push({id:p.id+':bodyq'+(++n),question,paragraphIds:[p.id],selectionKind:'explicit_body'});
    }
  }
  return copy;
}
const forbidden=['in the context of','understanding the','as in other states','navigating the complexity','navigating the complexities','intricacy','intricacies','ensure','whether its','generally','usually','typically'];
const conditional=['actually','specialize','expert','expertise','best','proficient','guaranteed result','100% success','risk-free','number one','always','never'];
export function containsTerm(text,term){
  const escaped=normalize(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,'iu').test(normalize(text));
}
export function validatePlan(plan,doc,client,max=4){
  const errors=[],warnings=[];
  if(!Array.isArray(plan?.videos)||!Array.isArray(plan?.skipped))return {errors:['Invalid analysis format.'],warnings};
  if(plan.videos.length>Math.min(max,client.maxVideos||max))errors.push('Video count exceeds the configured maximum.');
  if(plan.articleIdentity){const identity=resolveArticleIdentity(doc,plan.articleIdentity);for(const field of ['name','address','phone'])if(plan.articleIdentity[field]&&!identity[field])errors.push(`Article-specific ${field} lacks matching source evidence.`);}
  const ids=new Set(),questions=new Set(),answers=new Set();
  for(const v of plan.videos){
    if(!v||typeof v!=='object'){errors.push('Invalid video entry.');continue;}
    const id=v?.candidateId||'Unknown question',c=doc.candidates.find(c=>c.id===id);
    if(lawyerHiringQuestion(v.question))errors.push(`${id}: questions about needing or hiring a lawyer are excluded.`);
    const alternate=alternateClient(client.key)&&doc.questionSelectionMode==='russell_chicago_body';
    const formulated=alternate&&v.selectionKind==='formulated_body';
    if(formulated){
      const sourceIds=v.supportingParagraphIds;
      if(typeof v.question!=='string'||!v.question.endsWith('?')||v.question.length>220||[doc.title,doc.pageTitle,...doc.paragraphs.filter(p=>['TITLE','HEADING_1'].includes(p.style)).map(p=>p.text)].some(t=>normalize(t)===normalize(v.question)))errors.push(`${id}: formulated question cannot be a page title or H1.`);
      if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.length>20||sourceIds.some(pid=>!substantiveBody(doc).some(p=>p.id===pid)))errors.push(`${id}: source-grounded question requires substantive body paragraph IDs.`);
      if(typeof v.reason!=='string'||v.reason.trim().length<20)errors.push(`${id}: explain why this body topic supports the formulated question.`);
      warnings.push(`${id}: Russell Chicago formulated question needs semantic review of source support, explicit-question priority, and excluded page material.`);
    }else if(!c||c.question!==v.question)errors.push(`${id}: question must exactly match an eligible heading or permitted explicit body question.`);
    if(c?.requiresMainBodySupport){
      if(!Array.isArray(v.supportingParagraphIds)||!v.supportingParagraphIds.length||v.supportingParagraphIds.some(pid=>!doc.mainBodyParagraphIds?.includes(pid)))errors.push(`${id}: FAQ topic needs independent main H2/H3 supporting paragraphs above the FAQs.`);
      if(!v.reason||v.reason.length<30)errors.push(`${id}: explain how the main article independently supports this FAQ topic.`);
      warnings.push(`${id}: confirm this FAQ topic is independently answered in the cited main H2/H3 content.`);
    }
    if(ids.has(id)||questions.has(normalize(v.question)))errors.push(`${id}: duplicate question.`);ids.add(id);questions.add(normalize(v.question));
    if(!Array.isArray(v.sentences)||!v.sentences.length){errors.push(`${id}: empty answer.`);continue;}
    if(repeatsScriptHeading(v))errors.push(`${id}: the script repeats its title/question. Keep the title once and start the answer directly.`);
    for(const s of v.sentences){
      if(typeof s?.text!=='string'||!s.text.trim()||!Array.isArray(s.evidence)||!s.evidence.length){errors.push(`${id}: each sentence needs source evidence.`);continue;}
      for(const e of s.evidence){
        const p=(alternate?substantiveBody(doc):doc.paragraphs.filter(p=>p.style==='NORMAL_TEXT'&&!/^(title tag|meta description)\s*:/i.test(p.text))).find(p=>p.id===e?.paragraphId);
        if(!p||typeof e.quote!=='string'||e.quote.trim().length<8||!p.text.includes(e.quote))errors.push(`${id}: evidence does not match the article body.`);
        if(c?.requiresMainBodySupport&&!doc.mainBodyParagraphIds?.includes(e.paragraphId))errors.push(`${id}: FAQ answers must use main H2/H3 evidence above the FAQs.`);
      }
    }
    for(const f of ['cta','disclaimer']){
      if(v[f]&&v[f]!==client[f])errors.push(`${id}: ${f} is not approved client wording.`);
      if(client[`${f}Required`]&&(!client[f]||v[f]!==client[f]))errors.push(`${id}: required ${f} is missing.`);
    }
    const script=[v.question,...v.sentences.map(s=>s?.text),v.cta,v.disclaimer].filter(Boolean).join('\n');
    if(script.trim().split(/\s+/).length>75){
      if(typeof v.runtimeReason!=='string'||v.runtimeReason.trim().length<20)errors.push(`${id}: a longer script needs a specific accuracy/context reason after removing filler.`);
      else warnings.push(`${id}: review justified runtime beyond the preferred 30 seconds: ${v.runtimeReason}`);
    }
    if(/[—:§]/u.test(script))errors.push(`${id}: em dash, colon, or section sign is prohibited.`);
    if(/(^|[.!?]\s+|\n)Because\b/iu.test(script))errors.push(`${id}: a sentence begins with Because.`);
    if(/(^|\n)By\b/iu.test(script))errors.push(`${id}: a segment begins with By.`);
    for(const term of [...forbidden,...(client.forbiddenTerms||[])])if(containsTerm(script,term))errors.push(`${id}: prohibited wording “${term}”.`);
    for(const term of conditional)if(containsTerm(script,term))warnings.push(`${id}: review “${term}” in context against the documented exception.`);
    const signature=normalize(v.sentences.map(s=>s?.text).join(' '));
    if(answers.has(signature))errors.push(`${id}: duplicate answer.`);answers.add(signature);
    if(Array.isArray(v.reviewFlags))warnings.push(...v.reviewFlags.map(f=>`${id}: ${f}`));
  }
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
export function validateDirectPlan(plan,doc,max=4){
  const errors=[],warnings=[];
  if(!Array.isArray(plan?.videos)||!Array.isArray(plan?.skipped))return {errors:['Invalid analysis format.'],warnings};
  if(plan.videos.length>max)errors.push(`Video count exceeds the configured maximum of ${max}.`);
  if(plan.articleIdentity){const identity=resolveArticleIdentity(doc,plan.articleIdentity);for(const field of ['name','address','phone'])if(plan.articleIdentity[field]&&!identity[field])errors.push(`Article-specific ${field} lacks matching source evidence.`);}
  const ids=new Set(),questions=new Set(),answers=new Set(),paragraphs=new Map(doc.paragraphs.map(p=>[p.id,p]));
  for(const v of plan.videos){
    if(!v||typeof v!=='object'){errors.push('Invalid video entry.');continue;}
    const id=String(v.candidateId||'Unidentified question'),question=String(v.question||'').trim();
    if(!question.endsWith('?')||question.length<8||question.length>220)errors.push(`${id}: use a clear question ending in a question mark.`);
    if(!['explicit_source','formulated_source'].includes(v.selectionKind))errors.push(`${id}: selection kind must identify an explicit or formulated source question.`);
    if(ids.has(id)||questions.has(normalize(question)))errors.push(`${id}: duplicate question.`);ids.add(id);questions.add(normalize(question));
    const support=Array.isArray(v.supportingParagraphIds)?v.supportingParagraphIds:[];
    if(!support.length||support.some(pid=>!paragraphs.has(pid)))errors.push(`${id}: identify supporting article paragraphs for this question.`);
    if(typeof v.reason!=='string'||v.reason.trim().length<12)errors.push(`${id}: explain briefly why this question is useful for video.`);
    if(!Array.isArray(v.sentences)||!v.sentences.length){errors.push(`${id}: empty answer.`);continue;}
    if(repeatsScriptHeading(v))errors.push(`${id}: the script repeats its title/question. Keep the title once and start the answer directly.`);
    for(const sentence of v.sentences){
      if(typeof sentence?.text!=='string'||!sentence.text.trim()||!Array.isArray(sentence.evidence)||!sentence.evidence.length){errors.push(`${id}: each sentence needs article evidence.`);continue;}
      for(const evidence of sentence.evidence){const p=paragraphs.get(evidence?.paragraphId);if(!p||typeof evidence.quote!=='string'||evidence.quote.trim().length<8||!p.text.includes(evidence.quote))errors.push(`${id}: evidence does not match the selected Google Doc tab.`);}
    }
    if(v.cta||v.disclaimer)warnings.push(`${id}: review the optional closing wording against the source and client instructions.`);
    const script=[question,...v.sentences.map(s=>s.text),v.cta,v.disclaimer].filter(Boolean).join(' '),words=script.trim().split(/\s+/).filter(Boolean).length;
    if(words>90)errors.push(`${id}: the script exceeds the 90-word development limit.`);else if(words>75)warnings.push(`${id}: the script is above the preferred approximately 30-second range.`);
    const signature=normalize(v.sentences.map(s=>s?.text).join(' '));if(answers.has(signature))errors.push(`${id}: duplicate answer.`);answers.add(signature);
    if(Array.isArray(v.reviewFlags))warnings.push(...v.reviewFlags.map(f=>`${id}: ${f}`));
  }
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
export const validateForJob=(plan,doc,client,max=4)=>doc?.questionSelectionMode==='ai_independent'?validateDirectPlan(plan,doc,max):validatePlan(plan,doc,client,max);
export const identity=(row,doc,mode,rulesHash)=>hash([mode,normalize(row.clientKey),row.documentId,doc.sourceHash,rulesHash]);
export const recordIdentity=(row,doc,mode,rulesHash,client)=>hash([identity(row,doc,mode,rulesHash),hash(client),row.order,row.folderId]);
