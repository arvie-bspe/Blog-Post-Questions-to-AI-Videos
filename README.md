# Article Video Studio — Portrait review workflow

Open the [Railway app](https://ai-video-builder-test-production.up.railway.app). The step-by-step credit/key guide is in `../outputs/railway-deployment/API-CREDITS-AND-CONNECTIONS.md`.

## Workflow

1. Open **All articles** and select a saved article, or start from a monthly worksheet row. Google reads the live source. OpenAI can generate the draft when connected; Codex can prepare it manually for the current test.
2. Open **Script review** → **Scripts & approval**. The app automatically chooses a generic HeyGen Studio Avatar and an English voice from the Codex-selected pool. Explicit lawyer-blurb information governs presenter gender; names and photos are never used to infer it. Selection varies across new videos where the eligible pool permits, and is saved for retries.
3. Keziah reviews each script and its evidence on its own card. **Approve this script & create video** queues only that question; the others stay pending. Each card also has **Request changes to this script**. Editing or rejecting one question preserves unchanged sibling approvals. The default allowance remains $2 estimated per new video and two new submissions per UTC day.
4. HeyGen receives the exact approved script and generates the speaking presenter with synchronized narration in one Avatar IV request. No separate presenter image or Photo Avatar is used.
5. Before paid generation, the app retrieves the official firm logo from homepage HTML, caches it by domain, rasterises SVGs with Playwright Chromium, and screens for embedded contact details. HeyGen preserves the source scene using `auto` and `contain`; Railway makes a face-aware 1080 × 1920 cover crop. The upper-right logo uses 35% width where the face permits, with larger natural-case captions in white on opaque black. The three-second white end card includes the same logo plus name, address and phone evidenced in the article, and the article URL from monthly column E. Directory contact details are not substituted.
6. Macy requests changes or approves. Explicit caption/logo controls reassemble the existing media without a new HeyGen call. A voice/motion replacement requires accepting the displayed new generation cost. Script wording changes return to Keziah. Free-text revisions wait for Codex/Arvie when OpenAI is absent.
7. The result appears under **Video review**. Macy's **Approve & save to Visual folder** uploads the approved MP4, thumbnail and captions. Failed uploads retain reserved Drive file IDs for reconciliation. Google OAuth was connected and live source reads verified September 16.

The future row trigger is **Kristian's Social Poster handoff**; connecting and testing it is pending. Current article processing starts by selecting a live worksheet and row. Eligible inspection starts analysis if OpenAI is connected, otherwise it saves a source record awaiting a manual draft. ClickUp checks and YouTube publishing are deferred. Logos are enabled; custom brand colors remain deferred.

## Connection and budget

Add `HEYGEN_API_KEY` privately in Railway → **ai-video-builder-test** → **Variables**, then deploy the variable change. Locally use the ignored `.env` file and restart. Keep keys out of chat and source control.

This integration uses a pay-as-you-go API wallet. HeyGen Creator is not required and does not supply these API credits. No separate Descript, fal.ai, or voice subscription is required.

Avatar IV at 720p/1080p, checked September 15, 2026:

| 30-second Studio Avatar videos | Estimated HeyGen cost |
| --- | ---: |
| 1 | $2 |
| 10 | $20 |
| 30 | $60 |
| 100 | $200 |
| 300 | $600 |

Actual duration determines billing. Repeat renders and taxes may add cost. Minimum wallet purchase and this account's entitlements remain unverified. Do not use the earlier 600-credit subscription comparison for current self-service API purchases.

Railway is a separate bill: Hobby starts at $5/month including $5 of resource usage, with usage above that extra. Rendering, storage, and transfers affect the total. App sign-ins are separate from Railway infrastructure workspace membership.

Automatic question analysis, drafting, and source auditing need separate OpenAI API usage when enabled. Reviewed/manual scripts work without that key. Google storage capacity may also need expansion as videos accumulate.

Sources: [HeyGen pricing](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained), [public library](https://developers.heygen.com/reference/list-avatar-looks), [create video](https://developers.heygen.com/reference/create-video), [Railway plans](https://docs.railway.com/pricing/plans).

## Preserved data and recovery

New generation exclusively uses HeyGen. Old fal.ai setups and files remain readable as history and cannot start new fal jobs. The old key is unused and was not deleted or transferred to HeyGen.

Rulebook 1.4.2 contains the two source documents (36 content and 100 appearance sections), per-question approval and mandatory matching avatar/voice gender. Metadata comes from HeyGen's catalog; unverified or mismatched pairs are held before spending, review and delivery. The standalone layout document remains retired. Prior article-wide decisions stay in history and never become individual approvals. This appearance-only update preserves existing individual script decisions without replaying generation.

The bundled, MIT-licensed OpenCV YuNet model replaces the Haar detector that mistook folds in Brandon's jacket for faces. Every frame is still checked, including rejection of a second face in a single frame. The model checksum is checked locally; there are no runtime model downloads. Tests cover both actual false-positive frames and a two-person fixture. Crop constraints still protect the complete head and upper torso; Macy reviews the final video.

After individual approval, the app first looks for compatible previously purchased footage with the exact script and article hash. It can rebuild the current layout and framing checks for free, including reuse of an earlier matching-gender recording. Existing mismatched or uncertain paid requests never authorize another paid replacement. Older outputs remain in history. Empty duplicate inspections remain linked without deletion.

- Approximately 30 seconds is preferred. Scripts above 75 spoken words need a specific accuracy/context reason and review. Estimated cost uses word count at 2.2 words/second, with a 30-second minimum estimate; actual provider duration determines billing. Outputs above 30.25 seconds carry a runtime review flag; outputs above the service processing allowance of 180 seconds are held with the original preserved. No approved words are cut or automatic replacement purchased.
- Provider SRT cue times are retained exactly and wrapped into at most two measured lines. A cue that cannot fit is held for corrected audio-derived timing; the app does not invent subdivisions from word counts. Missing or changed words and invalid timing stop assembly.
- FFmpeg preserves the complete speech and adds a hard cut to the three-second silent white end card. During speech, only the scene, logo, and captions appear. Missing end-card fields or detected contact details in speech/source/logo hold the output. No music or custom brand colors are added. The thumbnail comes from the main scene.
- Local OpenCV face checks and OCR screen the source; they do not identify people or contact an external AI provider. The crop must fill the frame without padding or stretching. Technical QA records actual source crop resolution; enlarging old footage is flagged for sharpness review. Macy must review the entire output for anatomy, framing, logo cleanliness, embedded contact details, captions, audio, and the end card. Automated screening does not replace that review.
- Identical setups return the existing record. Paid calls have a stable HeyGen idempotency key and saved provider ID. **Resume saved request** polls that ID or resumes assembly without a new submission.
- Unknown submission outcomes require checking HeyGen by the saved title/setup ID before a replacement. No automatic resubmission occurs, including after the provider's idempotency retention period.
- Daily cap: 2 new HeyGen calls per UTC day by default. Failed/uncertain calls count. The automatic profile also gates each estimated charge. A saved approval queue survives restarts; scripts, settings and source are rechecked before submission. Blocked work is not rescheduled nightly. Known or uncertain paid requests are never submitted again automatically.
- Change requests create actionable revision states. OpenAI rewrites scripts from feedback when connected; while it is absent, Arvie can apply manual sentence edits or Codex can supply a full source-backed revision. Prior drafts/decisions are retained. Macy can apply explicit layout controls or authorize a new paid render. Every revised output needs a fresh approval before upload.

## Private configuration

| Variable | Purpose |
|---|---|
| `HEYGEN_API_KEY` | HeyGen API wallet, public library, and video generation. |
| `DAILY_VIDEO_LIMIT` | 1–20 new video calls per UTC day; default 2. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional drafting and independent audit; default model gpt-4.1. |
| `DAILY_ANALYSIS_LIMIT` | Default 10 analyses; each may make two model calls. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | OAuth for live Google reads. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Alternative service-account access to required sources. |
| `ARVIE_PASSWORD`, `KEZIAH_PASSWORD`, `MACY_PASSWORD` | Three distinct passwords of at least 16 characters for public hosting. |
| `APP_ORIGIN` | Exact hosted HTTPS URL; local default http://127.0.0.1:4173. |
| `HOST`, `PORT`, `DATA_DIR` | Railway uses 0.0.0.0, the configured port, and /data on its existing volume. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Optional local binary paths; Docker installs FFmpeg, fonts, and Chromium; Playwright is pinned in package.json. |
| `VISUAL_PYTHON_PATH` | Optional local Python path for OpenCV and RapidOCR. Docker installs and smoke-tests the runtime at /opt/visual/bin/python. |

Google OAuth requests Sheets and Docs read-only scopes plus Drive access for the existing Visual folders. The app's Connect Google flow uses state and PKCE, keeps its refresh credential on the private volume, and checks the required scopes. Use a dedicated test account if you want access limited to files shared to that account. No sharing changes or deletions are made. Article J and Visual L are checked by headers. Client matching, order eligibility, question and evidence rules remain enforced. Live jobs recheck source/client/row; snapshot jobs retain capture date and hash.

## Development and deployment

Use Node 24 and `npm start`, or `node --env-file-if-exists=.env src/server.mjs`. Local reviewer names are test identities. Hosted users sign in individually. Private source fixtures are excluded from deployment.

Deploy this folder with Dockerfile and railway.json. Preserve one replica and the existing /data volume for SQLite/media. The initial importer checks its fingerprint and never overwrites a database. GitHub is optional; this project uses Railway's official upload API with privately stored authorized credentials.

Run `npm test`. Tests cover content, source identity, automatic selection, review permissions, persistence, provider boundaries, captions, spending controls, and real FFmpeg assembly. September 16 layout verification also recomposed existing corrected HeyGen footage locally without a paid generation call. New presenter/voice combinations still need Macy's full output review. OpenAI remains unconnected, so automatic initial drafts and free-text script rewrites remain pending; the revised test drafts were prepared by Codex.
