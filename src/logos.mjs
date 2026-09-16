import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {hash} from './domain.mjs';
import {webURL,webBytes} from './safe-web.mjs';
import {analyzeVisual,containsContact,layoutVersion} from './visual-checks.mjs';
export function homepageFor(parent){
  const source=parent.client.homepage||parent.row.pageUrl;if(!source)throw new Error('The client homepage URL is missing. Add it to the client information sheet.');
  return new URL('/',webURL(source)).href;
}
export class LogoService{
  constructor(dataDir,{fetcher=webBytes,browserFactory,analyzer=analyzeVisual}={}){this.root=join(dataDir,'logos');mkdirSync(this.root,{recursive:true});this.fetcher=fetcher;this.browserFactory=browserFactory;this.analyzer=analyzer;this.pending=new Map();}
  async acquire(parent,{refresh=false}={}){
    const homepage=homepageFor(parent),domain=new URL(homepage).hostname.replace(/^www\./,''),key=hash(domain),dir=join(this.root,key);mkdirSync(dir,{recursive:true});
    const metaPath=join(dir,'source.json'),path=join(dir,'logo.png');
    if(!refresh&&existsSync(metaPath)&&existsSync(path)){const meta=JSON.parse(readFileSync(metaPath,'utf8'));if(meta.layoutVersion===layoutVersion&&meta.domain===domain&&meta.hash===hash(readFileSync(path))&&Date.now()-Date.parse(meta.retrievedAt)<7*86400000)return {...meta,path};}
    if(this.pending.has(key))return this.pending.get(key);
    const promise=this.scrape(homepage,domain,dir,parent.client.name).finally(()=>this.pending.delete(key));this.pending.set(key,promise);return promise;
  }
  async scrape(homepage,domain,dir,firmName){
    const html=await this.fetcher(homepage,3*1024*1024);
    const finalDomain=new URL(html.url).hostname.replace(/^www\./,'');if(finalDomain!==domain)throw new Error('The homepage redirects to a different firm domain. Verify the client homepage.');
    const chromium=this.browserFactory||(await import('playwright')).chromium;
    const browser=await chromium.launch({headless:true,...(process.env.LOGO_CHROMIUM_PATH?{executablePath:process.env.LOGO_CHROMIUM_PATH}:{}),args:['--disable-dev-shm-usage']});
    try{
      const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',viewport:{width:900,height:500}}),page=await context.newPage();
      await context.route('**/*',route=>route.abort());
      await page.setContent(html.body.toString('utf8'),{waitUntil:'domcontentloaded',timeout:15000});
      const candidates=await page.evaluate(({homepage,firmName})=>{
        const out=[],add=(raw,score,label)=>{try{const u=new URL(raw,homepage);if(u.protocol==='https:')out.push({url:u.href,score,label});}catch{}};
        for(const img of document.querySelectorAll('img')){
          const attrs=[img.alt,img.id,img.className,img.parentElement?.className].join(' '),src=img.getAttribute('nitro-lazy-src')||img.getAttribute('data-src')||img.getAttribute('data-lazy-src')||img.getAttribute('src')||'';
          const score=(/logo/i.test(attrs)?30:0)+(/logo/i.test(src)?20:0)+(/header|brand/i.test(attrs)?10:0)+(firmName.split(/\W+/).filter(w=>w.length>4).some(w=>img.alt.toLowerCase().includes(w.toLowerCase()))?10:0)-(/badge|award|partner|social|footer/i.test(attrs+' '+src)?25:0);
          if(score>=20)add(src,score,img.alt||'Homepage logo');
        }
        const visit=(o,depth=0)=>{if(!o||typeof o!=='object'||depth>12)return;if(o.logo){const l=o.logo;add(typeof l==='string'?l:l.url||l.contentUrl,35,'Homepage structured logo');}for(const v of Object.values(o)){if(Array.isArray(v))v.forEach(x=>visit(x,depth+1));else if(typeof v==='object')visit(v,depth+1);}};
        for(const el of document.querySelectorAll('script[type="application/ld+json"]'))try{visit(JSON.parse(el.textContent));}catch{}
        return out.sort((a,b)=>b.score-a.score).filter((v,i,a)=>a.findIndex(x=>x.url===v.url)===i).slice(0,5);
      },{homepage:html.url,firmName});
      if(!candidates.length)throw new Error('No clear firm logo was found in the homepage HTML. Verify the homepage and logo before generating.');
      let selected,imageBytes;
      for(const candidate of candidates)try{const res=await this.fetcher(candidate.url,3*1024*1024);const type=(res.headers['content-type']||'').split(';')[0];if(!['image/svg+xml','image/png','image/jpeg','image/webp'].includes(type))continue;selected={...candidate,contentType:type,sourceUrl:res.url};imageBytes=res.body;break;}catch{}
      if(!selected)throw new Error('The homepage logo could not be downloaded in a supported format.');
      await context.unroute('**/*');
      await context.route('**/*',route=>{
        if(route.request().url()==='https://logo.local/logo')return route.fulfill({body:imageBytes,contentType:selected.contentType});
        if(route.request().url()==='https://logo.local/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\'; style-src \'unsafe-inline\'"><style>body{margin:0;background:transparent}img{display:block;width:800px;height:260px;object-fit:contain}</style></head><body><img src="/logo" alt="Firm logo"></body></html>'});
        return route.abort();
      });
      await page.goto('https://logo.local/',{waitUntil:'load',timeout:15000});
      const dims=await page.locator('img').evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight}));if(!dims.w||!dims.h)throw new Error('The logo could not be rasterised.');
      const png=await page.locator('img').screenshot({omitBackground:true}),path=join(dir,'logo.png');writeFileSync(path+'.tmp',png);renameSync(path+'.tmp',path);
      const screening=await this.analyzer('logo',path);
      if(containsContact(screening.texts.join(' ')))throw new Error('MISSING_CLEAN_LOGO_ASSET: the homepage asset contains contact information. Supply a clean official logo-only asset.');
      const meta={domain,homepage,sourceUrl:selected.sourceUrl,sourceContentType:selected.contentType,retrievedAt:new Date().toISOString(),hash:hash(readFileSync(path)),rasterizer:'Playwright Chromium',label:selected.label,layoutVersion,screening};
      writeFileSync(join(dir,'source.json'),JSON.stringify(meta,null,2));return {...meta,path};
    }finally{await browser.close();}
  }
}
