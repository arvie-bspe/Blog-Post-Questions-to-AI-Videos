import {createHash} from 'node:crypto';

export const workflowVersion='2.0.0';
export const scriptPolicyVersion='independent-source-review-1';
export const scriptPolicyHash=createHash('sha256').update(scriptPolicyVersion).digest('hex');
export const aiProvider=env=>env.AI_PROVIDER||'codex_worker';
// Keep legacy installations on their existing provider until the new local
// worker is explicitly enabled. The rebuilt Railway deployment sets this to
// local_worker; there is never an implicit paid-provider fallback.
export const videoProvider=env=>env.VIDEO_PROVIDER||'heygen';
export const ttsProvider=env=>env.TTS_PROVIDER||'local_kokoro';
export const directMode='direct_google';

export function workerConfigured(env=process.env){return Boolean(env.STUDIO_WORKER_TOKEN&&env.STUDIO_WORKER_TOKEN.length>=24);}
export function directSetupIssues(row,client){
  const issues=[];
  if(!row?.folderId)issues.push('Add a Google Drive Visual folder before video generation.');
  if(!row?.pageUrl)issues.push('Add the published article page URL before video generation.');
  if(!client?.homepage)issues.push('Add the firm homepage before video generation.');
  return issues;
}
