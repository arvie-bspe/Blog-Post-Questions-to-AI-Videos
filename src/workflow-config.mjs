import {createHash} from 'node:crypto';

export const workflowVersion='3.0.15';
export const scriptPolicyVersion='independent-source-review-1';
export const scriptPolicyHash=createHash('sha256').update(scriptPolicyVersion).digest('hex');
export const aiProvider=env=>env.AI_PROVIDER||'codex_worker';
// Keep legacy installations on their existing provider until a self-hosted
// worker is explicitly enabled. Self-hosted workers never fall back to a paid
// provider implicitly.
export const videoProvider=env=>env.VIDEO_PROVIDER||'heygen';
export const workerVideoProviders=new Set(['local_worker','liteavatar_worker']);
export const isWorkerVideoProvider=provider=>workerVideoProviders.has(provider);
export const ttsProvider=env=>env.TTS_PROVIDER||'local_kokoro';
export const directMode='direct_google';
export const scriptTargetSeconds=job=>job?.scriptTargetSeconds===60?60:30;

export function workerConfigured(env=process.env){return Boolean(env.STUDIO_WORKER_TOKEN&&env.STUDIO_WORKER_TOKEN.length>=24);}
export function directSetupIssues(row,client){
  const issues=[];
  if(!row?.folderId)issues.push('Add a Google Drive Visual folder before video generation.');
  if(!row?.pageUrl)issues.push('Add the published article page URL before video generation.');
  if(!client?.homepage)issues.push('Add the firm homepage before video generation.');
  return issues;
}
