import {writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {analyzeVisual,containsContact,endCardData,layoutVersion} from './visual-checks.mjs';
import {layoutText} from './layout-text.mjs';
import {visualSettings} from './portrait-media.mjs';
const stamp=(s,vtt=false)=>{const unit=vtt?1000:100,n=Math.round(s*unit);return [Math.floor(n/(3600*unit)),Math.floor(n/(60*unit))%60,Math.floor(n/unit)%60].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(n%unit).padStart(vtt?3:2,'0');};
export async function composePortrait(tools,dir,job){
 const settings=visualSettings(job.visualSettings),logo=join(dir,'logo.png'),contact=endCardData(job);if(!existsSync(logo))throw new Error('MISSING_CLEAN_LOGO_ASSET: the firm logo is required.');
 const probe=await tools.probe(join(dir,'presenter.mp4')),source=probe.streams.find(s=>s.codec_type==='video');
 const [n,d]=String(source?.avg_frame_rate).split('/').map(Number),fps=n/d;
 if(!source||Number(probe.format?.duration)<job.duration-0.25||!Number.isFinite(fps)||fps<15||fps>60)throw new Error('The presenter video has invalid duration or frame rate.');
 const analysis=await (tools.analyzeVisual||analyzeVisual)('scene',join(dir,'presenter.mp4'));
 if(containsContact(analysis.texts.join(' '),contact))throw new Error('SOURCE_NAP_CONFLICT: contact information or a URL was detected inside the source footage.');
 const {crop,faceProtected}=analysis;
 if(!crop||crop.x<0||crop.y<0||crop.x+crop.width>source.width||crop.y+crop.height>source.height||Math.abs(crop.width/crop.height-9/16)>.001)throw new Error('SOURCE_FRAMING_INCOMPATIBLE: crop cannot fill the frame without padding.');
 let scale=settings.logoScale;const logoProbe=await tools.probe(logo),ls=logoProbe.streams.find(s=>s.codec_type==='video');
 if(!ls?.width||!ls?.height)throw new Error('MISSING_CLEAN_LOGO_ASSET: the logo dimensions are invalid.');
 let lw,lh,logoReducedForCollision=false;const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 const logoBox=()=>({left:(1036-lw)/1080,right:1036/1080,top:77/1920,bottom:(77+lh)/1920});
 const size=()=>{lw=Math.floor(Math.min(378*scale,384*ls.width/ls.height));lh=Math.floor(lw*ls.height/ls.width);};size();
 if(intersects(logoBox(),faceProtected)&&analysis.safeCropX?.max>crop.x){
   const shift=analysis.safeCropX.max-crop.x;crop.x+=shift;faceProtected.left-=shift/crop.width;faceProtected.right-=shift/crop.width;
 }
 while(intersects(logoBox(),faceProtected)&&scale>=.4){scale-=.025;size();logoReducedForCollision=true;}
 if(scale<.4||77+lh>480)throw new Error('LOGO_FACE_COLLISION: the logo cannot fit safely above the presenter and end-card text.');
 if(faceProtected.bottom>=.78)throw new Error('CAPTION_FACE_COLLISION: correct the speaker framing before rendering captions.');
 const text=await layoutText(job.cues,contact,settings.captionSize);
 const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Arial,${settings.captionSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,3,12,0,2,87,87,${settings.captionBottom},1\nStyle: Field,Arial,46,&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,0,0,0,0,100,100,0,0,1,0,0,8,108,108,0,1\nStyle: Name,Arial,58,&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,1,0,0,0,100,100,0,0,1,0,0,8,108,108,0,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 const event=(a,b,style,value)=>`Dialogue: 0,${stamp(a)},${stamp(b)},${style},,0,0,0,,${value}\n`;
 writeFileSync(join(dir,'captions.ass'),header+text.captions.map(c=>event(c.start,c.end,'Caption',c.lines.join('\\N'))).join(''));
 writeFileSync(join(dir,'captions.vtt'),'WEBVTT\n\n'+text.captions.map((c,i)=>`${i+1}\n${stamp(c.start,true)} --> ${stamp(c.end,true)}\n${c.lines.join('\n')}\n`).join('\n'));
 const endSeconds=3,mainFrames=Math.ceil(job.duration*fps),mainDuration=mainFrames/fps,endFrames=Math.round(endSeconds*fps),totalDuration=(mainFrames+endFrames)/fps;
 writeFileSync(join(dir,'end-card.ass'),header+text.fields.map(f=>event(0,endSeconds,f.key==='name'?'Name':'Field',`{\\an8\\pos(540,${Math.round(f.y)})}`+f.lines.join('\\N'))).join(''));
 const filter=`[0:v]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=0.1,fps=${fps},trim=end_frame=${mainFrames},setpts=PTS-STARTPTS[scene];[2:v]scale=${lw}:${lh},format=rgba,split[logo][endLogo];[scene][logo]overlay=1036-w:77:shortest=1,ass=captions.ass[main];[3:v]setsar=1,trim=end_frame=${endFrames},setpts=PTS-STARTPTS[white];[white][endLogo]overlay=1036-w:77:shortest=1,ass=end-card.ass[end];[main][end]concat=n=2:v=1:a=0[out];[1:a]apad,atrim=duration=${totalDuration}[audio]`;
 await tools.run(['-i','presenter.mp4','-i','voice.wav','-loop','1','-i','logo.png','-f','lavfi','-i',`color=c=white:s=1080x1920:r=${fps}:d=3`,'-filter_complex',filter,'-map','[out]','-map','[audio]','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r',String(fps),'-c:a','aac','-b:a','192k','-t',String(totalDuration),'-movflags','+faststart','-metadata','comment=AI-generated speaking avatar and narration.','final.mp4'],dir);
 const topic=job.thumbnailTitle||job.question.split(/\s+/).slice(0,6).join(' ');
 const thumbnailText=await layoutText([{start:0,end:job.duration,text:topic}],contact,64);
 writeFileSync(join(dir,'thumbnail.ass'),header+event(0,job.duration,'Caption','{\\fs64}'+thumbnailText.captions[0].lines.join('\\N')));
 await tools.run(['-ss',String(Math.min(1,job.duration/2)),'-i','presenter.mp4','-i','logo.png','-filter_complex',`[0:v]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=1080:1920,setsar=1[scene];[1:v]scale=${lw}:${lh}[logo];[scene][logo]overlay=1036-w:77,ass=thumbnail.ass[out]`,'-map','[out]','-frames:v','1','-update','1','thumbnail.png'],dir);
 await tools.run(['-ss',String(mainDuration+1),'-i','final.mp4','-frames:v','1','-update','1','end-card.png'],dir);
 const result=await tools.probe(join(dir,'final.mp4')),video=result.streams.find(s=>s.codec_type==='video'),audio=result.streams.find(s=>s.codec_type==='audio'),duration=Number(result.format.duration);
 if(video?.width!==1080||video?.height!==1920||video?.codec_name!=='h264'||audio?.codec_name!=='aac'||Math.abs(duration-totalDuration)>0.12)throw new Error('Portrait export failed resolution, audio, codec, or two-state duration checks.');
 return {width:1080,height:1920,aspectRatio:'9:16',layoutVersion,logoIncluded:true,endCardLogoIncluded:true,logoReducedForCollision,captionFontSize:settings.captionSize,captionBackground:"#000000",logoBounds:{x:1036-lw,y:77,width:lw,height:lh},codec:video.codec_name,audio:audio.codec_name,fps,duration,speechDuration:job.duration,endCardStartTime:mainDuration,endCardSeconds:endSeconds,endCardFields:contact,endCardBounds:text.endCardBounds,sourceWidth:source.width,sourceHeight:source.height,native1080:crop.width>=1080&&crop.height>=1920,sceneCoverage:1,visualAnalysis:analysis,maximumCaptionLines:Math.max(...text.captions.map(c=>c.lines.length)),visualReviewRequired:true,passed:true};
}
