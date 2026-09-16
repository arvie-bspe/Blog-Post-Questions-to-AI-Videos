import {spawn} from 'node:child_process';
import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {composePortrait} from './two-state-media.mjs';
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
const stamp=(seconds,vtt=false)=>{const n=Math.round(seconds*(vtt?1000:100)),units=vtt?1000:100;return [Math.floor(n/(3600*units)),Math.floor(n/(60*units))%60,Math.floor(n/units)%60].map((x,i)=>String(x).padStart(vtt||i?2:1,'0')).join(':')+'.'+String(n%units).padStart(vtt?3:2,'0');};
function wrap(text,max){const lines=[''];for(const word of text.replace(/\r?\n/g,' ').split(/\s+/)){let i=lines.length-1;if(lines[i].length+word.length+1>max){lines.push(word);}else lines[i]+=(lines[i]?' ':'')+word;}return lines.join('\\N');}
const assHeader=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00232323,&H00232323,0,0,0,0,100,100,0,0,3,10,0,2,160,160,70,1\nStyle: Contact,Arial,28,&H00232323,&H00232323,&H00F5F5F5,&H00F5F5F5,0,0,0,0,100,100,0,0,3,9,0,9,80,80,65,1\nStyle: Topic,Arial,64,&H00232323,&H00232323,&H00F5F5F5,&H00F5F5F5,1,0,0,0,100,100,0,0,3,16,0,6,950,95,0,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
const event=(start,end,style,text)=>`Dialogue: 0,${stamp(start)},${stamp(end)},${style},,0,0,0,,${text}\n`;
export function writeCaptions(dir,job){
  const contact=[job.client.name,job.client.address,job.client.phone].map(t=>wrap(t,33)).join('\\N');
  writeFileSync(join(dir,'captions.ass'),assHeader+event(0,job.duration,'Contact',contact)+job.cues.map(c=>event(c.start,c.end,'Caption',wrap(c.text,42))).join(''));
  writeFileSync(join(dir,'captions.vtt'),'WEBVTT\n\n'+job.cues.map((c,i)=>`${i+1}\n${stamp(c.start,true)} --> ${stamp(c.end,true)}\n${c.text}\n`).join('\n'));
  writeFileSync(join(dir,'thumbnail.ass'),assHeader+event(0,1,'Contact',contact)+event(0,1,'Topic',wrap(job.thumbnailTitle,20)));
}
export async function compose(tools,dir,job){
  if(job.format?.aspectRatio==='9:16')return composePortrait(tools,dir,job);
  const source=await tools.probe(join(dir,'presenter.mp4')),stream=source.streams.find(s=>s.codec_type==='video');
  if(!stream||durationOf(source)<job.duration-0.25)throw new Error('The talking-head clip is shorter than the voiceover. Review the provider output.');
  const [n,d]=String(stream.avg_frame_rate).split('/').map(Number),fps=n/d;
  if(!Number.isFinite(fps)||fps<15||fps>60)throw new Error('The provider video has an unsupported frame rate.');
  writeCaptions(dir,job);
  await tools.run(['-i','presenter.mp4','-i','voice.wav','-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,ass=captions.ass','-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r',String(fps),'-c:a','aac','-b:a','192k','-t',String(job.duration),'-movflags','+faststart','-metadata','comment=AI-generated talking video; synthetic narration.','final.mp4'],dir);
  await tools.run(['-ss',String(Math.min(1,job.duration/2)),'-i','presenter.mp4','-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,ass=thumbnail.ass','-frames:v','1','-update','1','thumbnail.png'],dir);
  const result=await tools.probe(join(dir,'final.mp4')),video=result.streams.find(s=>s.codec_type==='video'),audio=result.streams.find(s=>s.codec_type==='audio');
  if(video?.width!==1920||video?.height!==1080||video?.codec_name!=='h264'||audio?.codec_name!=='aac'||Math.abs(durationOf(result)-job.duration)>0.35)throw new Error('The final export failed resolution, codec, or duration checks.');
  return {width:video.width,height:video.height,codec:video.codec_name,audio:audio.codec_name,fps,duration:durationOf(result),sourceWidth:stream.width,sourceHeight:stream.height,native1080:stream.width>=1920&&stream.height>=1080,passed:true};
}
