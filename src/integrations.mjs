import {createSign} from 'node:crypto';
import {config} from './rules.mjs';
import {normalize,parseMonthly,parseClients,selectClient,inspect,inspectDirect,googleId,documentTabs} from './domain.mjs';
export const googleConfigured=()=>Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_REFRESH_TOKEN));
const tokenCache=new Map();
export async function googleToken(write=false){
  const cached=tokenCache.get(write);if(cached?.until>Date.now())return cached.value;
  const form=new URLSearchParams();
  if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON){
    let key;try{key=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);}catch{throw new Error('Invalid service-account JSON in the server environment.');}
    const now=Math.floor(Date.now()/1000);
    const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:key.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/documents.readonly'+(write?' https://www.googleapis.com/auth/drive':''),aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const signer=createSign('RSA-SHA256');signer.update(unsigned);
    form.set('grant_type','urn:ietf:params:oauth:grant-type:jwt-bearer');form.set('assertion',`${unsigned}.${signer.sign(key.private_key,'base64url')}`);
  }else{
    if(!googleConfigured())throw new Error('Google read credentials are not configured.');
    for(const [key,value]of Object.entries({grant_type:'refresh_token',client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:process.env.GOOGLE_REFRESH_TOKEN}))form.set(key,value);
  }
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error(`Google authentication failed (HTTP ${res.status}).`);
  const data=await res.json();tokenCache.set(write,{value:data.access_token,until:Date.now()+(data.expires_in-60)*1000});return data.access_token;
}
export async function getGoogle(url){
  const res=await fetch(url,{headers:{Authorization:`Bearer ${await googleToken()}`},signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error(`Google read failed (HTTP ${res.status}). Check document sharing and API access.`);
  return res.json();
}
export function directDocumentReference(value){
  let url;try{url=new URL(value);}catch{throw new Error('Paste a valid Google Doc URL.');}
  const documentId=googleId(url.href,'document');if(!documentId)throw new Error('Use a Google Docs document URL.');
  return {documentId,documentUrl:`https://docs.google.com/document/d/${documentId}/edit`,tabId:url.searchParams.get('tab')||null};
}
export async function clientProfiles(read=getGoogle){
  const source=config.sources.clients,values=await read(`https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values/${encodeURIComponent(`'${source.sheetName}'!A1:L100`)}`);
  return parseClients(values.values);
}
export async function directSource(input,{read=getGoogle}={}){
  const ref=directDocumentReference(input.documentUrl),raw=await read(`https://docs.googleapis.com/v1/documents/${ref.documentId}?includeTabsContent=true`),tabs=documentTabs(raw),tabId=input.tabId||ref.tabId;
  if(tabs.length>1&&!tabId){const e=new Error('This Google Doc contains multiple tabs. Choose the article tab before continuing.');e.status=409;e.details={tabs};throw e;}
  let client={key:String(input.clientKey||'Unassigned').trim()||'Unassigned',homepage:String(input.homepage||'').trim(),name:String(input.firmName||'').trim(),address:String(input.address||'').trim(),phone:String(input.phone||'').trim(),attorneys:[],cta:'',disclaimer:'',ctaRequired:false,disclaimerRequired:false};
  if(input.clientKey){try{client=selectClient(await clientProfiles(read),input.clientKey);}catch(e){if(!input.firmName)throw e;}}
  for(const key of ['homepage','name','address','phone'])if(String(input[{homepage:'homepage',name:'firmName',address:'address',phone:'phone'}[key]]||'').trim())client[key]=String(input[{homepage:'homepage',name:'firmName',address:'address',phone:'phone'}[key]]).trim();
  const folderUrl=String(input.folderUrl||'').trim(),pageUrl=String(input.pageUrl||'').trim();
  if(folderUrl&&!googleId(folderUrl,'folder'))throw new Error('Use a valid Google Drive folder URL for the Visual folder.');
  if(pageUrl){let target;try{target=new URL(pageUrl);}catch{throw new Error('Use a valid published article URL.');}if(!['https:','http:'].includes(target.protocol))throw new Error('Use an HTTPS or HTTP published article URL.');}
  const documentUrl=`https://docs.google.com/document/d/${ref.documentId}/edit?tab=${encodeURIComponent(tabId||tabs[0].id)}`;
  const row={clientKey:client.key,order:'Direct Google Doc',pageUrl,titleHint:raw.title,documentUrl,folderUrl,documentId:ref.documentId,folderId:googleId(folderUrl,'folder'),tabId:tabId||tabs[0].id,issues:[]};
  return {row,client,doc:inspectDirect(raw,{tabId:row.tabId})};
}
export async function liveMonths(read=getGoogle){
  const root=`https://sheets.googleapis.com/v4/spreadsheets/${config.sources.monthly.spreadsheetId}`;
  const metadata=await read(`${root}?fields=sheets.properties`);
  return metadata.sheets.map(s=>s.properties).filter(p=>!p.hidden&&p.gridProperties?.rowCount>1).map(p=>({title:p.title,sheetId:p.sheetId,rowCount:p.gridProperties.rowCount}));
}
export async function liveSource(sheetName,rowNumber,{read=getGoogle,allowMissingVisual=false}={}){
  const allowed=(await liveMonths(read)).find(s=>s.title===sheetName);
  if(!allowed||!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>allowed.rowCount)throw new Error('Choose a visible worksheet and a row within its current size.');
  const root=`https://sheets.googleapis.com/v4/spreadsheets/${config.sources.monthly.spreadsheetId}`,quoted="'"+sheetName.replace(/'/g,"''")+"'";
  const data=await read(`${root}?includeGridData=true&ranges=${encodeURIComponent(`${quoted}!A1:L1`)}&ranges=${encodeURIComponent(`${quoted}!A${rowNumber}:L${rowNumber}`)}`);
  const sheet=data.sheets.find(s=>s.properties.sheetId===allowed.sheetId);
  const at=n=>{for(const grid of sheet.data||[]){const index=n-(grid.startRow||0);if(index>=0&&index<(grid.rowData||[]).length)return grid.rowData[index];}return {values:[]};};
  const row=parseMonthly({properties:sheet.properties,data:[{rowData:[at(0),at(rowNumber-1)]}]}).at(0);
  if(row)row.rowNumber=rowNumber;
  if(!row)throw new Error('The selected row is empty.');
  const blocking=row.issues.filter(issue=>!allowMissingVisual||issue!=='A Visual folder link is required in L.');
  if(blocking.length)throw new Error(blocking.join(' '));
  const clientSource=config.sources.clients;
  const values=await read(`https://sheets.googleapis.com/v4/spreadsheets/${clientSource.spreadsheetId}/values/${encodeURIComponent(`'${clientSource.sheetName}'!A1:L100`)}`);
  const client=selectClient(parseClients(values.values),row.clientKey);
  const doc=inspect(await read(`https://docs.googleapis.com/v1/documents/${row.documentId}?includeTabsContent=true`),row.titleHint,row.clientKey);
  return {row,client,doc};
}
export function taskMapping(row){return config.workflow.testTaskMappings?.find(m=>m.documentId===row.documentId&&normalize(m.clientKey)===normalize(row.clientKey))||null;}
export async function verifyTask(row){
  if(!config.workflow.approvalChecksEnabled)throw new Error('ClickUp approval checks are deferred. Start this pilot manually.');
  if(!process.env.CLICKUP_TOKEN)throw new Error('Set CLICKUP_TOKEN in the server environment to verify the task.');
  const mapping=taskMapping(row);if(!mapping)throw new Error('This article has no direct approval task mapping yet.');
  const res=await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(mapping.taskId)}`,{headers:{Authorization:process.env.CLICKUP_TOKEN},signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error(`ClickUp verification failed (HTTP ${res.status}). No approval was inferred.`);
  const task=await res.json(),issues=[];
  if(String(task.id)!==mapping.taskId)issues.push('Returned task ID differs from the supplied task.');
  if(normalize(task.name)!==normalize(config.workflow.approvalTaskTitle))issues.push('The linked task is not named send for approval to client. It may be the parent task; map the approval subtask.');
  if(!task.parent)issues.push('The linked item is not an approval subtask. Confirm its workflow before activation.');
  if(!row.listId||String(task.list?.id)!==row.listId)issues.push('The task list does not match the monthly row.');
  const done=(process.env.CLICKUP_DONE_STATUSES||'done,complete').split(',').map(normalize);
  if(!done.includes(normalize(task.status?.status)))issues.push('The task has not reached a configured Done status.');
  return {taskId:task.id,name:task.name,status:task.status?.status||'',parentId:task.parent||null,listId:task.list?.id||null,url:mapping.url,checkedAt:new Date().toISOString(),passed:issues.length===0,issues};
}
