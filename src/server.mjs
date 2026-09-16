import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from './store.mjs';
import {config,rules,rulesHash} from './rules.mjs';
import {parseMonthly,parseClients,selectClient,inspect,recordIdentity,hash,validatePlan} from './domain.mjs';
import {preparedExample} from './sample.mjs';
import {analyze} from './ai.mjs';
import {createSecurity} from './security.mjs';
import {googleConfigured,liveSource,liveMonths,taskMapping,verifyTask} from './integrations.mjs';
import {VideoService} from './video-service.mjs';
import {initializeDatabase} from './bootstrap.mjs';
import {manualRevision} from './manual-revision.mjs';
import {GoogleConnection} from './google-connection.mjs';
import {ScriptWorkflow} from './script-workflow.mjs';
import {reconcileRules} from './rules-migration.mjs';
import {importSavedReviews} from './saved-reviews.mjs';
import {resolveArticleIdentity} from './article-identity.mjs';
import {approved} from './video-domain.mjs';
import {adoptSourceIdentity} from './source-records.mjs';
import {questionState,questionHash,recordQuestionReview} from './question-approval.mjs';
import {presenterIssue} from './presenter-compatibility.mjs';
const file=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const fixture=name=>{try{return JSON.parse(file('../fixtures/'+name+'.json'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const fixtures=Object.fromEntries(['paul','roman'].map(name=>[name,fixture(name)]).filter(([,doc])=>doc));
const monthly=fixture('monthly'),directory=fixture('clients');
const rows=monthly?parseMonthly(monthly):[],clients=directory?parseClients(directory):[];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const brief=j=>({id:j.id,status:j.status,title:j.doc.pageTitle,client:j.client.key,mode:j.mode,origin:j.origin||null,updated:j.updated,videoCount:j.plan?.videos.length||0});
export function markdown(job){
  let out=`# ${job.doc.pageTitle}\n\nManual pilot · ${job.mode} · ${job.origin||'Source inspection'}\n\nStatus: ${job.status}. This is not a client approval or finished video.\n\nSource: ${job.row.documentUrl}\n\nRules: ${job.rulesVersion}\nSource hash: ${job.doc.sourceHash}\nCaptured: ${job.created}\n\n`;
  for(const [i,v]of(job.plan?.videos||[]).entries()){
    out+=`## ${i+1}. ${v.question}\n\n${v.sentences.map(s=>s.text).join('\n\n')}\n\n`;
    for(const f of ['cta','disclaimer'])if(v[f])out+=`${v[f]}\n\n`;
    out+='### Source evidence\n\n';
    for(const s of v.sentences){out+=`- Claim: ${s.text}\n`;for(const e of s.evidence)out+=`  - ${e.paragraphId}: ${e.quote}\n`;}
    out+='\n';
  }
  out+=`## Review\n\n${JSON.stringify({validation:job.validation,audit:job.audit,reviews:job.reviews,taskVerification:job.taskVerification},null,2)}\n`;
  return out;
}
export function createApp(env=process.env){
  const security=createSecurity(env),dataDir=resolve(env.DATA_DIR||'./data');mkdirSync(dataDir,{recursive:true});
  initializeDatabase(env,dataDir);
  const store=new Store(resolve(dataDir,'studio.sqlite'));
  reconcileRules(store);
  if(env.SAVED_REVIEW_BATCH_PATH)importSavedReviews(store,env.SAVED_REVIEW_BATCH_PATH);
  const send=(res,status,value,type='application/json; charset=utf-8')=>{if(type.startsWith('application/json')&&value?.plan?.videos)value={...value,questionStates:value.plan.videos.map((_,i)=>questionState(value,i))};res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'Referrer-Policy':'no-referrer'});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
  const json=async req=>{if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail('JSON body required.',415);let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>32768)fail('Request is too large.',413);}try{return JSON.parse(text);}catch{fail('Invalid JSON.');}};
  const load=id=>store.get(id)||fail('Review record not found.',404);
  const currentVideo=v=>{try{return !presenterIssue(v.avatar,v.voice)&&(!v.files?.video||v.detectorVersion===config.video.faceDetectorVersion)&&v.layoutVersion===config.video.layoutVersion&&v.source?.rulesHash===rulesHash&&v.approvalHash===approved(store.get(v.parentId),v.index);}catch{return false;}};
  const assertCurrent=job=>{if(load(job.id).revision!==job.revision)fail('This record changed in another request. Reload before continuing.',409);};
  async function checkFresh(job,index){
    if(job.mode!=='live_google')return;
    const current=await liveSource(job.row.sheetName,job.row.rowNumber,{allowMissingVisual:true});
    if(Number.isInteger(index)){if(questionHash(load(job.id),index)!==questionHash(job,index))fail('This question changed. Review the current version.',409);}else assertCurrent(job);
    if(current.doc.sourceHash!==job.doc.sourceHash||hash(current.client)!==hash(job.client)||hash(current.row)!==hash(job.row)){
      const latest=load(job.id);latest.status='source_changed';latest.error='The source, client configuration, or monthly row changed. Refresh the source and review the affected questions.';store.save(latest);fail(latest.error,409);
    }
  }
  const google=new GoogleConnection({env,dataDir,origin:security.origin});
  const scripts=new ScriptWorkflow({store,env,checkFresh});
  const video=new VideoService({store,env,dataDir,checkFresh,local:security.local,onScriptChanges:(id,note,index)=>scripts.start(id,note,index)});
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://internal'),path=url.pathname;
      if(req.method==='GET'&&path==='/health')return send(res,200,{status:'ok',stage:'manual_content_pilot'});
      security.checkRequest(req);
      if(req.method==='GET'&&['/','/app.js','/video-ui.js','/styles.css'].includes(path))return send(res,200,file('../public/'+(path==='/'?'index.html':path.slice(1))),path==='/'?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
      if(req.method==='GET'&&path==='/api/session')return send(res,200,{local:security.local,actor:security.actor(req)});
      if(req.method==='POST'&&path==='/api/login'){
        const body=await json(req),token=security.login(body.role,body.password,req.socket.remoteAddress);
        res.setHeader('Set-Cookie',security.cookie(token));return send(res,200,{ok:true});
      }
      if(req.method==='POST'&&path==='/api/logout'){security.logout(req);res.setHeader('Set-Cookie',security.cookie(''));return send(res,200,{ok:true});}
      if(req.method==='GET'&&path==='/api/google/callback'){await google.callback(url.searchParams);return send(res,200,'<!doctype html><title>Google connected</title><p>Google is connected. Return to the studio and refresh Connections.</p><a href="/">Open studio</a>','text/html; charset=utf-8');}
      const actor=security.actor(req);if(!actor)fail('Sign in to view the studio.',401);
      if(req.method==='GET'&&path==='/api/google/status')return send(res,200,google.status());
      if(req.method==='POST'&&path==='/api/google/connect')return send(res,200,google.start(actor));
      if(req.method==='GET'&&path==='/api/months')return send(res,200,await liveMonths());
      if(await video.route({req,res,path,url,actor,json,send}))return;
      if(req.method==='GET'&&path==='/api/bootstrap')return send(res,200,{local:security.local,actor,version:config.version,rulesHash,articles:Object.entries(fixtures).map(([key,doc])=>({key,title:doc.title,row:rows.find(r=>r.documentId===doc.documentId)})),jobs:store.list().filter(j=>!j.supersededBy).map(j=>({...brief(j),setupIssues:j.setupIssues||[],identityIssues:resolveArticleIdentity(j.doc,j.plan?.articleIdentity).issues,questionStates:(j.plan?.videos||[]).map((_,i)=>questionState(j,i))})),videos:video.list().map(v=>({id:v.id,parentId:v.parentId,question:v.question,status:v.status,updated:v.updated,current:currentVideo(v),hasVideo:!!v.files?.video,error:v.error||null})),connections:{openai:Boolean(env.OPENAI_API_KEY),google:googleConfigured(),heygen:Boolean(env.HEYGEN_API_KEY),googleSetup:google.status()},months:config.sources.monthly.verifiedSheets.map(s=>s.title),workflow:{startMode:'manual',approvalChecksEnabled:false,clickupIntegration:'deferred',automaticVideos:true,automaticEstimateLimit:2,dailyLimit:Number(env.DAILY_VIDEO_LIMIT||2)},phase:'article_video_studio',branding:'Firm logo required; portrait 9:16'});
      if(req.method==='GET'&&path==='/api/rules')return send(res,200,{rules,version:config.version});
      if(req.method==='POST'&&path==='/api/inspect'){
        const body=await json(req);let source,mode;
        if(body.mode==='live_google'){source=await liveSource(body.sheetName,Number(body.rowNumber));mode='live_google';}
        else{
          const fixture=fixtures[body.article];if(!fixture)fail('Choose Paul or Roman.');
          const row=rows.find(r=>r.documentId===fixture.documentId);if(row.issues.length)fail(row.issues.join(' '));
          source={row,client:selectClient(clients,row.clientKey),doc:inspect(fixture,row.titleHint,row.clientKey)};mode='saved_snapshot';
        }
        const id=recordIdentity(source.row,source.doc,mode,rulesHash,source.client);
        let job=store.create({...source,mode,identity:id,rulesVersion:config.version,rulesHash,taskMapping:taskMapping(source.row)});store.record(job.id,actor,'inspect');
        if(mode==='live_google'&&!job.plan&&(job.status==='inspected'||(env.OPENAI_API_KEY&&job.status==='awaiting_script')))job=await scripts.start(job.id);
        return send(res,200,job);
      }
      const match=path.match(/^\/api\/jobs\/([a-f0-9-]+)(?:\/(example|analyze|review|manual-revision|refresh-source|verify-task|export))?$/);
      if(match){
        let job=load(match[1]);const action=match[2];
        if(job.supersededBy){if(req.method==='GET')job=load(job.supersededBy);else fail('This empty inspection is linked to the article with its review history. Open the current article from All articles.',409);}
        if(req.method==='GET'&&!action)return send(res,200,{...job,questionStates:(job.plan?.videos||[]).map((_,i)=>questionState(job,i))});
        if(req.method==='GET'&&action==='export'){
          if(!job.plan)fail('There is no script to export.');
          const md=url.searchParams.get('format')==='md';res.setHeader('Content-Disposition',`attachment; filename="${job.client.key.toLowerCase()}-pilot-${job.id.slice(0,8)}.${md?'md':'json'}"`);
          return send(res,200,md?markdown(job):job,md?'text/markdown; charset=utf-8':'application/json; charset=utf-8');
        }
        if(req.method!=='POST')fail('Unsupported request.',405);
        if(job.status==='analyzing')fail('Analysis is in progress.',409);
        if(action==='refresh-source'){
          if(!['Arvie','Keziah'].includes(actor))fail('Arvie or Keziah refreshes the article source.',403);
          const body=await json(req);if(body.expectedRevision!==job.revision)fail('The record changed. Reload before refreshing the source.',409);
          const source=await liveSource(job.row.sheetName,job.row.rowNumber,{allowMissingVisual:true});assertCurrent(job);
          if(source.row.documentId!==job.row.documentId||source.client.key!==job.client.key)fail('This row now points to a different article or client. Inspect it as a new article.',409);
          job.history=[...(job.history||[]),{at:job.updated,doc:job.doc,row:job.row,client:job.client,plan:job.plan,reviews:job.reviews,revision:job.revision,rulesHash:job.rulesHash,reason:'Source refreshed from Google.'}];
          Object.assign(job,source,{mode:'live_google',rulesHash,rulesVersion:config.version,reviews:[],questionReviews:[],questionRequests:{},questionAudits:{},setupIssues:[...source.row.issues],status:job.plan?'content_review':'inspected',error:null});
          if(job.plan)job.validation=validatePlan(job.plan,job.doc,job.client);
          const identity=recordIdentity(job.row,job.doc,job.mode,rulesHash,job.client);
          store.db.exec('BEGIN IMMEDIATE');try{adoptSourceIdentity(store,job,identity,id=>video.list(id).length>0);store.save(job);store.record(job.id,actor,'refresh_live_source');store.db.exec('COMMIT');}catch(e){store.db.exec('ROLLBACK');throw e;}return send(res,200,job);
        }
        if(action==='manual-revision'){
          if(actor!=='Arvie')fail('Arvie manages manual draft updates.',403);
          const body=await json(req);
          if(job.rulesHash!==rulesHash)fail('The rules changed. Inspect the article again.',409);
          await checkFresh(job);assertCurrent(job);
          const revised=manualRevision(job,body,actor);
          store.save(revised);store.record(job.id,actor,'manual_script_revision');return send(res,200,revised);
        }
        if(action==='verify-task'){
          if(!config.workflow.approvalChecksEnabled)fail('ClickUp approval checks are deferred. Start this pilot manually.',409);
          if(actor!=='Arvie')fail('Arvie manages the task connection.',403);
          const verification=await verifyTask(job.row);assertCurrent(job);job.taskVerification=verification;store.record(job.id,actor,'verify_task');return send(res,200,store.save(job));
        }
        if(action==='example'){
          if(job.mode!=='saved_snapshot'||job.client.key!=='Paul')fail('The prepared example is for the saved Paul article only.');
          if(job.plan)fail('This record already has a draft. It will not be overwritten by the example.',409);
          job.plan=preparedExample(job.doc);job.origin='Prepared in Codex from the saved source; no API generation';job.validation=validatePlan(job.plan,job.doc,job.client);job.audit={passed:null,issues:['Prepared example requires a human source check. No independent API audit has run.']};job.status='content_review';store.record(job.id,actor,'load_prepared_example');return send(res,200,store.save(job));
        }
        if(action==='analyze'){
          if(!['Arvie','Keziah'].includes(actor))fail('Arvie or Keziah can request an analysis.',403);
          if(!env.OPENAI_API_KEY)fail('Set OPENAI_API_KEY in the server environment first.');
          if(job.rulesHash!==rulesHash)fail('This record uses old rules. Inspect the article again.',409);
          return send(res,202,await scripts.start(job.id,job.revisionRequest?.feedback||''));
        }
        if(action==='review'){
          if(!['Arvie','Keziah'].includes(actor))fail('Keziah or Arvie reviews scripts. Macy reviews videos.',403);
          const body=await json(req),index=body.index,current=questionState(job,index);
          if(body.expectedQuestionHash!==undefined?body.expectedQuestionHash!==current.draftHash:body.expectedRevision!==undefined&&body.expectedRevision!==job.revision)fail('This question changed. Reload and review the current version.',409);
          if(!['approve','reject'].includes(body.decision))fail('Choose approve or request changes for this question.');
          if(typeof body.note!=='string'||body.note.trim().length<10||body.note.length>4000)fail('Add review notes of 10 to 4000 characters.');
          if(job.rulesHash!==rulesHash)fail('The rules changed. Refresh and review this question.',409);
          await checkFresh(job);assertCurrent(job);
          if(body.decision==='approve'){
            if(current.status==='revision_pending'||current.status==='analyzing')fail('Apply this question’s requested changes before approving it.',409);
            if(current.status==='approved')fail('This question is already approved. Repeated approval will not generate another video.',409);
            if(current.validation.errors.length)fail('Resolve this question’s failed content checks.');
            if(!body.checkedEvidence)fail('Confirm this script was checked against its source evidence.');
            if(current.validation.warnings.length&&!body.checkedWarnings)fail('Acknowledge this question’s conditional-word and source flags.');
            const savedAudit=job.questionAudits?.[index],audit=savedAudit?.draftHash===current.draftHash?savedAudit:null;
            if(audit&&!audit.manual&&!audit.passed||!audit&&job.origin?.startsWith('OpenAI')&&!job.audit?.passed)fail('The source audit has unresolved issues. Request changes.');
          }
          const review=recordQuestionReview(job,index,{actor,decision:body.decision,note:body.note.trim(),checkedEvidence:Boolean(body.checkedEvidence),checkedWarnings:Boolean(body.checkedWarnings),at:new Date().toISOString(),testOnly:true,authenticated:!security.local});
          job.error=null;store.record(job.id,actor,'question_'+index+'_review_'+body.decision);store.save(job);
          if(body.decision==='approve')video.automation.enqueue(job.id,actor,index);else job=await scripts.start(job.id,review.note,index);
          return send(res,200,{...job,questionStates:job.plan.videos.map((_,i)=>questionState(job,i))});
        }
      }
      fail('Not found.',404);
    }catch(error){send(res,error.status||400,{error:error.message||'Request failed.'});}
  });
  server.on('close',()=>{video.closed=true;});
  return {server,store,security,video,google,scripts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {server,security}=createApp();server.listen(security.port,security.host,()=>console.log(`Article Video Studio running at ${security.origin} (${security.local?'local test':'team sign-in required'})`));
}
