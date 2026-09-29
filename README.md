# Article Video Studio

Article Video Studio turns questions from a pasted Google Doc into individually reviewed portrait videos. Railway hosts the team interface and durable workflow. A private local worker uses Codex CLI to write source-grounded scripts. HeyGen supplies the approved presenter and voiceover, Railway assembles the reviewed portrait output, and Macy's approval delivers it to Google Drive.

Production app: [Article Video Studio](https://article-video-studio-production.up.railway.app)

## Current workflow

**Google Doc → Codex CLI writes the script → Keziah approves → HeyGen creates the video presenter and voiceover → Railway assembles the video → Macy reviews → Google Drive**

1. In **Articles**, choose the client profile from the automatically loaded dropdown and enter the Google Doc URL, firm homepage, published article URL, and Google Drive Visual folder. If the document contains multiple tabs, choose the article tab explicitly.
2. Railway validates the destination details before it retrieves, fingerprints, or sends the selected tab for script generation. The Monthly Sheet is not read by this workflow.
3. Codex CLI independently reviews the article, selects useful explicit questions or formulates source-supported questions, drafts approximately 30-second scripts, and attaches exact article evidence to every answer sentence.
4. Keziah reviews each script separately. Approval needs no note or checklist. **Request changes** requires a note and queues an AI rewrite for that question only. Sibling scripts and approvals stay unchanged.
5. Approving one script queues only that video's HeyGen request. The app first requires explicit male, female, or mixed pronoun evidence from the source lawyer blurb, then selects an approved Studio Avatar and matching English voice. An inconclusive or missing lawyer blurb holds generation before any provider request. Every new paid render uses both a different avatar person and a different voice from the latest paid render; pending jobs reserve their choices and automatic selection then favors the globally least recently used compatible choices. If either compatible alternative is unavailable, submission is held. HeyGen supplies the speech, lip-sync, source footage, and caption timing. A paid replacement is never submitted without the saved review and cost authorization.
6. Railway creates the 1080 × 1920 output with synchronized captions, the homepage logo on an automatically selected contrasting background, thumbnail, and a separate three-second contact end card.
7. Macy reviews each finished video separately, including professional suit/blazer clothing and a natural voice that suits the presenter's persona. Approval needs no note or checklist; requesting a change requires a note. New renders use visually reviewed business attire and explicitly compatible voice pairings; casual shirts, T-shirts and polos are excluded. A layout change reuses existing media; a wording change returns to Keziah; a presenter, voice, or lip-sync change queues a new render with a newly rotated avatar and voice.
8. Macy's approval automatically uploads the MP4, thumbnail, and VTT captions to the job's Google Drive Visual folder.

A completed video remains available for Macy's review when its saved approval hash, exact spoken script, and source hash still match the current approved question, even if a later validator would reject that historical wording. This compatibility applies only to finished media; every new script approval and provider submission still passes the current validation rules.

If HeyGen records a terminal failure before returning any media, an admin may authorize one new replacement up to an explicit cost ceiling. The failed request stays in history, the replacement uses a newly rotated professional presenter and voice, and the article's normal automatic cost limit remains unchanged. Pending or uncertain requests block this action so the recovery cannot create a duplicate submission.

Historical direct Google Doc jobs are also identified by their saved workflow mode and direct-script shape when applying script checks. They therefore use the active source-grounded direct review policy even when an older saved document lacks the newer `questionSelectionMode` marker.

The former **Video Content and Script Rules** do not run in the new direct-document path. Historical jobs keep their original policy references for audit history. The active appearance and quality rules still govern the video output.

## Components

| Component | Location | Purpose |
| --- | --- | --- |
| Node web app | Railway | Sign-in, Google Doc retrieval, reviews, job state, assembly, and Drive delivery. |
| SQLite queue | Existing Railway volume | Durable task leases, results, review history, and media records. Keep one Railway replica. |
| Codex worker | Arvie's signed-in Windows account | Script author using the saved local Codex login. It opens no inbound port. |
| HeyGen API | External provider | Approved Studio Avatar, matching voice, speech, lip-sync, source footage, and caption timing. |

`VIDEO_PROVIDER=heygen` is explicit in production. Historical LiteAvatar, local-worker, and older HeyGen records remain readable for audit history, but they are never silently reused for a new paid submission.

## Railway configuration

Copy the settings from [.env.example](.env.example) into Railway Variables, using private values:

- `AI_PROVIDER=codex_worker`
- `VIDEO_PROVIDER=heygen`
- `HEYGEN_API_KEY` stored only as a private Railway variable
- `DAILY_VIDEO_LIMIT` set to the approved maximum number of new provider submissions per UTC day
- `STUDIO_WORKER_TOKEN` with a random value of at least 24 characters
- the existing Google OAuth values and three team passwords
- `ARVIE_EMAIL`, `KEZIAH_EMAIL`, and `MACY_EMAIL` for the existing team accounts
- `APP_ORIGIN=https://article-video-studio-production.up.railway.app`
- `HOST=0.0.0.0` and `DATA_DIR=/data`

Codex script analysis and script rewrites have no application-level daily cap. `DAILY_ANALYSIS_LIMIT` is no longer used and can be removed from Railway Variables. The separate `DAILY_VIDEO_LIMIT` still controls new paid HeyGen submissions.

The Google OAuth account needs access to the pasted Google Docs, the client-directory Sheet, and each selected Visual folder. The studio loads client profiles automatically. A new job starts script generation only after the client, firm homepage, published article URL, and Visual folder are supplied with the Google Doc URL.

## Team sign-in

Sign in with the email saved on your account and your existing password. Names remain display names for reviews and are not accepted as login identifiers. Admins can manage sign-in emails under **Accounts → Manage**.

For the initial email-only migration, set the three team email variables before deploying. Startup fills only missing emails; it keeps account IDs, passwords, roles, sessions, and review history. Later restarts do not overwrite emails edited inside the studio.

The question is narrated once before the answer. New AI drafts remove exact repeated opening headings before review; validation blocks any remaining repetition from approval or rendering. Existing saved scripts are not silently rewritten: use **Request changes** on a flagged script and approve the corrected wording.

Scripts default to approximately 30 seconds. An administrator can apply a 60-second override to one direct-document article without changing other jobs. The override requires 135–165 source-grounded spoken words, invalidates earlier script approvals for that article, and still requires Keziah to review each revised script. It does not increase the authorized HeyGen spending allowance.

## Private worker

The worker uses outbound HTTPS only. Copy [worker/worker.env.example](worker/worker.env.example) to `.env.worker`, set the same `STUDIO_WORKER_TOKEN` used by Railway, and run:

```powershell
npm install
npm run worker
```

Run it under the Windows account already signed into Codex. The Codex invocation is ephemeral, ignores repository/user rules and plugins, uses a read-only sandbox, receives the source as untrusted data, and must return the shared JSON schema. If the computer is asleep, offline, or signed out, Railway retains queued work until the worker returns.

Keep the Windows worker on `STUDIO_WORKER_TYPES=ai_codex`. Codex reasoning remains local during development; video generation uses HeyGen and does not require a local or Railway media worker.

## Retired self-hosted media path

Production no longer uses Kokoro, LiteAvatar, or SadTalker. Their implementation and historical records remain in the repository so existing audit history stays readable, but the media worker service should remain stopped and must not be configured for current jobs. Do not set `VIDEO_PROVIDER=liteavatar_worker`, `VIDEO_PROVIDER=local_worker`, or `TTS_PROVIDER=local_kokoro` for the current production workflow.

## Development

Use Node 24 or later:

```powershell
npm install
npm start
npm test
```

Docker installs FFmpeg, Chromium, OpenCV, and RapidOCR for Railway assembly. The repository contains the approved fictional presenter image. Private source fixtures, local worker credentials, generated media, database files, and model checkpoints are excluded from Git.

The active web app uses `Dockerfile` and `railway.json`. `Dockerfile.liteavatar` and `railway.liteavatar.json` are retained only for historical recovery and are not part of the current production deployment. Preserve the existing web app `/data` volume during deployments so prior jobs, reviews, media, OAuth state, and Drive reconciliation records remain intact.
