import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export function createSecurity(env){
  const host=env.HOST||'127.0.0.1',port=Number(env.PORT||4173);
  const local=env.NODE_ENV!=='production'&&['127.0.0.1','localhost','::1'].includes(host);
  const origin=new URL(env.APP_ORIGIN||`http://127.0.0.1:${port}`);
  const roles=['Arvie','Keziah','Macy'];
  if(!local){
    if(!env.APP_ORIGIN||origin.protocol!=='https:')throw new Error('Public hosting requires APP_ORIGIN with an HTTPS URL.');
    const passwords=roles.map(r=>env[`${r.toUpperCase()}_PASSWORD`]||'');
    if(passwords.some(p=>p.length<16)||new Set(passwords).size!==3)throw new Error('Public hosting requires three distinct team passwords of at least 16 characters.');
  }
  const salt=randomBytes(16),passwords=new Map(roles.map(r=>[r,scryptSync(env[`${r.toUpperCase()}_PASSWORD`]||randomBytes(32).toString('hex'),salt,32)])),sessions=new Map(),attempts=new Map();
  return {local,origin:origin.origin,host,port,
    checkRequest(req){
      if(req.headers.host!==origin.host)throw Object.assign(new Error('Unrecognized application host.'),{status:403});
      if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin.origin)throw Object.assign(new Error('Request origin did not match the application.'),{status:403});
    },
    login(role,password,ip){
      const now=Date.now();for(const [k,a]of attempts)if(now-a.at>600000)attempts.delete(k);
      const a=attempts.get(ip)||{at:now,count:0};a.count++;attempts.set(ip,a);
      if(a.count>15)throw Object.assign(new Error('Too many login attempts. Try again in ten minutes.'),{status:429});
      const expected=passwords.get(role),actual=scryptSync(String(password||''),salt,32);
      if(!expected||!timingSafeEqual(actual,expected))throw Object.assign(new Error('Name or password is incorrect.'),{status:401});
      attempts.delete(ip);for(const [k,s]of sessions)if(s.expires<now)sessions.delete(k);
      const token=randomBytes(32).toString('hex');sessions.set(token,{role,expires:now+8*3600000});return token;
    },
    actor(req){
      if(local)return roles.includes(req.headers['x-reviewer'])?req.headers['x-reviewer']:'Arvie';
      const token=req.headers.cookie?.match(/(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/)?.[1],s=sessions.get(token);
      return s&&s.expires>Date.now()?s.role:null;
    },
    logout(req){const token=req.headers.cookie?.match(/studio_session=([a-f0-9]{64})/)?.[1];sessions.delete(token);},
    cookie(token){return `studio_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?28800:0}${local?'':'; Secure'}`;}
  };
}
