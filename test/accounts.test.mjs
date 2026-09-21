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

const env={HOST:'0.0.0.0',APP_ORIGIN:'https://studio.test',ARVIE_EMAIL:'arvie@example.com',KEZIAH_EMAIL:'keziah@example.com',MACY_EMAIL:'macy@example.com',ARVIE_PASSWORD:'arvie-long-test-password',KEZIAH_PASSWORD:'keziah-long-test-password',MACY_PASSWORD:'macy-long-test-password'};

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
    const accounts=new AccountStore(db,env),admin=accounts.authenticate(env.ARVIE_EMAIL,env.ARVIE_PASSWORD),token=accounts.createSession(admin.id);
    assert.equal(accounts.session(token).role,'admin');accounts.resetPassword(admin.id,'replacement-pass-456',admin.id);assert.equal(accounts.session(token),null);assert.equal(accounts.authenticate(env.ARVIE_EMAIL,'replacement-pass-456').id,admin.id);
    assert.throws(()=>accounts.setRole(admin.id,'member',admin.id),/At least one/);
  }finally{db.close();}
});

test('security sessions expose roles while member accounts cannot satisfy admin checks',()=>{
  const db=new DatabaseSync(':memory:'),security=createSecurity(env,db);try{
    const token=security.login(env.KEZIAH_EMAIL,env.KEZIAH_PASSWORD,'test'),req={headers:{cookie:'studio_session='+token}};
    assert.equal(security.account(req).role,'member');assert.throws(()=>security.requireAdmin(req),/admin/);
    const adminToken=security.login(env.ARVIE_EMAIL,env.ARVIE_PASSWORD,'admin-test');assert.equal(security.requireAdmin({headers:{cookie:'studio_session='+adminToken}}).role,'admin');
  }finally{db.close();}
});

test('admin account APIs create a login while members cannot list the directory',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-accounts-')),app=createApp({...env,PORT:'4194',DATA_DIR:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const request=(path,{body,cookie}={})=>new Promise((resolve,reject)=>{const req=httpRequest(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{Host:'studio.test',Origin:'https://studio.test',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text),cookie:res.headers['set-cookie']?.[0]?.split(';')[0]}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
  try{
    for(const body of [{email:'Arvie'},{identifier:'Arvie'},{role:'Arvie'}]){const denied=await request('login',{body:{...body,password:env.ARVIE_PASSWORD}});assert.equal(denied.status,401);assert.equal(denied.body.error,'Email or password is incorrect.');}
    const adminLogin=await request('login',{body:{email:env.ARVIE_EMAIL,password:env.ARVIE_PASSWORD}});assert.equal(adminLogin.status,200);assert.equal(adminLogin.body.account.role,'admin');
    const created=await request('accounts',{cookie:adminLogin.cookie,body:{name:'New Member',email:'new.member@example.com',role:'member',password:'new-member-pass-123'}});assert.equal(created.status,201);assert.equal(created.body.role,'member');
    const memberLogin=await request('login',{body:{email:'new.member@example.com',password:'new-member-pass-123'}});assert.equal(memberLogin.status,200);assert.equal((await request('accounts',{cookie:memberLogin.cookie})).status,403);assert.equal((await request('bootstrap',{cookie:memberLogin.cookie})).body.permissions.admin,false);
    assert.equal((await request(`accounts/${created.body.id}/email`,{cookie:memberLogin.cookie,body:{email:'unauthorized@example.com'}})).status,403);
    assert.equal((await request(`accounts/${created.body.id}/email`,{cookie:adminLogin.cookie,body:{email:'updated@example.com'}})).status,200);
    assert.equal((await request('login',{body:{email:'new.member@example.com',password:'new-member-pass-123'}})).status,401);
    assert.equal((await request('login',{body:{email:' UPDATED@EXAMPLE.COM ',password:'new-member-pass-123'}})).status,200);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('email-only authentication rejects names and aliases, normalizes email, and checks passwords',()=>{
  const db=new DatabaseSync(':memory:');try{
    const accounts=new AccountStore(db,env),admin=accounts.find('Arvie');
    assert.equal(accounts.authenticate(' ARVIE@EXAMPLE.COM ',env.ARVIE_PASSWORD).id,admin.id);
    for(const input of ['Arvie','arvie','admin','',null])assert.equal(accounts.authenticate(input,env.ARVIE_PASSWORD),null);
    assert.equal(accounts.authenticate(env.ARVIE_EMAIL,'wrong-password'),null);
    const member=accounts.create({name:'Alias User',email:'real@example.com',password:'another-password-123'},admin.id);
    db.prepare('UPDATE accounts SET login=?,name=? WHERE id=?').run('alias@example.com','name@example.com',member.id);
    assert.equal(accounts.authenticate('alias@example.com','another-password-123'),null);
    assert.equal(accounts.authenticate('name@example.com','another-password-123'),null);
    assert.equal(accounts.authenticate('real@example.com','another-password-123').id,member.id);
  }finally{db.close();}
});

test('existing name accounts gain emails without replacing passwords, roles, sessions or IDs',()=>{
  const db=new DatabaseSync(':memory:');try{
    const legacyEnv={...env,ARVIE_EMAIL:'',KEZIAH_EMAIL:'',MACY_EMAIL:''},legacy=new AccountStore(db,legacyEnv),arvie=legacy.find('Arvie'),keziah=legacy.find('Keziah');
    legacy.setRole(keziah.id,'admin',arvie.id);legacy.resetPassword(arvie.id,'already-changed-password',arvie.id);
    const token=legacy.createSession(arvie.id),before=legacy.row(arvie.id);
    const migrated=new AccountStore(db,env);
    assert.equal(migrated.count(),3);assert.equal(migrated.authenticate(env.ARVIE_EMAIL,'already-changed-password').id,arvie.id);
    assert.equal(migrated.authenticate(env.ARVIE_EMAIL,env.ARVIE_PASSWORD),null);
    assert.equal(migrated.get(keziah.id).role,'admin');assert.equal(migrated.session(token).id,arvie.id);
    for(const field of ['password_hash','password_salt','session_version','created_at'])assert.equal(migrated.row(arvie.id)[field],before[field]);
    migrated.setEmail(arvie.id,'new.address@example.com',arvie.id);new AccountStore(db,env);
    assert.equal(migrated.authenticate('new.address@example.com','already-changed-password').id,arvie.id);
    assert.equal(migrated.authenticate(env.ARVIE_EMAIL,'already-changed-password'),null);
  }finally{db.close();}
});

test('email updates reject invalid or duplicate addresses without changing the account',()=>{
  const db=new DatabaseSync(':memory:');try{
    const accounts=new AccountStore(db,env),admin=accounts.find('Arvie'),before=accounts.get(admin.id);
    for(const email of ['', 'Arvie', 'missing@domain', ' KEZIAH@EXAMPLE.COM '])assert.throws(()=>accounts.setEmail(admin.id,email,admin.id),/valid email|already belongs/);
    assert.deepEqual(accounts.get(admin.id),before);
    const missing={...env,ARVIE_EMAIL:''};db.prepare('UPDATE accounts SET email=NULL,login=? WHERE id=?').run('arvie',admin.id);
    new AccountStore(db,missing);assert.equal(accounts.authenticate('Arvie',env.ARVIE_PASSWORD),null);
    assert.throws(()=>new AccountStore(db,{...env,ARVIE_EMAIL:env.KEZIAH_EMAIL}),/already belongs/);
    assert.equal(accounts.get(admin.id).email,'');
  }finally{db.close();}
});
