import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {composePortrait,composeLandscape} from './two-state-media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const presenterPath=join(root,'assets/presenters/studio-presenter-01.png');
function binary(name,env){const local=join(root,'vendor/ffmpeg/bin',name+'.exe');return env[name.toUpperCase()+'_PATH']||(existsSync(local)?local:name);}
export function execute(command,args,options={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,shell:false,...options});let out='',err='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Local media processing timed out.'));},600000);timer.unref();
    child.stdout.on('data',d=>out=(out+d).slice(-1000000));child.stderr.on('data',d=>err=(err+d).slice(-12000));
    child.once('error',e=>{clearTimeout(timer);reject(new Error('Media tool unavailable: '+e.code));});child.once('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error('Media processing failed: '+err.slice(-1400)));});
  });
}
export function mediaTools(env=process.env){
  const ffmpeg=binary('ffmpeg',env),ffprobe=binary('ffprobe',env);
  return {
    async check(){await execute(ffmpeg,['-version']);await execute(ffprobe,['-version']);return true;},
    async probe(path){return JSON.parse(await execute(ffprobe,['-v','error','-show_format','-show_streams','-of','json',path]));},
    run:(args,cwd)=>execute(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{cwd})
  };
}
export function durationOf(probe){const duration=Number(probe.format?.duration);if(!Number.isFinite(duration)||duration<=0)throw new Error('Media has no measurable duration.');return duration;}
export async function compose(tools,dir,job){
  if(job.format?.aspectRatio==='9:16')return composePortrait(tools,dir,job);
  if(job.format?.aspectRatio==='16:9')return composeLandscape(tools,dir,job);
  throw new Error('Choose portrait 9:16 or landscape 16:9 output.');
}
