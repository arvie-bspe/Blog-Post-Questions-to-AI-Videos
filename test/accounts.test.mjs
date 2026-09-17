import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {AccountStore} from '../src/accounts.mjs';
import {createSecurity} from '../src/security.mjs';
import {createApp} from '../src/server.mjs';

const env={HOST:'0.0.0.0',APP_ORIGIN:'https://studio.test',ARVIE_PASSWORD:'arvie-long-test-password',KEZIAH_PASSWORD:'keziah-long-test-password',MACY_PASSWORD:'macy-long-test-password'};

test('legacy logins migrate once and new accounts store only password hashes',()=>{
  const db=new DatabaseSync(':memory:');try{
    const accounts=new AccountStore(db,env);assert.equal(accounts.list().length,3);assert.equal(accounts.find('Arvie').role,'admin');
    const member=accounts.create({name:'Test Reviewer',email:'reviewer@example.com',role:'member',password:'temporary-pass-123'},accounts.find('Arvie').id);
    assert.equal(accounts.authenticate('reviewer@example.com','temporary-pass-123').id,member.id);
    const row=db.prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?').get(member.id);assert.doesNotMatch(JSON.stringify(row),/temporary-pass-123/);
    new AccountStore(db,env);assert.equal(accounts.list().length,4);
  }finally{db.close();}
});

test('password resets revoke sessions and the final admin cannot be demoted',()=>{
  const db=new DatabaseSync(':memory:');try{
    const accounts=new AccountStore(db,env),admin=accounts.authenticate('Arvie',env.ARVIE_PASSWORD),token=accounts.createSession(admin.id);
    assert.equal(accounts.session(token).role,'admin');accounts.resetPassword(admin.id,'replacement-pass-456',admin.id);assert.equal(accounts.session(token),null);assert.equal(accounts.authenticate('Arvie','replacement-pass-456').id,admin.id);
    assert.throws(()=>accounts.setRole(admin.id,'member',admin.id),/At least one/);
  }finally{db.close();}
});

test('security sessions expose roles while member accounts cannot satisfy admin checks',()=>{
  const db=new DatabaseSync(':memory:'),security=createSecurity(env,db);try{
    const token=security.login('Keziah',env.KEZIAH_PASSWORD,'test'),req={headers:{cookie:'studio_session='+token}};
    assert.equal(security.account(req).role,'member');assert.throws(()=>security.requireAdmin(req),/admin/);
    const adminToken=security.login('Arvie',env.ARVIE_PASSWORD,'admin-test');assert.equal(security.requireAdmin({headers:{cookie:'studio_session='+adminToken}}).role,'admin');
  }finally{db.close();}
});

test('admin account APIs create a login while members cannot list the directory',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-accounts-')),app=createApp({...env,PORT:'4194',DATA_DIR:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const request=(path,{body,cookie}={})=>new Promise((resolve,reject)=>{const req=httpRequest(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{Host:'studio.test',Origin:'https://studio.test',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text),cookie:res.headers['set-cookie']?.[0]?.split(';')[0]}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
  try{
    const adminLogin=await request('login',{body:{identifier:'Arvie',password:env.ARVIE_PASSWORD}});assert.equal(adminLogin.status,200);assert.equal(adminLogin.body.account.role,'admin');
    const created=await request('accounts',{cookie:adminLogin.cookie,body:{name:'New Member',email:'new.member@example.com',role:'member',password:'new-member-pass-123'}});assert.equal(created.status,201);assert.equal(created.body.role,'member');
    const memberLogin=await request('login',{body:{identifier:'new.member@example.com',password:'new-member-pass-123'}});assert.equal(memberLogin.status,200);assert.equal((await request('accounts',{cookie:memberLogin.cookie})).status,403);assert.equal((await request('bootstrap',{cookie:memberLogin.cookie})).body.permissions.admin,false);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
