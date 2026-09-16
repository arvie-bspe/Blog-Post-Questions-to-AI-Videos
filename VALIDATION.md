# Validation record

## HeyGen migration — 15 September 2026

38 tests passed, 0 failed, 0 skipped. New checks cover public-library paging and Avatar IV compatibility, fixed API-host authentication, safe asset downloads, stable idempotency keys, no fallback to fal, approved script binding, subtitle word/timing validation, role and cost consent, daily caps, uncertain submission recovery, and preserving overlong originals. A simulated HeyGen job completed real FFmpeg assembly and stopped for initial video review. Its test tone and solid-color footage are technical fixtures, not evidence of speech or lip-sync quality.

The missing-key interface was inspected in an isolated browser preview. It shows HeyGen pricing, library presenter and English voice controls, preserved legacy records, and disabled generation setup until a library selection is available. JavaScript syntax checks passed.

Railway deployment `2a1c0177-7a71-475e-8bb6-f34e223e911a` reached SUCCESS. Health, FFmpeg availability, all three team logins, unauthenticated API rejection, and exact hosted JavaScript/source equality were verified. The Paul record remains at revision 7 with its approved two scripts, review decisions, history, status, and rules hash unchanged; two old fal.ai setups remain readable as history.

No paid API request was made. HEYGEN_API_KEY is absent; the user will add it after reviewing costs. Live library availability, account entitlements, provider billing, actual voices, lip-sync quality, and actual subtitle output still require the first paid acceptance test. Drive delivery and Social Poster handoff remain unimplemented. See `outputs/railway-deployment/heygen-migration-verification.json` for safe hosted verification results.

## Earlier validation — 14 September 2026

`node --test test/*.test.mjs` — **28 passed, 0 failed, 0 skipped**.

Tests cover mapping, eligible orders, rich links, title exclusion, nested document structure, citations, client scoping, forbidden/conditional wording, limits, duplicate records, SQLite restart recovery, daily request caps, public-hosting guards, API refusal/incomplete responses, pilot review permissions, failed semantic-audit blocking, and JSON export. API responses were simulated; no paid calls were made.

| Browser check | Result |
|---|---|
| Paul source inspection | 16 eligible headings; title/H1 and statement headings excluded. |
| Prepared scripts | Two drafts, exact evidence, explicit Michigan context, no logo/color dependency. |
| Evidence disclosure | Claim and exact source paragraph visible. |
| Restart persistence | Existing record reopened after stopping/restarting the server. |
| Missing source confirmation | Review blocked; no approval saved. |
| Notes after validation error | Preserved after the UI fix. |
| Macy script approval | Disabled, as intended for the role. |
| Download | Markdown script/evidence download event received. JSON export covered by HTTP test. |
| Browser console | No warning/error entries reported in the inspected session. |
| Desktop layout | Inspected visually. |
| Mobile layout | Not verified; the viewport override did not change the reported width and was reset afterward. |
| ClickUp task page | Redirected to sign-in. Task details remain unverified. |

Arvie subsequently recorded an actual pilot review on the current Paul record (`b1086be5-176a-48fa-869c-d5ac4bced44b`) with the note “everything is good.” That existing review unlocks the video stage. No voice or video acceptance is recorded yet.

Live Google credentials, live OpenAI generation, ClickUp API mapping/status, live fal speech/alignment/lip sync, video QA, Drive delivery, and automatic trigger processing still require tests. Railway deployment and team authentication checks are recorded below.

Latest workflow check: ClickUp verification requests return a deferred response without contacting ClickUp. Missing or malformed ClickUp sheet cells do not block manual source inspection. ClickUp integration remains deferred under Arvie's latest instruction.


## Video implementation checks

- Real local FFmpeg/ffprobe installed from the official FFmpeg-listed Windows source; download SHA-256 verified.
- Exact approved script and review/source/client/presenter fingerprints bound into a video setup; unsupported voices or missing presenter acceptance rejected.
- Queue submissions persisted before monitoring. Unknown outcomes cannot be silently retried. Known request IDs resume without another submission.
- Mock speech and forced alignment reach audio review and stop before any talking-head spending. Duplicate setup/actions and changed content reviews are blocked.
- Provider authentication stays server-side. Download URLs/redirects are restricted to HTTPS fal media hosts. Keys are absent from API responses and exports.
- A real three-second FFmpeg test with a still image and synthetic test tone passed 1080p H.264/AAC, source frame rate, audio-duration, caption-file, and thumbnail checks. **This is not a generated voiceover or talking-head video.**
- Layout fixture with Paul contact details inspected: question captions at the bottom, contacts in the upper right, source presenter unchanged, same-presenter thumbnail with a short topic. Fixtures are in ignored `test-results/media-qa`, separate from user video records.
- Video tab inspected at the actual desktop viewport: both approved questions, presenter image, stock voice choices, short thumbnail topic, private fal key input, and cost-gated workflow. Media byte-range serving is covered by an HTTP test.
- No actual fal model was called; no provider charges, real voice/audio-quality check, lip-sync check, or end-to-end paid acceptance is claimed. No final user MP4 exists yet.

## Railway deployment checks

The service is live at https://ai-video-builder-test-production.up.railway.app. Both Docker builds and Railway health checks succeeded. All three team accounts authenticated individually; private API access without a session returned 401. Hosted checks verified Paul's original reviewed record and two scripts, the fictional presenter PNG, fal-key presence, FFmpeg availability, and no generated video jobs.

The initial database fingerprint and refusal to overwrite an existing database are covered by the 28th test. The second Railway deployment omitted the seed file and retained the reviewed record on `/data`, confirming persistence across a real deployment. The hosted UI source contains the corrected Railway storage wording; its JavaScript syntax check passed. The hosted sign-in screen was inspected in the browser. The authenticated video layout was previously inspected locally; its hosted endpoints were verified directly.

No provider generation was submitted. Hosted outbound model access, fal balance, real speech/animation quality, and final MP4 playback remain part of the first paid acceptance test. See `outputs/railway-deployment/deployment-verification.json` in the workspace for the safe deployment record.

## Manual shortening — 15 September 2026

At Arvie's request, automatic rewrite/API setup was deferred. The two Paul scripts were shortened manually from Keziah's saved feedback. The proposed revisions contain 56 and 52 spoken words including question headings, retain source evidence, and require a new content review. Duration estimates remain provisional until audio is generated.

A restricted manual-update route allows Arvie to save supplied revised drafts without an AI API call. It verifies the current record revision, source/rules, evidence, and 75-word maximum, keeps the previous draft and review decisions, and clears approval for the new draft. Earlier review decisions remain visible as belonging to the previous draft. New tests cover access controls, stale updates, unsupported evidence, length, history preservation, duplicate refusal, and a key-free HTTP update.

`node --test test/*.test.mjs`: 31 passed, 0 failed, 0 skipped. Browser JavaScript syntax check passed. Automatic-rewrite work is parked outside the deployed application in `work/deferred-script-rewrite`.
