import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>new Date().toISOString();
const normalize=value=>String(value||'').trim().toLowerCase();
const publicAccount=row=>row?({id:row.id,name:row.name,email:row.email||'',login:row.login,role:row.role,slackId:row.slack_id||'',active:Boolean(row.active),createdAt:row.created_at,updatedAt:row.updated_at}):null;
const passwordParts=password=>{const salt=randomBytes(16),hash=scryptSync(String(password),salt,32);return {salt:salt.toString('base64'),hash:hash.toString('base64')};};
const validPassword=password=>{password=String(password||'');if(password.length<12||password.length>256)fail('Passwords must be 12 to 256 characters long.');return password;};

export class AccountStore{
  constructor(db,env={},local=false){
    this.db=db;this.env=env;this.local=local;
    db.exec(`CREATE TABLE IF NOT EXISTS accounts(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      email TEXT COLLATE NOCASE,
      login TEXT NOT NULL COLLATE NOCASE UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin','member')),
      slack_id TEXT,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique ON accounts(lower(email)) WHERE email IS NOT NULL AND email<>'';
    CREATE TABLE IF NOT EXISTS account_sessions(
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      session_version INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS account_events(
      id INTEGER PRIMARY KEY,
      at TEXT NOT NULL,
      actor_id TEXT,
      target_id TEXT,
      action TEXT NOT NULL
    );`);
    this.seedLegacyAccounts();
  }
  seedLegacyAccounts(){
    const seeds=[
      {name:'Arvie',role:'admin',password:this.env.ARVIE_PASSWORD,email:this.env.ARVIE_EMAIL},
      {name:'Keziah',role:'member',password:this.env.KEZIAH_PASSWORD,email:this.env.KEZIAH_EMAIL},
      {name:'Macy',role:'member',password:this.env.MACY_PASSWORD,email:this.env.MACY_EMAIL}
    ];
    for(const seed of seeds){
      if(this.db.prepare('SELECT id FROM accounts WHERE lower(login)=? OR lower(name)=?').get(normalize(seed.name),normalize(seed.name)))continue;
      const password=seed.password||randomBytes(32).toString('base64url'),parts=passwordParts(password),at=now();
      this.db.prepare('INSERT INTO accounts(id,name,email,login,role,slack_id,password_salt,password_hash,session_version,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,1,?,?)').run(randomUUID(),seed.name,normalize(seed.email)||null,normalize(seed.name),seed.role,null,parts.salt,parts.hash,at,at);
    }
  }
  count(){return Number(this.db.prepare('SELECT count(*) n FROM accounts WHERE active=1').get().n);}
  list(){return this.db.prepare('SELECT * FROM accounts WHERE active=1 ORDER BY role,name COLLATE NOCASE').all().map(publicAccount);}
  get(id){return publicAccount(this.db.prepare('SELECT * FROM accounts WHERE id=? AND active=1').get(id));}
  row(id){return this.db.prepare('SELECT * FROM accounts WHERE id=? AND active=1').get(id)||null;}
  conflicts(values,excludeId=null){
    const wanted=new Set(values.map(normalize).filter(Boolean));if(!wanted.size)return [];
    return this.db.prepare('SELECT * FROM accounts WHERE active=1 AND (? IS NULL OR id<>?)').all(excludeId,excludeId).filter(row=>[row.login,row.email,row.name].some(value=>wanted.has(normalize(value))));
  }
  find(identifier){const value=normalize(identifier);if(!value)return null;const rows=this.db.prepare('SELECT * FROM accounts WHERE active=1 AND (lower(login)=? OR lower(email)=? OR lower(name)=?)').all(value,value,value),unique=[...new Map(rows.map(row=>[row.id,row])).values()];return unique.length===1?unique[0]:null;}
  verify(row,password){if(!row)return false;const expected=Buffer.from(row.password_hash,'base64'),actual=scryptSync(String(password||''),Buffer.from(row.password_salt,'base64'),expected.length);return expected.length===actual.length&&timingSafeEqual(expected,actual);}
  authenticate(identifier,password){const row=this.find(identifier);return this.verify(row,password)?publicAccount(row):null;}
  create(input,actorId){
    const name=String(input.name||'').trim(),email=normalize(input.email),role=String(input.role||'member'),slackId=String(input.slackId||'').trim(),password=validPassword(input.password);
    if(!['admin','member'].includes(role))fail('Choose admin or member.');
    if(name.length<2||name.length>80)fail('Enter a name between 2 and 80 characters.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('Enter a valid email address.');
    if(slackId.length>64)fail('Slack member IDs must be 64 characters or fewer.');
    if(this.conflicts([name,email]).length)fail('That name or email conflicts with an existing sign-in identifier.',409);
    const parts=passwordParts(password),id=randomUUID(),at=now();
    try{this.db.prepare('INSERT INTO accounts(id,name,email,login,role,slack_id,password_salt,password_hash,session_version,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,1,?,?)').run(id,name,email,email,role,slackId||null,parts.salt,parts.hash,at,at);}catch(error){if(/UNIQUE/i.test(error.message))fail('That name or email already belongs to an account.',409);throw error;}
    this.event(actorId,id,'create_account');return this.get(id);
  }
  updateProfile(id,input,actorId=id){const slackId=String(input.slackId||'').trim();if(slackId.length>64)fail('Slack member IDs must be 64 characters or fewer.');if(!this.row(id))fail('Account not found.',404);this.db.prepare('UPDATE accounts SET slack_id=?,updated_at=? WHERE id=?').run(slackId||null,now(),id);this.event(actorId,id,'update_profile');return this.get(id);}
  changePassword(id,currentPassword,newPassword){const row=this.row(id);if(!row)fail('Account not found.',404);if(!this.verify(row,currentPassword))fail('Current password is incorrect.',401);this.setPassword(id,newPassword,id,'change_own_password');}
  resetPassword(id,newPassword,actorId){if(!this.row(id))fail('Account not found.',404);this.setPassword(id,newPassword,actorId,'reset_password');}
  setPassword(id,password,actorId,action){const parts=passwordParts(validPassword(password));this.db.prepare('UPDATE accounts SET password_salt=?,password_hash=?,session_version=session_version+1,updated_at=? WHERE id=?').run(parts.salt,parts.hash,now(),id);this.db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(id);this.event(actorId,id,action);}
  setRole(id,role,actorId){if(!['admin','member'].includes(role))fail('Choose admin or member.');const row=this.row(id);if(!row)fail('Account not found.',404);if(row.role==='admin'&&role!=='admin'&&Number(this.db.prepare("SELECT count(*) n FROM accounts WHERE active=1 AND role='admin'").get().n)<=1)fail('At least one active admin account is required.',409);this.db.prepare('UPDATE accounts SET role=?,session_version=session_version+1,updated_at=? WHERE id=?').run(role,now(),id);this.db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(id);this.event(actorId,id,'change_role');return this.get(id);}
  createSession(id){const row=this.row(id);if(!row)fail('Account not found.',404);this.pruneSessions();const token=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(token).digest('hex'),expires=Date.now()+8*3600000;this.db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?,?)').run(tokenHash,id,row.session_version,expires,now());return token;}
  session(token){if(!/^[A-Za-z0-9_-]{43}$/.test(String(token||'')))return null;const tokenHash=createHash('sha256').update(token).digest('hex'),row=this.db.prepare(`SELECT a.* FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.session_version=a.session_version AND a.active=1`).get(tokenHash,Date.now());return publicAccount(row);}
  deleteSession(token){if(!token)return;const tokenHash=createHash('sha256').update(token).digest('hex');this.db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(tokenHash);}
  pruneSessions(){this.db.prepare('DELETE FROM account_sessions WHERE expires_at<=?').run(Date.now());}
  event(actorId,targetId,action){this.db.prepare('INSERT INTO account_events(at,actor_id,target_id,action) VALUES(?,?,?,?)').run(now(),actorId||null,targetId||null,action);}
}

export {publicAccount};
