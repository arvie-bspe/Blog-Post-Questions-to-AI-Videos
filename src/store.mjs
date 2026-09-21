import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export class Store {
  constructor(path){
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, updated TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, job TEXT, at TEXT, actor TEXT, action TEXT);`);
    for(const job of this.list())if(job.status==='analyzing'){job.status='interrupted';job.error='The application restarted during analysis. Review before retrying.';this.save(job);}
  }
  list(){return this.db.prepare('SELECT payload FROM jobs ORDER BY updated DESC').all().map(r=>JSON.parse(r.payload));}
  get(id){const r=this.db.prepare('SELECT payload FROM jobs WHERE id=?').get(id);return r?JSON.parse(r.payload):null;}
  create(data){
    const r=this.db.prepare('SELECT payload FROM jobs WHERE identity=?').get(data.identity);
    if(r)return JSON.parse(r.payload);
    const job={...data,id:randomUUID(),created:new Date().toISOString(),status:'inspected',reviews:[]};this.save(job);return job;
  }
  save(job){job.updated=new Date().toISOString();job.revision=(job.revision||0)+1;this.db.prepare('INSERT INTO jobs VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET identity=excluded.identity,updated=excluded.updated,payload=excluded.payload').run(job.id,job.identity,job.updated,JSON.stringify(job));return job;}
  record(id,actor,action){this.db.prepare('INSERT INTO audit(job,at,actor,action) VALUES(?,?,?,?)').run(id,new Date().toISOString(),actor,action);}
  close(){this.db.close();}
}
