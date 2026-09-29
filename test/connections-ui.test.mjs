import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Connections shows the active video provider instead of a retired worker',()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/heygen=connection\.videoProvider==='heygen'/);
  assert.match(source,/videoName=heygen\?'HeyGen'/);
  assert.match(source,/videoOnline=heygen\?connection\.heygen/);
});

test('article intake loads a client dropdown and requires every video destination before scripts',()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/id="client-profile" name="clientKey" required/);
  assert.match(source,/name="homepage" type="url" required/);
  assert.match(source,/name="pageUrl" type="url" required/);
  assert.match(source,/name="folderUrl" type="url" required/);
  assert.match(source,/state\.profiles=await api\('client-profiles'\)/);
  assert.doesNotMatch(source,/id="load-profiles"/);
});

test('script and video approvals use optional notes without review checkboxes',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const video=readFileSync(new URL('../public/video-ui.js',import.meta.url),'utf8');
  assert.match(app,/optional for approval/);
  assert.doesNotMatch(app,/checkedEvidence|checkedWarnings/);
  assert.match(video,/optional for approval/);
  assert.doesNotMatch(video,/checkedVideo|checkedCaptions|checkedContacts|checkedFraming|checkedNoNap|checkedEndCard/);
});
