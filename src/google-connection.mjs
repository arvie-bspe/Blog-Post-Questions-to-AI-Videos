import {randomBytes,createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
export const googleScopes=['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/documents.readonly','https://www.googleapis.com/auth/drive'];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export class GoogleConnection{
  constructor({env,dataDir,origin,fetcher=fetch}){Object.assign(this,{env,dataDir,origin,fetcher});this.states=new Map();this.file=join(dataDir,'google-connection.private.json');this.load();}
  load(){if(existsSync(this.file)){const saved=JSON.parse(readFileSync(this.file,'utf8'));if(saved.clientId===this.env.GOOGLE_CLIENT_ID&&saved.refreshToken){this.env.GOOGLE_REFRESH_TOKEN=saved.refreshToken;process.env.GOOGLE_REFRESH_TOKEN=saved.refreshToken;}}}
  status(){return {clientConfigured:Boolean(this.env.GOOGLE_CLIENT_ID&&this.env.GOOGLE_CLIENT_SECRET),connected:Boolean(this.env.GOOGLE_REFRESH_TOKEN||this.env.GOOGLE_SERVICE_ACCOUNT_JSON),redirectUri:this.origin+'/api/google/callback'};}
  start(actor){
    if(!actor)fail('Sign in before connecting Google.',401);if(!this.status().clientConfigured)fail('Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET privately in Railway first.');
    const state=randomBytes(32).toString('hex'),verifier=randomBytes(48).toString('base64url');
    for(const [k,v]of this.states)if(v.expires<Date.now())this.states.delete(k);if(this.states.size>=10)fail('Too many pending Google connections. Try again shortly.');
    this.states.set(state,{verifier,expires:Date.now()+600000});
    return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:this.env.GOOGLE_CLIENT_ID,redirect_uri:this.status().redirectUri,response_type:'code',scope:googleScopes.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString()};
  }
  async callback(params){
    const state=params.get('state'),saved=this.states.get(state);this.states.delete(state);if(!saved||saved.expires<Date.now())fail('Google connection expired or was not started here. Return to Connections and try again.');
    if(params.get('error')||!params.get('code'))fail('Google authorization was not completed.');
    const response=await this.fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:this.env.GOOGLE_CLIENT_ID,client_secret:this.env.GOOGLE_CLIENT_SECRET,code:params.get('code'),code_verifier:saved.verifier,grant_type:'authorization_code',redirect_uri:this.status().redirectUri}),signal:AbortSignal.timeout(30000)});
    if(!response.ok)fail('Google could not complete the connection. Check the OAuth client and callback URL.');
    const data=await response.json(),scopes=new Set(String(data.scope||'').split(' '));
    if(!data.refresh_token||googleScopes.some(s=>!scopes.has(s)))fail('Google did not grant the required offline access and source/upload permissions. Reconnect with the requested permissions.');
    const savedData={clientId:this.env.GOOGLE_CLIENT_ID,refreshToken:data.refresh_token,scopes:[...scopes],connectedAt:new Date().toISOString()};
    writeFileSync(this.file+'.tmp',JSON.stringify(savedData),{mode:0o600});renameSync(this.file+'.tmp',this.file);this.env.GOOGLE_REFRESH_TOKEN=data.refresh_token;process.env.GOOGLE_REFRESH_TOKEN=data.refresh_token;return {connected:true};
  }
}
