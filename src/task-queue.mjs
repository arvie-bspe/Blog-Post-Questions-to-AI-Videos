import {randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdirSync,createWriteStream,existsSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';

const now=()=>new Date().toISOString();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const publicTask=t=>{const {leaseToken,payload,...safe}=t;return {...safe,payload};};

export class TaskQueue{
  constructor({db,dataDir,env=process.env,onComplete=async()=>{},onFailure=()=>{}}){
    Object.assign(this,{db,dataDir,env,onComplete,onFailure});
    this.root=join(dataDir,'worker-tasks');mkdirSync(this.root,{recursive:true});
    db.exec(`CREATE TABLE IF NOT EXISTS worker_tasks(
      id TEXT PRIMARY KEY,type TEXT NOT NULL,subject TEXT NOT NULL,status TEXT NOT NULL,
      priority INTEGER NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,payload TEXT NOT NULL,
      lease_token TEXT,lease_owner TEXT,lease_until TEXT,result TEXT,error TEXT,applied_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 3,available_at TEXT
    ); CREATE INDEX IF NOT EXISTS worker_tasks_status ON worker_tasks(status,priority,created);
    CREATE TABLE IF NOT EXISTS worker_heartbeats(
      worker_id TEXT PRIMARY KEY,types TEXT NOT NULL,last_seen TEXT NOT NULL
    );`);
    const columns=new Set(db.prepare('PRAGMA table_info(worker_tasks)').all().map(column=>column.name));
    if(!columns.has('attempts'))db.exec('ALTER TABLE worker_tasks ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
    if(!columns.has('max_attempts'))db.exec('ALTER TABLE worker_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3');
    if(!columns.has('available_at'))db.exec('ALTER TABLE worker_tasks ADD COLUMN available_at TEXT');
    this.reclaimExpired();
  }
  touch(workerId,types=[]){this.db.prepare('INSERT INTO worker_heartbeats(worker_id,types,last_seen) VALUES(?,?,?) ON CONFLICT(worker_id) DO UPDATE SET types=excluded.types,last_seen=excluded.last_seen').run(workerId,JSON.stringify(types),now());}
  workers(){return this.db.prepare('SELECT worker_id,types,last_seen FROM worker_heartbeats ORDER BY last_seen DESC').all().map(r=>({workerId:r.worker_id,types:JSON.parse(r.types),lastSeen:r.last_seen,online:Date.parse(r.last_seen)>Date.now()-120000}));}
  authenticate(req){
    const expected=Buffer.from(String(this.env.STUDIO_WORKER_TOKEN||'')),actual=Buffer.from(String(req.headers['x-worker-token']||''));
    if(expected.length<24||actual.length!==expected.length||!timingSafeEqual(actual,expected))fail('Worker authentication failed.',401);
  }
  row(r){if(!r)return null;const {lease_token,lease_owner,lease_until,applied_at,...rest}=r;return {...rest,leaseToken:lease_token,leaseOwner:lease_owner,leaseUntil:lease_until,appliedAt:applied_at,payload:JSON.parse(r.payload),result:r.result?JSON.parse(r.result):null};}
  get(id){return this.row(this.db.prepare('SELECT * FROM worker_tasks WHERE id=?').get(id));}
  list(subject){return this.db.prepare('SELECT * FROM worker_tasks WHERE subject=? ORDER BY created DESC').all(subject).map(r=>publicTask(this.row(r)));}
  supersedeQueued(subject,keepId){
    const at=now(),message='Superseded by the current saved analysis task.';
    this.db.prepare("UPDATE worker_tasks SET status='failed',error=?,applied_at=?,available_at=NULL,updated=? WHERE subject=? AND status='queued' AND id<>?").run(message,at,at,subject,keepId);
    return this.list(subject);
  }
  applyFailure(task){
    if(!task||task.status!=='failed'||task.appliedAt)return task;
    this.onFailure(task);this.markApplied(task.id);return this.get(task.id);
  }
  reconcileFailures(){for(const row of this.db.prepare("SELECT id FROM worker_tasks WHERE status='failed' AND applied_at IS NULL ORDER BY created").all())try{this.applyFailure(this.get(row.id));}catch{};}
  reclaimExpired(){const at=now();this.db.prepare("UPDATE worker_tasks SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'queued' END,error=CASE WHEN attempts>=max_attempts THEN 'Worker lease expired too many times.' ELSE error END,available_at=CASE WHEN attempts>=max_attempts THEN NULL ELSE ? END,lease_token=NULL,lease_owner=NULL,lease_until=NULL,updated=? WHERE status='working' AND lease_until<?").run(at,at,at);}
  enqueue({type,subject,payload,priority=50,idempotencyKey,maxAttempts=3}){
    if(!/^[a-z][a-z0-9_]{2,40}$/.test(type)||typeof subject!=='string'||!subject)fail('Invalid worker task.');
    const id=idempotencyKey||randomUUID(),existing=this.get(id);if(existing)return publicTask(existing);
    maxAttempts=Math.max(1,Math.min(10,Number(maxAttempts)||3));const at=now();this.db.prepare('INSERT INTO worker_tasks(id,type,subject,status,priority,created,updated,payload,max_attempts,available_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,type,subject,'queued',priority,at,at,JSON.stringify(payload),maxAttempts,at);
    return publicTask(this.get(id));
  }
  claim({workerId,types,leaseSeconds=90}){
    if(typeof workerId!=='string'||!/^[-\w.]{3,80}$/.test(workerId))fail('Invalid worker ID.');
    const allowed=[...new Set((types||[]).filter(x=>/^[a-z][a-z0-9_]{2,40}$/.test(x)))];if(!allowed.length)fail('Worker must declare task types.');
    leaseSeconds=Math.max(30,Math.min(300,Number(leaseSeconds)||90));this.touch(workerId,allowed);this.reclaimExpired();this.reconcileFailures();
    this.db.exec('BEGIN IMMEDIATE');try{
      const marks=allowed.map(()=>'?').join(','),r=this.db.prepare(`SELECT * FROM worker_tasks WHERE status='queued' AND attempts<max_attempts AND (available_at IS NULL OR available_at<=?) AND type IN (${marks}) ORDER BY priority ASC,created ASC LIMIT 1`).get(now(),...allowed);
      if(!r){this.db.exec('COMMIT');return null;}
      const leaseToken=randomUUID(),leaseUntil=new Date(Date.now()+leaseSeconds*1000).toISOString();
      this.db.prepare("UPDATE worker_tasks SET status='working',attempts=attempts+1,lease_token=?,lease_owner=?,lease_until=?,updated=? WHERE id=? AND status='queued'").run(leaseToken,workerId,leaseUntil,now(),r.id);
      this.db.exec('COMMIT');return {...publicTask(this.get(r.id)),leaseToken};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  leased(id,token){const task=this.get(id);if(!task)fail('Worker task not found.',404);if(task.status!=='working'||task.leaseToken!==token||Date.parse(task.leaseUntil)<=Date.now())fail('Worker task lease is no longer current.',409);return task;}
  heartbeat(id,token,seconds=90){const task=this.leased(id,token),until=new Date(Date.now()+Math.max(30,Math.min(300,Number(seconds)||90))*1000).toISOString();this.touch(task.leaseOwner,[task.type]);this.db.prepare('UPDATE worker_tasks SET lease_until=?,updated=? WHERE id=?').run(until,now(),id);return {...publicTask(this.get(id)),leaseUntil:until};}
  async complete(id,token,result){const leased=this.leased(id,token);this.touch(leased.leaseOwner,[leased.type]);const at=now();this.db.prepare("UPDATE worker_tasks SET status='completed',result=?,error=NULL,available_at=NULL,lease_token=NULL,lease_owner=NULL,lease_until=NULL,updated=? WHERE id=?").run(JSON.stringify(result),at,id);const task=this.get(id);try{await this.onComplete(task);}catch(error){this.db.prepare("UPDATE worker_tasks SET status='failed',error=?,updated=? WHERE id=?").run(String(error.message||error).slice(0,4000),now(),id);this.applyFailure(this.get(id));throw error;}return publicTask(this.get(id));}
  fail(id,token,message,retryable=true){const task=this.leased(id,token),willRetry=retryable&&task.attempts<task.max_attempts,status=willRetry?'queued':'failed',available=willRetry?new Date(Date.now()+Math.min(60,5*2**Math.max(0,task.attempts-1))*1000).toISOString():null;this.touch(task.leaseOwner,[task.type]);this.db.prepare('UPDATE worker_tasks SET status=?,error=?,available_at=?,lease_token=NULL,lease_owner=NULL,lease_until=NULL,updated=? WHERE id=?').run(status,String(message||'Worker task failed.').slice(0,4000),available,now(),id);if(!willRetry)this.applyFailure(this.get(id));return publicTask(this.get(id));}
  markApplied(id){this.db.prepare('UPDATE worker_tasks SET applied_at=?,updated=? WHERE id=? AND applied_at IS NULL').run(now(),now(),id);}
  artifactDir(id){const task=this.get(id);if(!task)fail('Worker task not found.',404);const dir=join(this.root,id);mkdirSync(dir,{recursive:true});return dir;}
  artifactPath(id,name){if(!['voice.wav','presenter.mp4','alignment.json'].includes(name))fail('Unsupported worker artifact.');return join(this.artifactDir(id),name);}
  async receiveArtifact(req,id,name,token,max=300*1024*1024){this.leased(id,token);const target=this.artifactPath(id,name),temp=target+'.upload';if(existsSync(temp))rmSync(temp,{force:true});let size=0;await new Promise((resolve,reject)=>{const out=createWriteStream(temp,{flags:'wx',mode:0o600});req.on('data',chunk=>{size+=chunk.length;if(size>max){req.destroy();out.destroy();reject(Object.assign(new Error('Worker artifact is too large.'),{status:413}));}});req.on('error',reject);out.on('error',reject);out.on('finish',resolve);req.pipe(out);});if(!size)fail('Worker artifact is empty.');renameSync(temp,target);return {name,size};}
}
