export async function layoutText(cues,contact,captionSize){
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true,...(process.env.LOGO_CHROMIUM_PATH?{executablePath:process.env.LOGO_CHROMIUM_PATH}:{}),args:['--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent('<!doctype html><canvas></canvas>');
  return await page.evaluate(({cues,contact,captionSize})=>{
   const ctx=document.querySelector('canvas').getContext('2d');
   function wrap(value,size,max,breakLong=false,bold=false){
    ctx.font=`${bold?'bold ':''}${size}px Arial`;const out=[''];
    for(let word of value.trim().split(/\s+/)){
     if(ctx.measureText(word).width>max){
      if(!breakLong)throw new Error('Caption word is too wide for the safe area. Request a caption correction.');
      const chunks=[];let chunk='';for(const c of word){if(ctx.measureText(chunk+c).width>max){chunks.push(chunk);chunk='';}chunk+=c;}chunks.push(chunk);
      if(out.at(-1))out.push('');for(const part of chunks.slice(0,-1)){out[out.length-1]=part;out.push('');}word=chunks.at(-1);
     }
     const proposed=out.at(-1)+(out.at(-1)?' ':'')+word;
     if(ctx.measureText(proposed).width>max&&out.at(-1))out.push(word);else out[out.length-1]=proposed;
    }return out.filter(Boolean);
   }
   const captions=[];
   for(const cue of cues){let lines=wrap(cue.text,captionSize,786);
    if(lines.length>2)lines=wrap(cue.text,captionSize,880);
    if(lines.length>2)throw new Error('CAPTION_TIMING_REQUIRED: this audio-timed caption needs shorter provider cues or verified word timestamps. Timing will not be guessed from word counts.');
    captions.push({...cue,lines,timing:'provider audio cue'});
   }
   function wrapUrl(value){ctx.font='46px Arial';const lines=[];let rest=value;while(ctx.measureText(rest).width>840){let fit=1;while(fit<rest.length&&ctx.measureText(rest.slice(0,fit+1)).width<=840)fit++;const prefix=rest.slice(0,fit);const boundary=Math.max(prefix.lastIndexOf('/'),prefix.lastIndexOf('-'),prefix.lastIndexOf('?'),prefix.lastIndexOf('&'));const cut=boundary>12?boundary+1:fit;lines.push(rest.slice(0,cut));rest=rest.slice(cut);}if(rest)lines.push(rest);return lines;}
   const fields=Object.entries(contact).map(([key,value])=>({key,value,size:key==='name'?58:46,lines:key==='targetUrl'?wrapUrl(value):wrap(value,key==='name'?58:46,840,false,key==='name')}));
   const height=fields.reduce((n,f)=>n+f.lines.length*f.size*1.35,0)+3*44;
   if(height>960)throw new Error('END_CARD_TEXT_TOO_LONG: the supplied fields cannot fit legibly in the required safe area.');
   let y=960-height/2;for(const f of fields){f.y=y;f.height=f.lines.length*f.size*1.35;y+=f.height+44;}
   return {captions,fields,endCardBounds:{left:120,right:960,top:960-height/2,bottom:960+height/2}};
  },{cues,contact,captionSize});
 }finally{await browser.close();}
}
