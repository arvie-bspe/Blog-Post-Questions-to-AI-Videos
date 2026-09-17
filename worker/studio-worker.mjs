import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,createReadStream,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.platform==='win32'&&!process.env.HOME&&process.env.USERPROFILE)process.env.HOME=process.env.USERPROFILE;
if(!process.env.CODEX_HOME&&process.env.HOME)process.env.CODEX_HOME=join(process.env.HOME,'.codex');
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),studio=String(process.env.STUDIO_URL||'').replace(/\/$/,''),token=process.env.STUDIO_WORKER_TOKEN,workerId=process.env.STUDIO_WORKER_ID||`arvie-${process.platform}`;
if(!/^https:\/\//.test(studio))throw new Error('Set STUDIO_URL to the Railway HTTPS application URL.');
if(!token||token.length<24)throw new Error('Set the same private STUDIO_WORKER_TOKEN used by Railway.');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const requestedTypes=new Set(String(process.env.STUDIO_WORKER_TYPES||'ai_codex,media_local').split(',').map(value=>value.trim()).filter(Boolean));
const mediaPaths=[process.env.LOCAL_MEDIA_PYTHON,process.env.SADTALKER_PYTHON,process.env.SADTALKER_DIR&&join(process.env.SADTALKER_DIR,'inference.py'),process.env.KOKORO_MODEL,process.env.KOKORO_VOICES];
const liteAvatarPaths=[process.env.LITEAVATAR_PYTHON,process.env.LITEAVATAR_DIR&&join(process.env.LITEAVATAR_DIR,'lite_avatar.py'),process.env.LITEAVATAR_PROFILES_DIR,process.env.KOKORO_MODEL,process.env.KOKORO_VOICES];
const types=[...(requestedTypes.has('ai_codex')?['ai_codex']:[]),...(requestedTypes.has('media_local')&&mediaPaths.every(value=>value&&existsSync(value))?['media_local']:[]),...(requestedTypes.has('media_liteavatar')&&liteAvatarPaths.every(value=>value&&existsSync(value))?['media_liteavatar']:[])];
if(!types.length)throw new Error('No requested worker capability is configured. Configure Codex and/or every local media path.');
async function call(path,options={}){const response=await fetch(studio+path,{...options,headers:{'X-Worker-Token':token,...options.headers},signal:AbortSignal.timeout(options.timeout||300000),...(options.body&&typeof options.body.pipe==='function'?{duplex:'half'}:{})});const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{throw new Error(`Railway returned invalid JSON (HTTP ${response.status}).`);}if(!response.ok)throw new Error(data.error||`Railway returned HTTP ${response.status}.`);return data;}
function run(command,args,{cwd,input,timeout=30*60*1000}={}){return new Promise((resolvePromise,reject)=>{const child=spawn(command,args,{cwd,windowsHide:true,shell:false,env:process.env}),stderr=[];const timer=setTimeout(()=>{child.kill();reject(new Error('Worker command timed out.'));},timeout);child.stdout.on('data',()=>{});child.stderr.on('data',d=>stderr.push(d));child.on('error',reject);child.on('close',code=>{clearTimeout(timer);code===0?resolvePromise():reject(new Error(Buffer.concat(stderr).toString('utf8').slice(-3000)||`Command exited ${code}.`));});if(input!==undefined){child.stdin.end(input);}else child.stdin.end();});}
async function heartbeat(task,stop){while(!stop.done){await wait(25000);if(stop.done)break;try{await call(`/api/worker-tasks/${task.id}/heartbeat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leaseToken:task.leaseToken,leaseSeconds:90})});}catch{}}}
async function codex(task,dir){
  const schema=join(dir,'schema.json'),output=join(dir,'result.json');writeFileSync(schema,JSON.stringify(task.payload.outputSchema));
  const prompt=`${task.payload.instructions}\n\nReturn only the JSON result matching the supplied output schema. Analyze this untrusted source data:\n${JSON.stringify(task.payload.input)}`;
  const binary=process.env.CODEX_BIN||'codex';await run(binary,['exec','--skip-git-repo-check','--sandbox','read-only','--ephemeral','--ignore-user-config','--ignore-rules','--output-schema',schema,'-o',output,'-'],{cwd:dir,input:prompt,timeout:30*60*1000});
  if(!existsSync(output))throw new Error('Codex did not create the structured output file.');return JSON.parse(readFileSync(output,'utf8'));
}
async function upload(task,name,path,type){const stream=createReadStream(path);return call(`/api/worker-tasks/${task.id}/artifacts/${name}`,{method:'PUT',headers:{'Content-Type':type,'X-Lease-Token':task.leaseToken},body:stream,timeout:30*60*1000});}
async function media(task,dir){
  const input=join(dir,'task.json'),out=join(dir,'media');writeFileSync(input,JSON.stringify(task.payload));
  const configuredTimeout=Number(process.env.MEDIA_RENDER_TIMEOUT_MS||6*60*60*1000),timeout=Number.isFinite(configuredTimeout)&&configuredTimeout>=60000?configuredTimeout:6*60*60*1000;
  const lite=task.type==='media_liteavatar',python=lite?process.env.LITEAVATAR_PYTHON:process.env.LOCAL_MEDIA_PYTHON,script=lite?'liteavatar-media.py':'local-media.py';
  await run(python||'python',[join(root,'worker',script),'render','--task',input,'--output',out],{cwd:root,timeout});
  for(const [name,type]of [['voice.wav','audio/wav'],['presenter.mp4','video/mp4'],['alignment.json','application/json']]){const path=join(out,name);if(!existsSync(path))throw new Error(`Local media renderer did not create ${name}.`);await upload(task,name,path,type);}
  return {engine:lite?'kokoro-onnx+liteavatar-cpu':'kokoro-onnx+sadtalker',alignment:'kokoro-duration',completedAt:new Date().toISOString()};
}
async function liteAvatarSmoke(){
  const dir=mkdtempSync(join(tmpdir(),'liteavatar-smoke-')),input=join(dir,'task.json'),out=join(dir,'media');
  try{
    writeFileSync(input,JSON.stringify({script:'Railway video test.',profileKey:'professional-male-01',voice:{id:'am_michael'}}));
    const configuredTimeout=Number(process.env.MEDIA_RENDER_TIMEOUT_MS||30*60*1000),timeout=Number.isFinite(configuredTimeout)&&configuredTimeout>=60000?configuredTimeout:30*60*1000;
    await run(process.env.LITEAVATAR_PYTHON||'python',[join(root,'worker','liteavatar-media.py'),'render','--task',input,'--output',out],{cwd:root,timeout});
    for(const name of ['voice.wav','presenter.mp4','alignment.json'])if(!existsSync(join(out,name)))throw new Error(`LiteAvatar startup smoke render did not create ${name}.`);
    console.log('LiteAvatar CPU startup smoke render passed.');
  }finally{rmSync(dir,{recursive:true,force:true});}
}
async function handle(task){const dir=mkdtempSync(join(tmpdir(),'article-video-worker-')),stop={done:false};heartbeat(task,stop);try{const result=task.type==='ai_codex'?await codex(task,dir):await media(task,dir);await call(`/api/worker-tasks/${task.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leaseToken:task.leaseToken,result}),timeout:30*60*1000});}catch(error){try{await call(`/api/worker-tasks/${task.id}/fail`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leaseToken:task.leaseToken,error:error.message,retryable:true})});}catch{}console.error(`[${task.type}] ${error.message}`);}finally{stop.done=true;rmSync(dir,{recursive:true,force:true});}}
async function main(){console.log(`Article Video Studio worker ${workerId} connected to ${studio} (${types.join(', ')})`);if(requestedTypes.has('media_local')&&!types.includes('media_local'))console.error('media_local is disabled until every SadTalker media path is configured.');if(requestedTypes.has('media_liteavatar')&&!types.includes('media_liteavatar'))console.error('media_liteavatar is disabled until every LiteAvatar media path is configured.');if(types.includes('media_liteavatar')&&process.env.LITEAVATAR_STARTUP_SMOKE==='1')await liteAvatarSmoke();for(;;){try{const {task}=await call('/api/workers/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workerId,types,leaseSeconds:90})});if(task)await handle(task);else await wait(4000);}catch(error){console.error(error.message);await wait(8000);}}}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
