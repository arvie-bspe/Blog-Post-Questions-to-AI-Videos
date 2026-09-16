import {existsSync,readFileSync,copyFileSync,mkdirSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// One-time migration into a new Railway volume. An existing database always wins.
export function initializeDatabase(env,dataDir){
  mkdirSync(dataDir,{recursive:true});const target=join(dataDir,'studio.sqlite');
  if(existsSync(target)||!env.INITIAL_DB_SHA256)return false;
  const source=env.BOOTSTRAP_DB_PATH?resolve(env.BOOTSTRAP_DB_PATH):fileURLToPath(new URL('../bootstrap/initial-studio.sqlite',import.meta.url));
  const expected=env.INITIAL_DB_SHA256;
  if(!/^[a-f0-9]{64}$/.test(expected))throw new Error('The initial review database fingerprint is invalid.');
  const actual=createHash('sha256').update(readFileSync(source)).digest('hex');
  if(actual!==expected)throw new Error('The initial review database did not match its expected fingerprint.');
  copyFileSync(source,target,constants.COPYFILE_EXCL);return true;
}
