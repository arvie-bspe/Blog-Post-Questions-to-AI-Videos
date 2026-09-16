import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {initializeDatabase} from '../src/bootstrap.mjs';
test('initial review migration verifies its fingerprint and never overwrites a saved database',()=>{
  const dir=mkdtempSync(join(tmpdir(),'railway-seed-'));
  try{
    const source=join(dir,'initial.sqlite'),destination=join(dir,'volume');writeFileSync(source,'reviewed fixture');
    const env={BOOTSTRAP_DB_PATH:source,INITIAL_DB_SHA256:createHash('sha256').update('reviewed fixture').digest('hex')};
    assert.throws(()=>initializeDatabase({...env,INITIAL_DB_SHA256:'0'.repeat(64)},destination),/fingerprint/);
    assert.equal(initializeDatabase(env,destination),true);assert.equal(readFileSync(join(destination,'studio.sqlite'),'utf8'),'reviewed fixture');
    writeFileSync(source,'changed source');assert.equal(initializeDatabase(env,destination),false);assert.equal(readFileSync(join(destination,'studio.sqlite'),'utf8'),'reviewed fixture');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
