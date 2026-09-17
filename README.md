# Article Video Studio

Article Video Studio turns questions from a pasted Google Doc into individually reviewed portrait videos. Railway hosts the team interface and durable workflow. A private local worker temporarily uses Codex CLI for article reasoning and can run the local voice/video models. Claude can later replace Codex without changing document retrieval, reviews, rendering, or Drive delivery.

Production app: [Article Video Studio](https://article-video-studio-production.up.railway.app)

## Current workflow

1. Paste a Google Doc URL into **Articles**. If the document contains multiple tabs, choose the article tab explicitly.
2. Railway retrieves and fingerprints that tab. The Monthly Sheet is not read by this workflow.
3. The configured AI resolver independently reviews the article, selects useful explicit questions or formulates source-supported questions, drafts approximately 30-second scripts, and attaches exact article evidence to every answer sentence.
4. Keziah reviews each script separately. **Request changes** queues an AI rewrite for that question only. Sibling scripts and approvals stay unchanged.
5. Approving one script queues only that video's Railway CPU media task. The worker uses a reviewed LiteAvatar profile selected from explicit lawyer-blurb gender evidence, a verified same-gender Kokoro ONNX voice, LiteAvatar motion, and the speech model's measured duration timing. Video review can request a source-compatible presenter-gender replacement; the presenter and voice change together in a new CPU render.
6. Railway creates the 1080 × 1920 output with synchronized captions, the homepage logo, thumbnail, and a separate three-second contact end card.
7. Macy reviews each finished video separately. A layout change reuses existing media; a wording change returns to Keziah; a voice or lip-sync change queues a new render.
8. Macy's approval automatically uploads the MP4, thumbnail, and VTT captions to the job's Google Drive Visual folder.

The former **Video Content and Script Rules** do not run in the new direct-document path. Historical jobs keep their original policy references for audit history. The active appearance and quality rules still govern the video output.

## Components

| Component | Location | Purpose |
| --- | --- | --- |
| Node web app | Railway | Sign-in, Google Doc retrieval, reviews, job state, assembly, and Drive delivery. |
| SQLite queue | Existing Railway volume | Durable task leases, results, review history, and media records. Keep one Railway replica. |
| Codex worker | Arvie's signed-in Windows account | Temporary AI resolver using the saved local Codex login. It opens no inbound port. |
| LiteAvatar media worker | Separate Railway CPU service | Kokoro ONNX narration, LiteAvatar animation, and audio-derived timing. |
| Claude adapter | Railway, disabled until configured | Later replacement for reasoning only. |

There is no automatic fallback to HeyGen or another paid video API. Historical HeyGen records remain available and the legacy provider code remains isolated for those records.

## Railway configuration

Copy the settings from [.env.example](.env.example) into Railway Variables, using private values:

- `AI_PROVIDER=codex_worker`
- `VIDEO_PROVIDER=liteavatar_worker`
- `TTS_PROVIDER=local_kokoro`
- `STUDIO_WORKER_TOKEN` with a random value of at least 24 characters
- the existing Google OAuth values and three team passwords
- `APP_ORIGIN=https://article-video-studio-production.up.railway.app`
- `HOST=0.0.0.0` and `DATA_DIR=/data`

The Google OAuth account needs access to the pasted Google Docs and each selected Visual folder. New jobs can begin with only the Doc URL; the firm homepage, published article URL, and Visual folder must be added before video generation.

## Private worker

The worker uses outbound HTTPS only. Copy [worker/worker.env.example](worker/worker.env.example) to `.env.worker`, set the same `STUDIO_WORKER_TOKEN` used by Railway, and run:

```powershell
npm install
npm run worker
```

Run it under the Windows account already signed into Codex. The Codex invocation is ephemeral, ignores repository/user rules and plugins, uses a read-only sandbox, receives the source as untrusted data, and must return the shared JSON schema. If the computer is asleep, offline, or signed out, Railway retains queued work until the worker returns.

Keep the Windows worker on `STUDIO_WORKER_TYPES=ai_codex` after the current SadTalker test task has finished. Codex reasoning remains local during development; talking-video rendering moves to the Railway service described below.

## Railway LiteAvatar CPU trial

Add a second service from this repository and set its Dockerfile path to `Dockerfile.liteavatar`. Give it only:

- `STUDIO_URL=https://article-video-studio-production.up.railway.app`
- the same private `STUDIO_WORKER_TOKEN` as the web app
- `STUDIO_WORKER_TYPES=media_liteavatar`

The image pins LiteAvatar source and every downloaded model/profile asset by SHA-256. It bundles the CPU-compatible Kokoro FP32 model, one male profile, and one female profile. The service has no public domain and polls the existing durable task queue over outbound HTTPS. The profiles are marked `evaluation_only`; Macy can test their quality, but Drive delivery remains blocked until commercial-use rights are documented and `LITEAVATAR_ASSET_RIGHTS_CONFIRMED=true` is set on the web app.

For a one-time end-to-end container check, set `LITEAVATAR_STARTUP_SMOKE=1`, deploy, wait for `LiteAvatar CPU startup smoke render passed.` in the service logs, then save the variable as `0` without redeploying the running worker.

LiteAvatar is CPU-only, but its 880 MB speech-feature model plus PyTorch require substantially more than a 1 GB container during rendering. Set a 30-minute render timeout and start with at least 4 GB RAM. Railway bills CPU and memory usage even though there is no per-video provider fee. Keep one worker replica and one render at a time for the trial.

## Switching to Claude

Add `ANTHROPIC_API_KEY` and an account-supported `CLAUDE_MODEL` in Railway, run a comparison job, then explicitly set:

```text
AI_PROVIDER=claude
```

Both providers use the same structured input and output contract. In-flight tasks keep their original provider. The Railway LiteAvatar worker remains independent of the reasoning provider, so switching to Claude does not change video generation.

## Development

Use Node 24 or later:

```powershell
npm install
npm start
npm test
```

Docker installs FFmpeg, Chromium, OpenCV, and RapidOCR for Railway assembly. The repository contains the approved fictional presenter image. Private source fixtures, local worker credentials, generated media, database files, and model checkpoints are excluded from Git.

The web app uses `Dockerfile` and `railway.json`; the CPU worker uses `Dockerfile.liteavatar` and `railway.liteavatar.json`. Preserve the existing web app `/data` volume during deployments so prior jobs, reviews, media, OAuth state, and Drive reconciliation records remain intact.
