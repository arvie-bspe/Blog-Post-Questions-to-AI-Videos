# Team test guide — content and video pilot

This guide replaces the earlier provider-based test plan for this application stage. Use the table as a Google Sheets guide: add Actual result, Status, Evidence link, Tested by, and Test date columns. Record Pass, Fail, or Blocked only after running a case. All team cases start Not run; automated checks are listed separately below.

| ID | Owner | Test action | Expected result | Initial status |
|---|---|---|---|---|
| P01 | Arvie | Inspect Paul's saved article twice. | One saved record; 16 eligible headings; H1 excluded. | Not run |
| P02 | Keziah | Read eligible headings and exclusions against the Google Doc snapshot. | Only explicit body question headings qualify. | Not run |
| P03 | Keziah | Load Paul's prepared example and expand every sentence's evidence. | Two distinct questions; whole claims supported; Michigan context and required qualifiers preserved. | Not run |
| P04 | Keziah | Check restricted words, conditional exceptions, CTA/disclaimer, and ending. | Rules satisfied without invented wording or client facts. | Not run |
| P05 | Arvie | Try to mark reviewed without the source-evidence checkbox. | Review is blocked with a clear message. | Not run |
| P06 | Macy | Select Macy as a local test reviewer and open Review & checks. | Script approval is unavailable; role explanation visible. | Not run |
| P07 | Keziah | Record a real pilot source review with useful notes. | Decision and reviewer are saved, explicitly marked as a test review. | Not run |
| P08 | Macy | Download scripts/evidence and JSON; reopen the app and saved review. | Exports match the visible scripts; review persists. | Not run |
| P09 | Macy | Check desktop and narrow-window layouts, disclosures, buttons, and error messages. | Text readable, no clipped controls, no page-wide horizontal overflow. | Not run |
| P10 | Arvie | Configure Google credentials and inspect an eligible row in each enabled month. | Current J/L mapping and exact client match validated; empty rows blocked. | Not run |
| P11 | Arvie | Modify a copied test article after a live inspection, then attempt analysis/review. | Source change blocks the old record; reinspection is required. | Not run |
| P12 | Arvie | Configure the API key and run one analysis. | Drafts, exact citations, and independent audit returned; failed audits cannot be approved. Record actual usage. | Not run |
| P13 | Arvie | ClickUp approval checks. | Deferred by Arvie; manual article tests require no ClickUp connection or approval status. | Deferred |
| P14 | Arvie | Restart during a test API analysis. | Saved job becomes Interrupted, with no automatic paid retry. | Not run |
| P15 | Arvie | Deploy the pilot with team passwords and a persistent volume; restart once. | Login required; roles enforced; saved records remain. | Not run |
| V01 | Macy | Voice, presenter, lip sync, captions, thumbnail, and actual playback. | Use the detailed video cases below. | Not run |
| V02 | Arvie | Save finished video to the correct Visual folder. | Test after Drive delivery is implemented. | Blocked — not implemented |
| V03 | Arvie | ClickUp Done webhook. | Revisit when the deferred ClickUp integration resumes. | Deferred |
| V04 | Macy | Logo and brand-color checks. | Deferred by Arvie for this test. | Deferred |

Automated regression command: `npm test`. Passing automated checks do not mark any team source review, live integration, or video case as passed. Any Codex UI exercise is recorded as a test, not as Arvie's or Keziah's actual approval.

Arvie handles configuration and integration failures; Keziah owns factual and script decisions; Macy owns visual/audio acceptance in the Video creation tab. Record a failing example's article ID, source hash, rule version, expected behavior, actual behavior, and screenshot/export link before requesting a fix. Never include API keys in the test sheet.


## Video test cases

Use these rows in your testing sheet. Add Actual result, Status, Evidence link, Tested by, and Test date. Never mark a live case passed based on a simulated automated test.

| ID | Owner | Test action | Expected result | Initial status |
|---|---|---|---|---|
| V05 | Arvie | Save a fal API-scoped key privately; open an approved article. | Connection presence shown; no provider call until the paid action. | Not run |
| V06 | Macy | Inspect presenter, select voice/question/topic, save setup twice. | Same setup reopened; exact reviewed text; no duplicate paid request. | Not run |
| V07 | Macy | Generate and listen to the entire voiceover. | All script words correct; natural pace; names, numbers, SOS-258 and EtG pronounced acceptably. | Not run |
| V08 | Keziah | Compare spoken answer and visible script to the reviewed source record. | No new claims, omissions, changed jurisdiction, added CTA, or rewritten answer. | Not run |
| V09 | Arvie | Record the voice charge, measured duration, and render estimate. | Actual fal usage recorded separately from the estimate; no render until audio acceptance. | Not run |
| V10 | Macy | Render and watch the whole MP4 with sound. | Stable generic presenter, matching lips, exact audio; no freeze, black section, music, or outro. | Not run |
| V11 | Macy | Check caption words, capitalization, wrapping, and timing on desktop and phone. | Question in capitals; natural answer case; readable bottom captions follow measured speech. | Not run |
| V12 | Macy | Check contacts and thumbnail against client configuration. | Correct name/address/phone, legible upper right, same presenter, short thumbnail topic. Logos/colors deferred. | Not run |
| V13 | Arvie | Interrupt monitoring after a fal request ID is saved; restart and resume. | Polls the same request ID, no duplicate submission or charge. Record actual fal history. | Not run |
| V14 | Arvie | In a disposable test record, simulate an uncertain queue submission. | Held for provider reconciliation; no silent paid retry. | Not run |
| V15 | Macy | Download MP4, thumbnail, VTT, and manifest; seek through playback. | All four files usable, video 1920 × 1080, source and review provenance retained. | Not run |
| V16 | Macy | Record final approval or changes with notes. | Review persists; ready status only after all video checks. | Not run |

Arvie's actual content review on the current Paul record is saved as “everything is good” on September 14, 2026. The voice/presenter choice and live video acceptance are separate outstanding decisions. Keziah does not need to approve the same script again merely to unlock this test.
