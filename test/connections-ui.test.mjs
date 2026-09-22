import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Connections shows the active video provider instead of a retired worker',()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/heygen=connection\.videoProvider==='heygen'/);
  assert.match(source,/videoName=heygen\?'HeyGen'/);
  assert.match(source,/videoOnline=heygen\?connection\.heygen/);
});
