import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from './accounts.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const sessionToken=req=>req.headers.cookie?.match(/(?:^|;\s*)studio_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1]||'';

export function createSecurity(env,db){
  const host=env.HOST||'127.0.0.1',port=Number(env.PORT||4173),local=env.NODE_ENV!=='production'&&['127.0.0.1','localhost','::1'].includes(host),origin=new URL(env.APP_ORIGIN||`http://127.0.0.1:${port}`);
  if(!local){
    if(!env.APP_ORIGIN||origin.protocol!=='https:')throw new Error('Public hosting requires APP_ORIGIN with an HTTPS URL.');
    const passwords=['ARVIE_PASSWORD','KEZIAH_PASSWORD','MACY_PASSWORD'].map(key=>env[key]||'');
    if(passwords.some(password=>password.length<16)||new Set(passwords).size!==3)throw new Error('Public hosting requires the three migration passwords to remain distinct and at least 16 characters. New accounts are managed inside the studio.');
  }
  const ownedDb=db?null:new DatabaseSync(':memory:'),accounts=new AccountStore(db||ownedDb,env,local);
  const attempts=new Map();
  const localAccount=req=>{
    const name=String(req.headers['x-reviewer']||'Local admin').slice(0,80),saved=accounts.find(name);
    if(saved)return {id:saved.id,name:saved.name,email:saved.email||'',login:saved.login,role:saved.role,slackId:saved.slack_id||'',active:true,local:true};
    return {id:'local-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,email:'',login:name.toLowerCase(),role:/admin|arvie/i.test(name)?'admin':'member',slackId:'',active:true,local:true};
  };
  const account=req=>local?localAccount(req):accounts.session(sessionToken(req));
  return {local,origin:origin.origin,host,port,accounts,
    checkRequest(req){
      if(req.headers.host!==origin.host)fail('Unrecognized application host.',403);
      if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin.origin)fail('Request origin did not match the application.',403);
    },
    login(identifier,password,ip){
      const current=Date.now();for(const [key,value]of attempts)if(current-value.at>600000)attempts.delete(key);
      const attempt=attempts.get(ip)||{at:current,count:0};attempt.count++;attempts.set(ip,attempt);if(attempt.count>15)fail('Too many login attempts. Try again in ten minutes.',429);
      const user=accounts.authenticate(identifier,password);if(!user)fail('Email or password is incorrect.',401);
      attempts.delete(ip);return accounts.createSession(user.id);
    },
    account,
    actor(req){return account(req)?.name||null;},
    requireAdmin(req){const user=account(req);if(!user)fail('Sign in to view the studio.',401);if(user.role!=='admin')fail('An admin account is required for this action.',403);return user;},
    logout(req){accounts.deleteSession(sessionToken(req));},
    cookie(token){return `studio_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?28800:0}${local?'':'; Secure'}`;},
    close(){ownedDb?.close();}
  };
}
