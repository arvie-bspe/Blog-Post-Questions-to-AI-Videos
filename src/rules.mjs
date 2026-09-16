import {readFileSync} from 'node:fs';
import {hash,normalize} from './domain.mjs';
export const rules=readFileSync(new URL('../rules/GLOBAL_RULES.md',import.meta.url),'utf8');
export const config=JSON.parse(readFileSync(new URL('../rules/global-rules.json',import.meta.url),'utf8'));
export const rulesHash=hash(rules);
if(rulesHash!==config.rules.sha256)throw new Error('Global rules checksum changed. Reconcile the configuration before running.');
const section=(start,end)=>rules.slice(rules.indexOf(start),rules.indexOf(end));
export const globalContent=section('### C01','### C32')+section('### C33','## Complete video appearance');
export function clientRules(key){
  const scope=section('### C32','### C33');
  const names=['Davies','John','Dan','Alia','Ticket Crushers','Gibson and Singleton','Russell Chicago'];
  const i=names.findIndex(n=>normalize(n)===normalize(key));
  if(i<0)return '';
  const marker=`#### C32.${i+1}`;
  const start=scope.indexOf(marker),end=scope.indexOf(`#### C32.${i+2}`);
  return start<0?'':scope.slice(start,end<0?undefined:end);
}
