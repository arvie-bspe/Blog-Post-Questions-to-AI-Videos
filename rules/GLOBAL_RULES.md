# Article Video Studio — Global Rules

Version 1.4.4 · Updated September 21, 2026

## Active sources and workflow

The two current documents below, together with the user-authorized updates in this rulebook, govern content and appearance. The retired standalone layout specification is no longer an active source.

- [Video Content and Script Rules](https://docs.google.com/document/d/1WSvU3_FJYC_tl7hOHpVYM4L_5rhofNLD8X6F8cHyosQ/edit)
- [Video Appearance and Quality Rules](https://docs.google.com/document/d/1pSiCC_mkD1rieKF08kLFJhIG9NaGoUGPmw_EqhkPDWU/edit)

## Required production workflow — user update September 21, 2026

**Google Doc → Codex CLI writes the script → Keziah approves → HeyGen creates the video presenter and voiceover → Railway assembles the video → Macy reviews → Google Drive**

Keep these stages in this order. Codex CLI is the production script author. Keziah's approval of the exact script is required before any paid HeyGen submission. HeyGen supplies the approved Studio Avatar, matching voiceover, lip-sync, source footage, and caption timing. Railway adds the approved layout, contrast-backed client logo, captions, thumbnail, and end card. Macy reviews the finished assembled video before its MP4, thumbnail, and captions are delivered to the selected Google Drive Visual folder.

User-authorized application settings: select a monthly tab and row manually; article J, Visual folder L, article target URL E. ClickUp and Social Poster triggers remain deferred. Keziah approves the current script; the app selects an approved generic Studio Avatar and voice for each video, then generates with HeyGen. Railway assembles the portrait video and returns it to Macy. Only Macy approval initiates Drive delivery. Existing approvals are not replayed on rules migration. The preferred speaking time is 30 seconds; the white end card lasts three seconds. Brand colors remain deferred; use neutral styling.

HeyGen is the approved source of speech and talking footage; there is no separate legacy voice pipeline or presenter-image step. Intermediate provider footage preserves the whole source; Railway composes the final scene directly into 9:16 with face-aware cover/crop. This is not a landscape final output.

The user explicitly authorized logo acquisition from the selected firm homepage HTML, persistent caching by domain, and SVG rasterization with Chromium/Playwright. This authorization is limited to that official asset source. Never scrape a substitute after a clean-logo check fails; never generate or reconstruct a logo. Source-article NAP must be resolved separately with evidence, never copied from the general client record.

Automatic generation retains the existing $2 estimated allowance per video and two-new-submissions daily cap. A longer estimate or exhausted cap is held visibly. No paid retry is implicit.

## Per-question approval rule — user update September 16, 2026

Each selected question is a separate script and video approval unit. Keziah must have Approve this script and Request changes controls on each script card. Approving one question authorizes only that exact script revision to generate one video; it never approves or starts the other questions in the article. Other questions remain pending until individually approved. There is no article-wide or approve-all video action.

Review notes, change requests, approval fingerprints, generation status and duplicate protection are stored per question. Changing or rejecting one script must not revoke, rewrite, regenerate or delay an unchanged sibling script. Changes to shared article evidence or required identity information may require all affected scripts to be reviewed again. Repeated approval, page refresh, retry or restart must never purchase duplicate renders.

Historic article-wide decisions stay in history and are not converted into individual approvals or replayed as generation requests. Previously purchased footage is retained and reused after a matching individual approval when the exact script, source, identity and layout still match. Only an explicit new paid-render action can purchase a replacement of an existing submitted request.

Macy also reviews each finished video independently. Approval saves only that video and its associated files to the row's Visual folder. Her request for script changes returns only that video's question to Keziah. Per-question approval overrides any article-wide approval wording in the source documents below.

## Matching avatar and voice — user update September 16, 2026

The avatar and voiceover must have the same gender on every video. Match verified HeyGen catalog metadata; never infer gender from a name, photo or audio sample. If either gender is unknown or the pair does not match, hold generation before any paid submission. This check applies to automatic selection, manual overrides, saved setups, retries and replacements. Rotation is allowed within the compatible voice pool; a client does not receive a permanent avatar/voice pairing.

Existing mismatched footage cannot pass video review or delivery. Correct it using matching, previously purchased footage only if the exact approved script and article still match; otherwise prepare an explicitly authorized paid replacement. Preserving a previous voice on regeneration never overrides this matching requirement.

Source framing checks must distinguish real faces from background or clothing false positives. Use the bundled local face detector on every frame, retaining head and upper-torso crop safeguards. A confirmed second face or unreliable tracking holds the output. Store the detector version and failure frame for diagnosis. Updated local framing checks and final assembly may reuse existing footage without a new HeyGen charge; they do not grant a missing script approval or Macy approval.

## Presenter gender selection — user update September 17, 2026

Select the presenter from the approved generic presenter pool.

Before selecting a presenter, locate the lawyer blurb in the source Google Doc. The lawyer blurb is the section that describes the attorney or attorneys associated with the page. It will usually include information such as their professional background, qualifications, education, admissions, practice areas, memberships, or experience.

Use only the text in the lawyer blurb to determine the gender represented by the attorney or attorneys.

Determine gender only from explicit information in the lawyer blurb, such as:

- Gendered pronouns, including she, her, he, him, or his
- Other clear and explicit gender references

Do not infer gender from:

- Name
- Photograph or image
- Physical appearance
- Voice
- Firm name
- Practice area
- Outside research
- General assumptions

Presenter selection follows these rules:

- If one attorney is represented and the lawyer blurb explicitly establishes that attorney as female, select an approved female generic presenter.
- If one attorney is represented and the lawyer blurb explicitly establishes that attorney as male, select an approved male generic presenter.
- If multiple attorneys are represented and all explicitly established genders are female, select an approved female generic presenter.
- If multiple attorneys are represented and all explicitly established genders are male, select an approved male generic presenter.
- If attorneys of different explicitly established genders are represented, either an approved male or female generic presenter may be selected.
- If the lawyer blurb does not contain enough explicit information to establish gender, do not guess or use outside information. Use the default presenter selection behavior.

Only use gender information found in the lawyer blurb. Do not use other parts of the Google Doc to infer the attorney's gender.

A reviewer may request a different presenter gender from the video review controls. The replacement must still follow the lawyer-blurb rules above, must come from the approved generic presenter pool, and must use a verified voice with the same gender as the selected presenter. A presenter-gender change requires a new talking-video render; it must never reuse a voice of a different gender.

## Complete video content and script rules

Video Content and Script Rules

Build the video-content generation layer so that every automatically generated video follows the question-selection, source-accuracy, script-style, forbidden-language, and client-specific content rules below.

This specification controls what the video says.

The separate Video Appearance and Quality Rules control how the video looks, including the presenter, captions, branding, layout, thumbnail, rendering, and visual quality.

The existing voiceover system remains responsible for turning the approved script into speech and sentence timing.

The content-generation layer must finalize and validate the script before sending it to the voiceover system.

Source article definition

Throughout these rules, the source article or source document means the approved Google Doc or other supplied article document used to generate the video.

The source article remains the controlling reference even when the corresponding webpage has not yet been published or temporarily returns a 404.

The source article also controls the article-specific law firm and contact information used in the credits scene or other supporting video elements. When the law firm name, attorney name, address, phone/contact number, city, location, or geo is needed for the credits scene, use the information provided in the same approved Google Doc or source article.

Do not generate credits from a different office or location simply because additional law firm information appears in the client sheet.

Do not require a live published webpage before determining the article-specific law firm, attorney, address, phone/contact number, city, location, or geo.

### C01 Core Content Objective

Each video answers one specific question selected from, or validly formulated from, the approved source document content under the applicable question-selection rules.

The script should provide a clear, natural, professional spoken answer based only on information supported by that source.

Do not turn one video into a summary of an entire document.

Do not combine multiple questions into one video.

Do not add information simply to make the answer longer.

The final script should sound like a professional explaining one point clearly to a viewer, not like an article being read aloud.

The videos should support the main page topic rather than repeat or recreate the page itself.

### C02 Page Title Exclusion

The page title is context only.

Never create a video directly from the page title.

This applies even when the page title is written as a question.

A title ending with a question mark does not make it an eligible video question.

The title identifies the broader subject of the page. Videos should come from specific questions within the page content that support, explain, or expand on that subject.

This rule also applies to titles for pages such as:

Attorney profile pages

Practice area pages

Service pages

Location pages

Informational pages

Landing pages

FAQ pages

Blog pages

Do not turn titles such as an attorney's name, firm name, practice-area title, service title, or location title into a video.

Do not create a question from the title just to generate a video.

Examples:

Page title

“John Smith Personal Injury Attorney”

Do not create:

“Who is John Smith?”

unless that exact question appears within the eligible source content and is actually answered there.

Page title

“Can I Qualify for Medicaid?”

Do not create a video from that title itself.

Instead, select qualifying explicit questions from the page content that support the broader Medicaid topic.

The page title can be used to understand the subject and relevance of candidate questions, but it is never itself a video candidate.

### C03 Question Selection

By default, video questions must come from substantive H2 or H3 content in the main article content that appears above the FAQ section, unless an approved client-specific alternate question-selection rule expressly permits a different method.

Under the default method, select explicit H2 or H3 headings that ask a clear question.

A question appearing in the FAQ section may cover the same or a similar topic as a video question only when that topic is independently and clearly supported by substantive H2 or H3 content in the main article above the FAQ section.

FAQ content alone does not make a question eligible for a video.

When an FAQ question is used because its topic is independently supported above the FAQs, build the substantive answer from the eligible main article content and keep the answer fully grounded in the supplied source document.

Do not select:

The page title

H1 or equivalent primary page title

Attorney names used as titles

Practice-area titles

Service names

Location titles

FAQ questions whose topic is not independently supported by eligible main content above the FAQ section

Questions that depend only on FAQ content

Questions invented from the page title

Questions the source does not answer

Questions that require outside information

Repeated or substantially overlapping questions

Questions whose main purpose is asking whether someone needs, should hire, or must have a lawyer or attorney

Questions such as “Do I need a lawyer?”, “Should I hire a lawyer?”, or “Do I need an attorney to file a claim?”

Similar questions where the source-supported answer may simply be that legal representation is not required

Include:

Explicit H2 or H3 questions in the substantive main content above the FAQ section

FAQ questions only when the same or a sufficiently similar topic is independently supported by substantive H2 or H3 content above the FAQs

Questions that are actually answered by the source

Questions that can stand alone as a useful video topic

Questions that support the broader page title or subject

Prefer questions that lead to a clear, useful, informative standalone answer about a process, right, requirement, next step, deadline, consideration, consequence, or other substantive information supported by the source.

A question can satisfy the structural requirements and still be skipped if it would make a weak, awkward, or unhelpful short-form video topic.

A question mark identifies a possible candidate, not an automatically approved video.

The question must still satisfy every qualification rule, and the source must contain enough information to answer it accurately.

If the source raises a question but does not contain enough information to answer it accurately, skip it.

Client-Specific Alternate Question Selection

The default H2/H3 and FAQ question-selection rules apply unless an approved client-specific alternate question-selection method expressly permits a different structure or selection method.

A client-specific alternate method may expressly override default structural requirements such as:

Requiring the source topic to appear as an H2 or H3

Requiring the question itself to appear as a heading

Limiting question selection to content above the FAQ section

Excluding FAQ content from consideration

Depending on semantic H2, H3, or H4 structure

Only override a default structural rule when the applicable client-specific instructions clearly authorize the alternate method.

When such an exception applies, follow only the alternate method approved for that client.

The alternate method does not permit invention of new topics, use of outside knowledge, unsupported facts, or questions that the supplied source does not answer.

Client-specific alternate question-selection rules affect how eligible questions are identified. They do not override source accuracy, no-hallucination rules, preservation of legal meaning, or other global content requirements.

### C04 Questions Should Support the Page Topic

Selected questions should relate naturally to the broader subject identified by the page title.

The title provides topical context but does not become script content automatically.

For example, if the page is an attorney page, do not create a video merely introducing the attorney because the attorney's name appears as the title.

Instead, select substantive questions from the page content when available.

If the page is a practice-area page, select useful questions about that legal subject rather than creating a video that simply repeats the practice-area name.

Videos should add useful supporting information around the main page topic.

Do not create a video solely because a title exists.

If a page contains no qualifying question and no question can be validly formulated under an approved client-specific alternate question-selection rule, it can produce zero videos.

Do not invent an unsupported question simply to make sure every page generates a video.

### C05 One Question Equals One Video

One approved question produces one video.

Do not answer two separate questions in the same video.

Do not split one question into several videos unless the system has been specifically instructed to do so.

The spoken answer should remain focused on the selected question.

Related information can be included only when it is necessary to explain the answer and is supported by the same source document.

The page title does not count as one of the questions.

### C06 Similar and Overlapping Questions

Do not create repetitive videos.

If two or more questions would produce substantially the same answer, select only one.

Choose the question with the most value.

When several eligible questions remain, prefer questions that provide the most distinct and useful information rather than questions that repeat the same point in different wording.

Higher-value questions are those that:

Can preferably be answered clearly and meaningfully within approximately 30 seconds of natural spoken delivery

Have the strongest and clearest answer in the source

Cover the useful information more completely

Can stand alone without requiring another video for context

Address the main issue more directly

Add meaningful information to the broader page topic

Avoid repeating information already covered by another selected question

Explain a useful process, right, requirement, next step, deadline, consideration, consequence, or other substantive issue

Produce a clear and informative standalone answer rather than a simple yes-or-no response about needing a lawyer

When eligible questions have similar value, prefer the question that can be answered completely within approximately 30 seconds. However, do not reject an otherwise strong and useful question solely because preserving necessary context requires a somewhat longer script.

Do not select several differently worded questions merely because each appears as a separate heading.

Example:

Question A

“Can I change my trust?”

Question B

“Is it possible to modify a revocable trust?”

If the source would produce substantially the same answer for both, select the stronger question and skip the duplicate.

Do not create artificial wording differences to justify additional videos.

### C07 Video Count Limits

Aim for two videos per source page or document when at least two strong qualifying questions are available.

Up to four videos may be created when the source contains additional distinct, useful questions that are fully answered by the source.

Fewer than two videos is allowed when the content does not justify additional videos.

Do not create weak, repetitive, implied, or unsupported questions merely to reach the target number of videos.

Use this priority when more than four qualifying questions are available:

Questions clearly and fully answered by the source

Questions with the strongest standalone value

Questions containing substantive information

Questions that support the broader page topic

Questions that add information not already covered by another selected video

Four videos is the default maximum.

If a client-specific or batch configuration sets a lower maximum, follow the lower limit.

Do not exceed four videos unless a separate system configuration explicitly permits it.

The page title never counts toward the video total because it is not a video candidate.

This gives you the exact logic you described.

Target = 2Maximum = 4Fewer than 2 = acceptable when justified

### C08 Question Selection Failure Conditions

Skip a question or heading if:

It is the page title

It is the H1 or equivalent primary page title

It is not explicitly written as a question, unless an approved client-specific alternate question-selection rule applies

It is only implied by the surrounding text and does not qualify under an approved client-specific alternate question-selection rule

It comes from a statement heading or body topic that cannot be validly converted under an approved client-specific alternate question-selection rule

It is an attorney name or attorney-page title

It is only a practice-area, service, or location heading

The question had to be invented from the title

The source does not answer it

Answering it would require outside information

Answering it would require guessing

The available answer is too incomplete to preserve the meaning

It substantially duplicates another selected question

It falls outside the applicable video-count limit

Under the default question-selection method, it comes solely from the FAQ section and is not independently supported by substantive H2 or H3 content above the FAQs

Under the default method, the topic cannot be tied to eligible H2 or H3 content above the FAQ section

It violates the applicable approved client-specific alternate question-selection rule

It applies one client's alternate question-selection method to another client

Its main intent is determining whether the viewer needs, should hire, or must have a lawyer or attorney

It would likely produce a weak or awkward answer because the source indicates legal representation is not required

It does not provide enough useful substantive information to work well as a standalone short-form video topic

If an answer is likely to exceed approximately 30 seconds, first determine whether the additional wording is necessary to preserve important context, qualifications, conditions, exceptions, or distinctions.

If the answer can be tightened without losing meaningful information, tighten it.

If the additional length is necessary for an accurate and useful answer, the question can still qualify.

Do not force every page or heading into a video.

A page is allowed to produce no videos when it contains no qualifying questions.

Quality and source support take priority over video quantity.

### C09 Source Accuracy

The source document provided on the sheet is the only factual source for the video's substantive answer.

The source document also controls the article-specific identity and geographic context of the video, including:

Law firm name

Attorney or attorneys referenced

Address when provided

Phone or contact number when provided

City or location

Geographic area or geo referenced by the article

Do not use the client sheet or general client configuration to choose a different attorney, law firm, office, city, or geo from the one established by the source article.

Do not use:

Outside research

Web searches

Search-engine results

Other articles

Other client documents

General model knowledge

General legal knowledge not contained in the source

Information remembered from another video or generation

Information from another client's source

Do not supplement the answer because additional information would be helpful.

If the source does not contain the information, do not add it.

### C10 Source of Truth and Article-Specific Identity

The approved Google Doc or supplied source article is the primary source of truth for the specific video.

The source article controls:

Substantive factual content

Law firm name relevant to the article

Attorney or attorneys relevant to the article

Address when identified in the article

Phone or contact number when identified in the article

City or location

Geographic area or geo referenced in the article

Determine the article-specific law firm, attorney, and geographic context from the source article before consulting general client data.

A client sheet or client configuration may contain multiple attorneys, offices, addresses, cities, or service areas. The presence of those alternatives does not authorize selecting one for the video.

Do not use the client sheet to decide which office, attorney, law firm, city, or geo the article is about.

If the source article clearly identifies a specific law firm, attorney, office, address, city, or geographic area, preserve that association throughout the script and video-generation process.

Do not replace it with another attorney, office, law firm, or location merely because another option appears in the client sheet.

If several client locations exist, use the location actually referenced by the source article.

If the source article discusses multiple locations, use the location connected to the selected question or supporting content when that connection is clear.

If the source article does not establish which location applies, do not arbitrarily choose one from the client sheet. Omit the location when possible or flag the issue for review.

Credits scene source rule

When generating the credits scene, use the same source article used for the video's question and answer to determine the relevant:

Law firm name

Attorney name when applicable

Address

Phone/contact number

City or location

Geo

The credits scene must remain associated with the same law firm, attorney, office, and geographic context as the source article.

Do not use the client sheet to independently choose a different office, address, phone number, attorney, law firm, or geo for the credits scene.

If the client has multiple locations, the existence of those locations does not authorize selecting one that is different from the location identified by the source article.

If a required credits detail is not available in the source article, do not guess or arbitrarily choose from multiple client records. Use an explicitly approved fallback when one exists or flag the missing information for review.

The client configuration may still provide operational or approved information such as:

Approved CTA wording

Approved brand terminology

Client-specific forbidden terms

Client-specific writing instructions

Pronunciation guidance

Operational client data must not override or supply the article-specific law firm name, attorney, office, address, phone/contact number, city, location, or geo used for the credits scene.

When those details are needed, use the information provided by the source article. If a required detail is not available in the source article, do not select or substitute one from the client sheet. Flag the missing information for review unless a separate approved fallback rule explicitly applies.

A live published webpage is not required to establish article-specific identity or location. If the webpage is unpublished or returns a 404, continue using the approved Google Doc or supplied source article.

Do not treat a 404 as permission to substitute another attorney, firm, office, or location.

### C11 No Hallucinated Facts

Never invent or assume:

Legal rules

Requirements

Exceptions

Deadlines

Statistics

Case results

Settlement values

Qualifications

Attorney credentials

Awards

Court procedures

Government requirements

Eligibility requirements

Client policies

Quotes

Locations

Numbers

Examples presented as facts

Case or legal outcomes

Attorney or firm credentials

Contact details, including phone numbers, addresses, and email addresses

Do not fill gaps with information that sounds reasonable.

Do not add generic legal knowledge simply because an attorney would likely know it.

The script must remain within what the supplied source supports.

### C12 No Filler Facts

Do not add factual-sounding filler simply to make a script longer or smoother.

If the source supports a short answer, produce a short answer.

Do not expand it with generic explanations that are not contained in the source.

Natural transitions are allowed, but they must not introduce new factual claims.

### C13 Preserve Qualifications

Do not strengthen the source beyond what it says.

Preserve meaningful qualifications, including:

“may”

“can”

“if”

“unless”

“depending on”

Conditions

Exceptions

Jurisdiction and jurisdictional limits

Eligibility requirements

Factual dependencies

If the source describes a possible outcome, do not rewrite it as guaranteed.

If the source limits a statement to certain circumstances, preserve those circumstances.

If removing a qualification changes the meaning, the qualification must remain.

### C14 Preserve Legal Meaning

The script can simplify wording for spoken delivery, but it cannot simplify away an important legal distinction.

Do not change “may” into “will” when the source does not support certainty.

Do not change “can” into “always does.”

Do not remove an exception because it makes the sentence shorter.

Do not turn a fact-specific rule into a universal statement.

### C15 Uncertainty and Missing Information

If the source is unclear, incomplete, contradictory, or insufficient to answer the question safely, do not resolve the issue using outside knowledge.

Do not guess which interpretation is correct.

Flag the question for review or skip it.

If a sentence cannot be supported by the source, remove it.

### C16 Script Style

Write specifically for spoken video.

The script should sound:

Professional

Clear

Direct

Natural

Neutral

Smooth

Easy to understand when heard once

Strip away filler words and unnecessary language.

Write every script as spoken dialogue intended to fit within approximately 30 seconds whenever the source allows.

Concision must not come at the expense of natural spoken flow.

The script should sound like one cohesive spoken answer rather than a sequence of separate factual statements.

When related source-supported ideas naturally belong together, combine them into a smooth sentence or connected thought.

Use brief natural transitions when they help connect ideas clearly.

Do not split a natural explanation into several short sentences merely to reduce runtime or word count.

Tighten wording aggressively where meaning can be preserved, but do not shorten the script by removing information needed to answer the question clearly.

Prefer a slightly fuller, natural sentence over a shorter version that sounds choppy or robotic when spoken aloud.

When shortening a script, remove or compress in this order:

Generic introductions

Repetition of the question

Repeated explanations of the same point

Unnecessary transitions

Secondary examples

Background information that does not materially help answer the selected question

Optional closing language

Preserve important source-supported conditions, exceptions, qualifications, deadlines, numbers, jurisdictional limits, and legal distinctions when they are necessary to the answer.

Do not replace specific useful information with vague wording merely to reduce runtime.

If the script still requires more than approximately 30 seconds after unnecessary language has been removed, a longer script is acceptable when the additional wording is needed for context, accuracy, or a complete and useful answer.

Do not make the script sound robotic, overly formal, dramatic, or AI-generated.

### C17 Opening Structure

The selected content question is the video question.

Begin with that question and move directly into the answer.

The selected question is part of the spoken script and counts toward the approximate 30-second target.

Do not repeat or paraphrase the question after it is spoken.

Move directly into the substantive answer.

Do not use the page title as the opening video question.

Do not insert a generic introductory sentence between the question and the answer.

The substantive answer should begin in the first sentence after the question.

Avoid openings such as:

“It is important to understand...”

“When it comes to...”

“There are several things to consider...”

“This can be a complicated issue...”

“Navigating this process can be difficult...”

The viewer already knows the question.

Answer it.

### C18 Script Length and Spoken Runtime

Write the final script for natural spoken delivery.

Aim to keep the complete spoken script within approximately 30 seconds whenever possible.

The approximate 30-second target includes the selected question and the substantive answer. Any required spoken CTA or disclaimer also counts toward the runtime.

Assume the script will be spoken aloud at a clear, natural professional pace. Evaluate script length based on how the complete script would sound when spoken naturally, not solely on written length or visual line count.

Do not rely on unusually fast speech to make an overly long script appear to fit.

Approximately 30 seconds is the preferred target, not an absolute maximum.

A shorter script is acceptable when the question can be answered completely in less time. Do not add filler merely to make the video closer to 30 seconds.

Before allowing a script to exceed approximately 30 seconds, tighten unnecessary wording, including introductions, repetition, unnecessary transitions, secondary examples, and nonessential background.

Do not meet the preferred runtime by breaking a natural explanation into abrupt or disconnected sentences or by removing transitions needed for smooth spoken delivery.

Do not shorten the script by removing information needed to preserve the source's meaning or provide a clear and useful answer.

Important conditions, exceptions, qualifications, deadlines, numbers, jurisdictional limitations, and legal distinctions must remain when they are necessary to the answer.

Do not replace specific source-supported information with vague wording simply to reduce runtime.

A script can exceed approximately 30 seconds when there is no reasonable way to preserve necessary context, accuracy, or important information within the preferred runtime.

Natural spoken cohesion should also be preserved. Do not sacrifice clear, conversational flow solely to reduce runtime.

Any additional length should be justified by substantive content, not filler, repetition, unnecessary detail, or inefficient wording.

The goal is to stay within approximately 30 seconds as much as possible while giving priority to an accurate, clear, complete, and useful spoken answer.

### C19 Sentence Flow

The complete script must sound natural and conversational when spoken aloud.

Treat the answer as one cohesive response rather than a collection of separate factual statements.

Prioritize the information needed to answer the selected question rather than trying to include every related point from the source.

Combine closely related source-supported ideas when doing so creates smoother spoken delivery.

Use natural transitions when needed to connect:

A rule with its qualification

A fact with its consequence

A general point with an important condition

Closely related steps or requirements

Related numbers, limitations, or exceptions

Do not create repeated short or disconnected sentences merely to keep the script brief.

Avoid:

“Trusts hold assets. They have trustees. Rules apply. There are different types.”

Prefer a connected spoken explanation when the same information can be expressed naturally without changing the source-supported meaning.

Do not split one natural thought into several short sentences merely to reduce sentence length or runtime.

At the same time, do not create overly long or difficult sentences just to combine information.

Each sentence should express a clear spoken thought, and each sentence should connect naturally to the next.

When choosing between a slightly shorter but choppy version and a slightly longer version that sounds natural and remains reasonably concise, prefer the natural version.

The final answer should sound like a person directly responding to the question, not like a compressed list of facts.

### C20 Tone

Keep the tone neutral and professional.

Soften wording when appropriate without weakening objective facts.

Do not use:

Dramatic language

Fear-based language

Aggressive sales language

Unnecessary urgency

Hostile language

Exaggerated consequences

Unsupported certainty

Do not make the viewer feel pressured.

### C21 Pronouns

Use “you,” “your,” and “yourself” only when they naturally apply to the viewer.

Do not force second-person wording into every explanation.

Use neutral wording when the source discusses a rule broadly.

### C22 Punctuation and Sentence Construction

Do not use an em dash.

Do not use a colon in the spoken script.

Do not use the section sign (§),

Write “Section” instead for the caption.

Do not begin a sentence with “Because.”

Do not begin a paragraph or script segment with “By.”

Rewrite the sentence naturally.

### C23 Use of “May”

Use “may” intentionally.

Use “may” only when the source describes a possible, conditional, subjective, discretionary, or uncertain outcome.

Do not use “may” simply to hedge or soften an objective statement.

If the source establishes a capability, use “can” when accurate.

If the source establishes an objective fact, state the fact directly.

Rule:

Possible or uncertain = “may”

Established capability = “can”

Established objective fact = direct statement

The source still controls.

Do not change the source's level of certainty merely to satisfy style preferences.

### C24 Source Attribution

Avoid unnecessary source-attribution language in the spoken script.

Do not use:

“according to”

“acc to”

“says”

“states”

“notes”

“lists him as”

“lists her as”

“credits”

“identifies”

“profile reflects”

“according to the firm's materials”

when the sentence can simply communicate the supported information directly.

Do not make the presenter sound like they are reading or reporting on another document.

If the source itself is substantively important to the meaning, preserve necessary attribution.

Do not remove attribution when doing so would falsely make another person's opinion, quotation, study, court ruling, or statement appear to be the presenter's independent assertion.

### C25 AI-Style Language

Avoid generic AI filler and repetitive transitions.

Do not add unnecessary setup, summaries, or conclusions merely to make the script sound complete.

Rewrite awkward or mechanical wording.

Do not create fragmented, hyper-direct sentences that sacrifice explanation.

The goal is concise explanation, not stripped-down fragments.

### C26 CTA Rules

A CTA is not required in every video unless the client configuration requires one.

Any spoken CTA counts toward the approximate 30-second target.

When the CTA is optional, do not sacrifice necessary explanatory content merely to make room for it.

Do not invent CTA language.

Use only client-approved CTA terminology and information.

Do not automatically say:

“Free consultation”

“Schedule a consultation”

“Call us today”

“Act now”

“Contact an expert”

unless that wording is approved for the selected client.

Keep any approved CTA brief.

The CTA must not introduce a new unsupported claim.

Do not turn the final portion of the video into a sales pitch.

### C27 Disclaimer Rules

Do not invent a legal disclaimer.

If the client, sheet, or configuration provides required disclaimer wording, use the approved wording.

If no disclaimer is provided, do not automatically create one.

If a disclaimer is required but approved wording is unavailable, flag the video for review.

Do not improvise legal disclaimer language.

### C28 Pronunciation

Use the exact approved spelling of client names, attorney names, places, legal terms, and other proper names.

Do not alter visible script or caption spelling to make pronunciation easier.

If approved pronunciation guidance exists in the client configuration, it can be passed separately to the voiceover system.

Do not display phonetic pronunciation instructions in captions unless they are intentionally part of the spoken content.

If pronunciation is uncertain and no approved guidance exists, do not guess when a wrong pronunciation would materially affect the video.

Flag it for review.

### C29 Natural Ending

The final sentence should naturally finish the answer.

Do not write content that depends on an outro or end card.

Do not add:

“Thanks for watching”

“Like and subscribe”

Generic closing filler

A second summary of the entire answer

unless specifically required.

If an approved CTA is used, integrate it naturally before the video ends.

### C30 Global Forbidden Words and Phrases

Exact prohibited wording

Approved treatment

Exceptions

“In the context of”

State the point directly.

None.

“understanding the”

Start with the actual subject or rule.

None.

“as in other states”

State only the source-supported jurisdictional information.

None.

“navigating the complexity”

Explain the actual issue directly.

None.

“navigating the complexities”

Explain the actual issues directly.

None.

“intricacy”

Use the specific issue, condition, requirement, or rule.

None.

“intricacies”

Use the specific issues, conditions, requirements, or rules.

None.

“ensure”

Use a precise source-supported verb such as “can,” “allows,” “helps,” or state the fact directly.

None.

“whether its”

Rewrite the sentence naturally.

None.

“generally”

State the supported rule and its actual qualification.

None.

“actually”

Remove it unless removal would change quoted material.

Quoted source wording can remain when necessary.

“usually”

State the actual source-supported condition.

None.

“typically”

State what the source says occurs and under what conditions.

None.

“specialize”

Use a source-supported description such as “handles,” “practices in,” or “represents clients in.”

Only if approved in the source document.

“expert”

Describe the person's approved role or experience without the label.

Only if approved in the source document.

“expertise”

Use a factual description of experience or work.

Only if approved in the source document.

“best”

Remove the superiority claim and state the supported fact.

Only if approved in the source document.

“proficient”

Describe the supported skill, role, or experience directly.

Only if approved in the source document.

“guaranteed result”

Flag for review and rewrite using the source-supported level of certainty.

Do not use as a marketing guarantee.

“100% success”

Flag for review. Do not use unless explicitly supported, approved, and permitted by the applicable client rules.

Only with explicit support and approval.

“risk-free”

Flag for review and replace with a precise source-supported description.

Only when the source literally establishes that no relevant risk exists and the claim is approved.

Unsupported “number one” claim

Remove the ranking claim and use a factual source-supported description.

Only if explicitly supported and approved.

Review absolute words such as “always” and “never” in context. Do not automatically prohibit them. They are acceptable when the source clearly supports an absolute statement. Flag or rewrite them when the source contains conditions, exceptions, uncertainty, or fact-dependent outcomes.

Apply these restrictions case-insensitively.

Rewrite naturally rather than performing mechanical word substitutions.

### C31 Forbidden Claims

Prohibited claim type

Approved treatment

Exceptions

Guaranteed outcome

Preserve the source's actual level of certainty.

Only when the source expressly establishes an unconditional fact.

Guaranteed legal result

Explain the applicable conditions from the source.

None unless the source supports the result as objective law.

Unsupported superiority claim

Replace it with a factual source-supported description.

Only if approved in the source document.

Unsupported “best” claim

Remove it.

Only if approved in the source document.

Unsupported “expert” claim

Describe actual approved experience or role.

Only if approved in the source document.

Fear-based legal claim

Explain the actual consequence neutrally.

None.

Outcome presented as automatic when the source makes it conditional

Preserve the condition.

None.

Information added from general legal knowledge

Remove it.

None.

Information added from outside research

Remove it.

None.

Invented factual filler

Remove it.

None.

### C32 Additional Client-Specific Rules

Client-specific rules are additional instructions that apply only to the identified client.

They do not replace, override, or remove the main Video Content and Script Rules unless a main rule expressly permits an approved client-specific alternate method.

Every video must still comply with all global requirements for:

Question selection

Page title exclusion

Source accuracy

Source-document-only factual support

No hallucination

Preservation of qualifications

Forbidden words and claims

Script style

Tone

CTA rules

Disclaimer rules

Pronunciation

Video-count limits

Content validation

Apply the client-specific rules on top of the main rules.

A client-specific instruction can make a rule more restrictive, require specific terminology, phrasing, treatment, or review, or use an alternate method when a main rule expressly permits one. It does not give permission to ignore the source document, add unsupported facts, use outside research, or violate another main content rule.

If a client-specific instruction conflicts with the supplied source or cannot be followed without violating the main rules, do not guess or force the instruction into the script. Flag the issue for review.

Source accuracy remains the highest content priority.

In practice:

Final requirements for that client's video

Only apply a client's rules to that client. Never carry one client's terminology, restrictions, exceptions, claims, or preferences into another client's video.

#### C32.1 Davies Client Rules

Apply these rules only to Davies content.

Exact prohibited wording or claim

Approved alternative or treatment

Exceptions

Saying an irrevocable trust “protects” assets

Prefer “preserve” or “exempt” when the source supports that wording.

“Protect” can be used only when strictly necessary for an approved SEO requirement.

“The government takes your assets”

Explain the source-supported spend-down and asset treatment rules neutrally.

None.

“Medicaid takes your assets”

Explain only the source-supported Medicaid and asset rules.

None.

Fear-based Medicaid framing

Use neutral factual wording.

None.

“grantor” when describing the person who creates the trust

“trustor”

“Grantor” is allowed in the approved tax context.

Claim that a trustee must be a professional

Explain only the trustee requirements supported by the source and client rule.

Professional trustees can still be discussed as an option.

Saying Davies provides “drafts”

Do not describe the process using “drafts.”

None.

For Davies process videos, preserve the approved process when the source supports discussion of that process.

#### C32.2 John Client Rules

Apply these rules only to John content.

Prohibited wording or treatment

Approved treatment

Exceptions

Criminal-case language in a personal injury video

Keep personal injury scripts focused on civil personal injury matters.

Criminal terminology is allowed in criminal-defense content.

“No fees unless we win” outside personal injury

Use it only in approved personal injury content.

Personal injury only.

Antagonistic wording toward defendants or insurance companies

Use neutral factual wording.

Strong wording can remain only when required for factual accuracy.

Advice telling viewers to avoid delaying medical treatment

Remove it.

None.

Advice telling viewers to obtain crash reports

Remove it.

None.

#### C32.3 Dan Client Rules

For a Connecticut highway-defect question, preserve the client-required distinction when it is supported by the supplied source.

The client wants the script to explain that the defect must be the sole proximate cause of the injury and that fault attributed to the plaintiff can defeat the claim.

Prompt photographs and preservation of the defect should be emphasized when the supplied source supports that advice.

Do not automatically use:

“the highest burden of proof under the law in Connecticut”

Treat that as requiring explicit source support before it can appear in the video.

If the supplied source does not contain the necessary highway-defect information, do not add it solely because it appears in the client rule.

Flag the mismatch for review.

#### C32.4 Alia Client Rules

Use “Alia Khan” for the attorney's name.

Use “Khan Law” for the brand name.

Do not create alternative or shortened versions unless separately approved.

#### C32.5 Ticket Crushers Client Rules

“Ticket Crushers” is an approved brand variation.

It can be used without “A Law Corporation.”

#### C32.6 Gibson and Singleton Client Rules

When an attorney is named under this client rule, do not refer only to “Gibson” or only to “Singleton.”

Either mention both approved attorney names specifically or do not mention an attorney.

For relevant Gloucester County accident content, the approved local-road references include:

Route 17

Route 198

Route 14

Hickory Fork Road

Guinea Road

Ware Neck Road

T.C. Walker Road

Do not add a road unless the source document supports its relevance.

Do not force road names into narration for keyword purposes.

#### C32.7 Russell Chicago Client Rules

Apply these rules only to Russell Chicago content.

This approved client-specific question-selection method overrides the default H2/H3 and FAQ structural requirements in Section 3. Follow the Russell Chicago method below instead when selecting questions for this client.

Russell Chicago blogs do not consistently use question-based headings or semantic H2, H3, or H4 structure. Do not require a question to appear as a heading in order to qualify.

Use this question-selection priority:

1. Explicit body questions

First, identify useful explicit questions appearing anywhere within the substantive page content, even when they are written as ordinary body text rather than H2, H3, or H4 headings.

An explicit body question can qualify when the page directly and sufficiently answers it.

2. Source-grounded questions from body topics

If the page does not contain enough strong explicit questions, formulate a natural viewer question from a clearly defined substantive topic discussed in the body.

A substantive body topic can consist of one paragraph or several connected paragraphs addressing the same specific issue.

The formulated question must:

Express an issue the body content directly discusses

Be completely answerable from the supplied page

Match the scope of the supporting body content

Not introduce a new legal issue, fact, condition, exception, jurisdiction, or outcome

Not require outside research or general legal knowledge

Not broaden a narrow discussion into a larger question

Be useful as a standalone talking-head video topic

Avoid substantial overlap with another selected video

The formulated question is a presentation device only. It does not authorize adding facts or legal substance that are absent from the source.

3. Page-title restriction

Do not convert the page title or H1 into a question merely because the page lacks question headings.

The formulated question may relate closely to the page title because both concern the same subject, but the question must be independently supported and answered by substantive body content. The page title alone cannot justify the question.

4. Identify substantive content by meaning, not HTML tags

Do not depend on H2, H3, H4, bolding, font size, or other HTML formatting to identify Russell Chicago video topics.

Instead, identify distinct substantive issues based on the meaning and organization of the body content.

A new candidate topic may exist when the body clearly shifts to a different specific issue, rule, consequence, procedure, or application and contains enough information to answer a focused question about it.

Do not treat every paragraph as a separate topic.

5. Excluded page material

Do not formulate video questions from navigation text, related-article listings, author biographies, contact information, generic firm marketing language, footer content, unrelated calls to action, or isolated quotations that lack sufficient explanatory context.

6. Question quality

Prefer narrow, practical questions that the source answers directly.

If several questions could be formulated from the same body content, choose the question that most accurately reflects the main point of that content and can preferably be answered within approximately 30 seconds of natural spoken delivery.

Do not make the question broader or more dramatic merely to make it more appealing.

Do not force every body topic into a video.

All other global rules for source accuracy, preservation of legal meaning, approximately 30-second spoken runtime, video count, duplication, tone, prohibited language, and content validation remain in effect.

### C33 Conflict Handling

Content rules apply in this order.

Source accuracy

Client-specific factual restrictions

Client-specific forbidden claims

Client-specific terminology

Global forbidden claims

Global forbidden wording

Script style

Approximate 30-second runtime and concision

The preferred runtime never overrides source accuracy, necessary context, or preservation of legal meaning.

The source document controls the substantive factual answer.

The source document also controls the article-specific law firm, attorney, address, phone/contact number, city, location, and geo used for the credits scene.

Client configuration must not override or substitute these article-specific details.

Client rules can restrict how supported information is expressed.

Client rules do not authorize adding substantive facts that are absent from the source.

The page title provides topical context only and does not authorize additional facts or become a video question.

### C34 Pre-Voiceover Content Validation

Before sending a script to voiceover generation, verify:

The selected question is not the page title

The selected question is not the H1 or equivalent primary page title

The selected question appears explicitly within the page content, or it was validly formulated under an approved client-specific alternate question-selection rule

When the default question-selection method applies, the selected question is an explicit question heading

When a client-specific alternate method applies, the formulated question is directly and completely supported by substantive body content

The question is actually answered by the source

The question supports the broader page topic

One question produces one video

The video does not duplicate another selected question

The video-count limit has not been exceeded

Every substantive statement comes from the source document

No outside research was used

No unsupported facts were added

No qualifications were removed

No prohibited global wording appears

No client-specific prohibited wording appears

No prohibited claim appears

Client terminology is correct

“May” and “can” preserve the source's level of certainty

The opening answers the selected question promptly

The script sounds natural when spoken

The script is not padded with filler

The script is not fragmented

CTA wording is approved

Any required disclaimer uses approved wording

Proper names use approved spelling

The final sentence ends naturally

The default target is two videos when two strong questions exist

No more than four videos are generated unless explicitly permitted

Fewer than two videos is allowed when the source does not justify more

The complete script is written for approximately 30 seconds of natural spoken delivery whenever possible

The selected question is included when evaluating spoken length

Any required spoken CTA or disclaimer is included when evaluating spoken length

Unnecessary setup, repetition, transitions, examples, and background have been removed

The script does not depend on unnaturally fast speech

Necessary information has not been replaced with vague wording merely to shorten the script

If the script exceeds approximately 30 seconds, the additional wording is necessary for context, accuracy, or an important part of the answer

Any runtime beyond the preferred target comes from substantive necessary content rather than filler or inefficient wording

“Guaranteed result,” “100% success,” “risk-free,” and unsupported ranking claims have been flagged or removed

“Always” and “never” have been reviewed in context rather than automatically rejected

Jurisdiction, conditions, and exceptions from the source remain intact

The selected question and answer are grounded in the source article

Any law firm name used for the video or credits matches the source article

Any attorney name used matches the source article when applicable

Any address used for the credits matches the source article when provided

Any phone/contact number used for the credits matches the source article when provided

Any city, location, or geo used matches the source article

The client sheet was not used to substitute another lawyer, law firm, office, address, phone number, or geo

When the default question-selection method applies, the selected question is based on eligible substantive H2 or H3 content above the FAQ section

Under the default method, a question selected from or overlapping an FAQ topic is independently supported by eligible H2 or H3 content above the FAQs

When an approved client-specific alternate method applies, the selected question complies with that client's alternate question-selection rules instead of the default structural rules

The answer directly responds to the selected question

Related ideas are connected naturally rather than presented as isolated statements

The complete script sounds smooth and cohesive when read aloud

The script does not sound like a compressed list of facts

Sentence shortening has not made the script choppy or robotic

Natural spoken flow was not sacrificed solely to meet the approximate 30-second target

The selected question is not primarily asking whether someone needs, should hire, or must have a lawyer or attorney

The selected question leads to a clear, useful, informative standalone answer

The selected topic provides substantive value beyond a simple yes-or-no answer about legal representation

If any check fails, revise, skip, or flag the script before voiceover generation.

### C35 Automatic Failure Conditions

A script fails content validation if:

It creates a video from the page title

It creates a video from the H1 or equivalent primary title

It converts an attorney-page title into a video question

It invents a question from a practice-area or service title

It creates a question that was only implied by the source, unless an approved client-specific alternate question-selection rule permits source-grounded question formulation and the question satisfies all requirements of that rule

The source does not answer the selected question

It requires outside information to complete the answer

It contains hallucinated information

It materially changes a source qualification

It presents uncertainty as certainty

It repeats a substantially identical video

It exceeds the configured video-count limit

It contains prohibited client wording

It contains an unsupported legal or marketing claim

It uses information belonging to another client

It invents CTA or disclaimer language

It uses a law firm name, attorney, office, address, phone/contact number, city, location, or geo for the credits scene that conflicts with the source article or was arbitrarily selected from the client sheet.

It adds filler facts not found in the source

It generates more than four videos without an explicit configuration allowing a higher limit

It contains a flagged guarantee, success-rate, risk-free, or superiority claim that was not resolved before voiceover generation.

The script exceeds the approximate 30-second target because of avoidable filler, repetition, unnecessary examples, unnecessary background, or inefficient wording

The script was shortened into vague, incomplete, inaccurate, or misleading language solely to meet the preferred runtime

Important context or qualifications were removed merely to keep the script under approximately 30 seconds

Under the default question-selection method, it selects a question solely from FAQ content without eligible supporting H2 or H3 content above the FAQs

It ignores an applicable approved client-specific alternate question-selection rule

It applies one client's alternate question-selection method to a different client

The script is unnecessarily choppy, fragmented, or robotic because related ideas were split into disconnected statements

The script sacrifices necessary spoken cohesion solely to reduce runtime

It selects a question whose main purpose is determining whether someone needs, should hire, or must have a lawyer or attorney

It selects a weak or awkward topic that does not provide a useful standalone informational answer

A fluent script is still a failed script if it is not source-supported.

### C36 Definition of Done

A video script is ready for voiceover only when it has:

Correct source document

Default question-selection structure followed when applicable

Applicable client-specific alternate question-selection rule followed when required

Page title excluded from video selection

Approved content question that is either explicit in the source or validly formulated under an approved client-specific alternate question-selection rule

Question actually answered by the source

Written specifically for natural spoken delivery

Approximately 30 seconds or less whenever the answer can be delivered clearly within that time

Any necessary runtime beyond approximately 30 seconds is supported by important context or substantive information

No unnecessary wording causes avoidable excess runtime

No important context has been sacrificed solely for brevity

One question per video

No unnecessary overlap

Video-count compliance

Source-supported answer only

No outside research

No hallucinated facts

Preserved qualifications

Correct client terminology

No forbidden wording

No prohibited claims

Direct answer to the selected question

Natural conversational spoken delivery

Smooth and cohesive flow between related ideas

No unnecessary choppy or disconnected sentences

No compressed list-of-facts delivery

Approximately 30-second target respected without sacrificing natural flow

Correct CTA when applicable

Approved disclaimer when applicable

Natural ending

Successful content validation

Useful standalone video topic

No “Do I need a lawyer?” type question

Question provides substantive informational value

The final script should clearly and naturally answer one specific question selected from, or validly formulated from, the source content.

The videos should support and expand on the page's main topic without turning the page title itself into a video.


## Complete video appearance and quality rules

Video Appearance and Quality Rules

Build the video-generation layer so that every automatically generated video follows the appearance, branding, presenter, caption, composition, thumbnail, audio, end-card, rendering, and quality rules below.

The goal is to produce a clean, natural, professional short-form talking-head video answering one specific question, with consistent client branding and predictable visual quality.

This specification controls how the video looks and renders.

The separate Video Content and Script Rules control what the video says.

The content-generation layer must finalize and validate the script and article-specific identity information before those values are used by the visual-generation layer.

### V01 Governing Visual Architecture

Every generated video must consist of exactly two mutually exclusive visual states:

STATE A = FULL-FRAME TALKING-PERSON SCENE

STATE B = FULL-FRAME WHITE END CARD

These are separate render states with separate layout rules.

At every point in the video, exactly one state must be active.

Do not combine STATE A and STATE B content in the same frame.

STATE A contains:

FULL-FRAME TALKING-PERSON SCENE

+

ONE APPROVED GENERIC PRESENTER

+

ONE CLEAN CLIENT LOGO

+

CAPTIONS

STATE B contains:

PLAIN WHITE BACKGROUND

+

CLIENT LOGO

+

NAME

+

ADDRESS

+

PHONE NUMBER

+

TARGET WEBSITE URL

### V02 Core Visual Objective

Every video should look like a professionally produced informational talking-head video in which the presenter directly answers one specific question.

During STATE A, the visual hierarchy is:

Presenter and spoken answer

Captions

Client logo

Do not allow the logo, captions, animations, or decorative elements to overpower the presenter.

The finished video should feel:

Natural

Clean

Modern

Professional

Trustworthy

Easy to watch

Easy to understand

Consistent across videos

Consistent with the selected client's approved branding

Avoid making the video feel like:

Generic AI-generated content

An overproduced advertisement

A slideshow

A stock-video compilation

A social-media template with excessive effects

A corporate presentation

A flyer

A poster

A business card

A webpage

A vertically stacked advertisement

The presenter answering the question remains the main visual focus during STATE A.

### V03 Output Format

The required output aspect ratio is:

9:16

Preferred default resolution:

1080 x 1920

Other resolutions may be used only when the exact 9:16 aspect ratio is preserved.

Define:

W = output frame width

H = output frame height

H / W = 16 / 9

Examples:

1080 x 1920

720 x 1280

Do not generate the main output as 16:9 or 1:1 under this specification.

Do not create a 16:9 video and crop it after rendering.

Compose the video directly for the 9:16 frame.

### V04 Frame Rate and Rendering Consistency

Use a stable frame rate throughout the video.

Do not mix incompatible frame rates between:

Avatar footage

Scene footage

Captions

Transitions

End card

Final render

Avoid:

Jerky motion

Frame duplication

Flickering

Sudden frame-rate changes

Broken interpolation

Black frames

Frozen frames

Corrupted frames

The final rendered video should play smoothly from beginning to end.

### V05 STATE A Critical Interpretation Rule

For STATE A:

THE 9:16 FRAME IS THE TALKING-PERSON SCENE. THE TALKING-PERSON SCENE IS NOT AN ELEMENT PLACED INSIDE A 9:16 FRAME.

Incorrect architecture:

9:16 graphic canvas

|

+-- logo

+-- smaller talking-person video

+-- captions

Correct architecture:

FULL 9:16 TALKING-PERSON SCENE

|

+-- logo overlay

+-- caption overlay

The talking-person scene itself occupies the complete frame.

### V06 STATE A Required Layer Structure

STATE A contains these visual layers:

Z3  Captions

Z2  Logo

Z1  Speaker + scene

The talking-person scene is the base layer.

It must occupy:

left   = 0

top    = 0

width  = W

height = H

Equivalent normalized bounds:

x = 0% to 100%

y = 0% to 100%

There must not be a visible outer canvas surrounding the talking-person scene.

### V07 Full-Bleed Scene Rendering

The STATE A scene must use behavior equivalent to:

width: 100%

height: 100%

object-fit: cover

Do not use behavior equivalent to:

object-fit: contain

Do not preserve the complete source aspect ratio by shrinking it until unused space appears around it.

Do not use:

Letterboxing

Pillarboxing

Blank padding

White filler

Gray filler

Black filler

Blurred sidebars

Decorative sidebars

Empty top regions

Empty bottom regions

The coherent talking-person scene must visually cover the complete 9:16 frame.

### V08 Prohibited Stacked Layout

Do not implement STATE A as:

frame

|

+-- logo/header region

+-- video region

+-- caption region

Do not create CSS Grid or flex rows such as:

header

video

captions

Do not reserve separate blank areas above or below the talking-person footage.

Logo and captions are overlays on the scene.

A suitable implementation is conceptually:

mainFrame:

position = relative

overflow = hidden

width = W

height = H

scene:

position = absolute

inset = 0

width = 100%

height = 100%

objectFit = cover

logo:

position = absolute

upper-right

captions:

position = absolute

bottom-center

Framework-specific syntax may differ, but the visible behavior must remain equivalent.

### V09 Source-Video Aspect-Ratio Conversion

If the speaker source is landscape, square, or otherwise not 9:16, do not shrink the source until it fits.

Use cover-and-crop behavior.

For a source width SW and source height SH:

coverScale = max(W / SW, H / SH)

Scale the source uniformly by at least coverScale.

Crop excess content outside the 9:16 frame.

Do not independently stretch width or height.

Do not distort the scene or presenter.

### V10 Face-Aware Cropping

After the source covers the entire output frame, position the crop around the presenter.

Default target:

speaker face center x = 50% of output width

Preferred range:

45% <= faceCenterX <= 55%

The source may shift horizontally to keep the presenter properly framed.

Do not center the source geometrically when doing so would move the presenter away from the desired position.

Logo clearance requirements may require additional horizontal reframing.

### V11 Presenter Framing

The final STATE A composition must approximately show:

top of head:

y = 6% to 12%

face center:

y = 19% to 30%

shoulder region:

y = 30% to 45%

bottom visible body crop:

y = 65% to 78%

Minor deviations are allowed when necessary because of anatomy or source-footage limitations.

The required anatomical framing takes priority.

### V12 Anatomical Framing Requirement

STATE A should show:

entire head

+

neck

+

both shoulder regions where physically visible

+

chest

+

upper torso

The normal lower crop should occur around the upper-abdominal or upper-torso region.

Do not intentionally show:

Belt

Waistband

Hips

Thighs

Knees

Feet

Do not frame the presenter as waist-up.

Do not frame the presenter full-body.

### V13 Face-Only Crops Are Prohibited

Do not crop the presenter to:

Face only

Head only

Forehead to chin

Head and neck only

Shoulders and meaningful upper torso must remain visible.

### V14 Presenter Scale

The presenter must be visually dominant.

As a target, the visible head-to-lower-crop height should occupy approximately:

55% to 72% of total frame height

A presenter occupying only a small portion of the frame is not acceptable.

Do not compensate for an incorrectly small presenter by making the logo or captions larger.

Correct the speaker framing instead.

### V15 Source Footage That Cannot Be Framed Correctly

If a source cannot simultaneously satisfy:

Full-frame 9:16 coverage

Required head-to-upper-torso framing

do not place the source inside a smaller rectangle.

Use these permitted actions in order:

Use a better frame or source segment when available

Crop or reframe the source

Scale the source further

Extend the existing scene only when an approved scene-extension capability is explicitly available

Reject the source as incompatible

Inset video is never the fallback.

### V16 Presenter / Avatar

The presenter is the visual centerpiece of STATE A.

The system must use:

Generic AI Presenter

Client-likeness presenters are not supported by this specification.

Do not:

Create a presenter based on a real client's likeness

Generate an attorney likeness

Upload or infer a real person's likeness

Search the internet for a person to use as presenter

Infer client identity from a website

Turn a client photograph into an avatar

Use a celebrity likeness

Use a public-figure likeness

Use a recognizable third-party individual

All presenters must come from an approved generic AI presenter configuration.

### V17 Generic Avatar Variations

Support multiple approved generic avatars.

The number of avatars is independent from the number of voices.

For example:

3 approved voices

5 approved generic avatars

is valid.

Do not require:

Voice 1 = Avatar 1

Voice 2 = Avatar 2

Voice 3 = Avatar 3

Voice and avatar selection are independent.

A voice may be used with different approved avatars.

An avatar may be used with different approved voices.

The same approved voice may be reused across different videos and clients.

One avatar is selected for each individual video.

Do not change avatars between sentences.

### V18 Presenter Appearance

Generic presenters should have:

Natural facial proportions

Natural skin rendering

Natural hair

Appropriate professional clothing

Natural posture

Natural eye movement

Natural facial expressions

Natural head movement

Natural upper-body movement where supported

Avoid presenters that appear:

Frozen

Robotic

Overly animated

Artificially smiling

Excessively expressive

Visually distorted

The presenter should look appropriate for a professional informational video.

### V19 Presenter Selection

Presenter selection should be automatic.

Manual avatar selection should not be required for each generated video.

Select the presenter from the approved generic presenter pool.

Before selecting an avatar, review the lawyer blurb associated with the selected source content to determine the gender represented by the attorney or attorneys mentioned.

Determine gender only from explicit information in the lawyer blurb, such as:

Gendered pronouns

Other clear explicit gender references

Do not infer gender from:

Name

Photograph

Physical appearance

Voice

Firm name

Practice area

Outside research

General assumptions

If the lawyer blurb clearly represents only one gender, select an approved generic avatar matching that gender.

This applies when:

One attorney is mentioned and their gender is explicitly established

Multiple attorneys are mentioned and all explicitly represented attorneys are the same gender

If attorneys of different genders are explicitly represented, either an approved male or female avatar may be selected.

If the lawyer blurb does not provide enough explicit information, do not guess.

Select from the approved generic avatar pool without applying a gender-match requirement.

Gender matching does not authorize selecting an avatar that resembles the actual attorney.

### V20 Avatar Variation

Do not permanently assign one avatar to a client or law firm.

When multiple eligible avatars are available, avoid repeatedly selecting the same avatar across consecutive or recent videos.

For each new video:

Apply the gender-selection rules

Determine the eligible avatar pool

Prefer eligible avatars not yet used in the current generation batch

If all eligible avatars have been used, select the least recently used eligible avatar for that client

If multiple avatars remain equally eligible, select automatically

If only one eligible avatar exists, reuse it

An avatar may be reused.

Reuse is acceptable when the available pool makes variation impossible.

Once selected for a specific video, keep that avatar throughout the video.

When the same video is regenerated because of a voiceover, caption, rendering, or technical failure, preserve its selected avatar unless avatar reselection is specifically requested.

### V21 Presenter Background

During STATE A, the background means the environment visible behind the presenter.

Examples include:

Office

Room

Studio

Workplace

Outdoor setting

Other contextual environment

It does not mean:

White graphic canvas

Gray graphic canvas

Solid-color frame around the source

Template background outside the talking scene

Decorative canvas around an inset video

Prefer the actual background contained in the source footage or generated presenter scene.

If scene generation or extension is required, do not invent factual environmental details such as:

Company signage

Business names

Legal credentials

Addresses

Geographic landmarks

Institutional affiliations

Profession-specific details unsupported by the approved source

If an appropriate scene cannot be created without inventing factual context, treat the source as an input/rendering problem.

### V22 Background Consistency

Do not unexpectedly change the talking-person environment between sentences.

The background should remain visually consistent throughout STATE A unless an explicitly configured scene change requires otherwise.

Avoid unexplained sequences such as:

Office

-> Studio

-> Outdoor location

-> Office

The video should feel visually continuous.

### V23 No Visible Source-Video Boundary

During STATE A, the viewer must not see a rectangular boundary corresponding to the original source-video dimensions.

Incorrect:

+-------------------------+

|                         |

|    +-------------+      |

|    | SOURCE VIDEO|      |

|    +-------------+      |

|                         |

+-------------------------+

Correct:

+-------------------------+

|                         |

| FULL-FRAME SCENE        |

|                         |

|       SPEAKER           |

|                         |

+-------------------------+

Every point in the visible frame must belong to the talking-person scene except pixels occupied by the logo, its compact contrast background, and captions.

### V24 STATE A Allowed Visible Elements

Intentional STATE A content is restricted to:

Full-frame talking-person scene

One presenter

One clean client logo in the upper-right

Captions near the bottom

Do not independently add:

Question/title overlay

Headline

Subtitle banner

Address

Phone number

Website URL

Email

Contact block

NAP panel

CTA graphic

QR code

Social handle

Supporting visual

Chart

Diagram

Photograph insert

Screenshot

Decorative text

Additional logo

The spoken question may appear through the timed captions because it is part of the approved audio.

Do not create a separate static question/title graphic.

### V25 Logo Asset Contract

STATE A requires a clean logo-only asset.

A valid logo may contain:

Logo mark

Logo wordmark

Text intrinsically forming part of the official logo

A valid STATE A logo asset must not contain separate:

Address

Phone number

Website URL

Email address

Contact block

Business-card layout

Letterhead information

A composite branding/contact graphic is not a valid STATE A logo.

### V26 Embedded Contact Information Counts as Contact Information

STATE A restrictions depend on what is visibly rendered, not the software layer type.

NAP or contact information is prohibited even when contained inside:

PNG

JPG

SVG

Logo image

Letterhead image

Screenshot

Watermark

Pre-rendered video

HTML canvas

Flattened graphic

Do not treat contact information as acceptable merely because it is inside an image.

### V27 Missing Clean Logo Asset

If the only available logo asset contains separate contact information, do not render it during STATE A.

Use a separate approved clean logo-only asset if one exists.

If no clean logo-only asset is available, return or flag:

MISSING_CLEAN_LOGO_ASSET

Do not:

Generate a replacement logo

Search for another logo

Download a logo from Google

Scrape one from a website

Guess how to reconstruct the official logo

Use another client's logo

### V28 Logo Background

Prefer:

Transparent PNG

SVG

Other clean logo-only asset

Every rendered logo must have a compact solid background so the complete mark remains easy to see.

Choose the background automatically from the visible logo pixels:

Dark logo → white background (`#FFFFFF`)

White or light logo → dark background (`#111111`)

For a mixed-color logo, use the light or dark background that produces the greater overall luminance contrast.

Apply consistent padding around the complete logo. Keep this contrast background limited to the logo area; it must not become a full-width header, contact panel, banner, or separate content region.

Use the same selected background in STATE A, the thumbnail, and STATE B.

If the official logo itself contains an intrinsic background shape, that design may remain.

### V29 STATE A Logo Size and Position

The logo must appear in the upper-right corner of STATE A.

Target width:

approximately 32% to 38% of total frame width

Preferred default:

logo width approximately 35% of frame width

Position:

right margin = 4% of frame width

top margin   = 3% to 4% of frame height

The logo height must scale proportionally from the original logo aspect ratio.

Do not:

Stretch the logo

Squash the logo

Distort the logo

Independently scale width and height

The complete logo bounding box must remain inside the frame.

Despite the increased logo size, the logo must remain visually subordinate to the presenter.

Do not automatically reduce the logo to the previous smaller logo size merely because the logo is large.

Reduce below the preferred range only when necessary to prevent a presenter-face collision or another unavoidable frame-boundary problem.

### V30 Logo Must Overlay the Scene

During STATE A, the logo and its compact contrast background must visually sit over actual scene pixels.

Correct:

SCENE SCENE SCENE [LOGO]

SCENE SCENE SCENE SCENE

Incorrect:

blank blank blank [LOGO]

talking video

Do not create blank upper-right canvas specifically to hold the logo. The small V28 contrast background is the only permitted logo plate.

### V31 Logo and Face Collision

The logo must not overlap the presenter's:

Eyes

Nose

Mouth

Primary face area

Treat the detected face bounding box as a protected area.

When helpful, expand the protected area approximately:

3% of frame width horizontally

3% of frame height vertically

If the enlarged logo conflicts with the presenter's face:

Adjust the presenter crop or horizontal position first

Adjust presenter scale or framing when appropriate

If the collision cannot otherwise be resolved, reduce logo size enough to eliminate the collision

Do not move the logo to another corner

The logo remains upper-right.

### V32 Caption System

Every spoken portion of STATE A must have corresponding captions.

Captions must synchronize to the actual approved generated audio.

Caption timing must come from the actual audio timing.

Do not estimate timing solely from:

Character count

Word count

Average speaking speed

Fixed durations

The approved generated audio is the timing source of truth.

### V33 Caption Appearance

Captions must use:

text color       = white

background color = black

Preferred exact values:

text       = #FFFFFF

background = #000000

The caption background must be opaque or effectively opaque black.

Do not use:

Transparent text without a background

Gray caption text

Colored caption text

White text directly over the scene without the black background

Decorative caption boxes unrelated to the required style

Gradient caption backgrounds

The black background should closely follow the caption text.

Do not create a full-width lower-third bar unless the actual text requires that width.

### V34 Caption Font

Use a clean, conventional sans-serif font.

Default:

font weight    = medium or semibold

text alignment = center

Avoid:

Decorative fonts

Serif fonts unless explicitly configured

Italics

Exaggerated bold weights

Extremely condensed fonts

Thin fonts

Do not automatically convert normal captions to ALL CAPS.

Preserve normal readable casing unless the approved source caption text is already uppercase.

### V35 Caption Font Size

Default caption font size:

approximately 5.5% to 6.0% of frame width

Preferred default:

approximately 5.7% of frame width

For a 1080-pixel-wide vertical video, this is approximately:

62px

Scale proportionally for other 9:16 resolutions.

Do not continuously shrink the font to make excessive text fit.

When text is too long:

Wrap appropriately

Split the dialogue into another timed caption event

Readable font size takes priority over forcing too much text into one caption.

### V36 Caption Background Geometry

The black background should closely follow the caption text.

Use approximately:

horizontal padding = 1.0% to 1.5% of frame width per side

vertical padding   = 0.4% to 0.8% of frame height

Do not extend the black background across the full frame width unless the text itself requires nearly that width.

The talking-person scene must remain visible around the caption block.

### V37 Caption Width

Caption width must be content-driven.

Preferred maximum:

75% of frame width

Hard maximum:

84% of frame width

If the caption would exceed the maximum:

Wrap to a second line

Split it into another timed caption event when necessary

Do not repeatedly shrink the font to accommodate excessive text.

### V38 Caption Lines

Default maximum:

2 visible lines

For two-line captions:

Center both lines

Keep line spacing compact

Use one visually unified black caption block or tightly stacked black backgrounds

Avoid excessive vertical gaps

Recommended line height:

1.05 to 1.15 x font size

Do not create large paragraph-style caption blocks.

### V39 Caption Position

Captions must remain centered near the bottom of STATE A.

Preferred caption-center region:

x = 50%

y = approximately 89% to 92%

The bottom of the complete caption background should remain approximately:

5% to 7% above the bottom edge

Captions must remain inside the full-frame talking-person scene.

Do not create a separate blank area beneath the scene for captions.

Do not position captions outside the video scene.

### V40 Caption and Face Clearance

Captions must not cover the presenter's:

Eyes

Nose

Mouth

Primary face area

If a collision occurs, first adjust presenter framing when practical.

Do not move captions to the top as the default solution.

Maintain the bottom-centered caption style.

### V41 Caption Animation

Caption animation should remain subtle.

Acceptable:

Simple appearance

Gentle fade

Minimal timing transition

Avoid:

Bouncing text

Flashing text

Excessive zoom

Large kinetic typography

Spinning

Distracting motion

The viewer should focus on the presenter and answer.

### V42 STATE A NAP Prohibition

During STATE A, do not independently render:

Name as a separate business/contact field

Address

Phone Number

Target Website URL

Email

Contact block

NAP panel

This prohibition applies to every STATE A frame.

The company name may remain when it is intrinsically part of the approved official logo or wordmark.

A separately typeset business name is not part of the logo.

Address, phone number, URL, and separate contact information are prohibited during STATE A.

### V43 Transcript and Contact-Information Conflict

STATE A captions must not independently introduce prohibited contact information.

If the approved spoken script itself contains an address, phone number, or target URL and accurate captions would therefore display prohibited STATE A information, flag a specification conflict before rendering.

Do not silently rewrite the approved dialogue.

Do not knowingly render a prohibited contact-information caption without resolving the conflict.

### V44 STATE A Frame-Level Invariants

For every STATE A frame, all of these must be true:

frame.aspectRatio == 9/16

scene.bounds == frame.bounds

sceneCoverage == 100%

visibleOuterCanvas == false

speaker.visible == true

speaker.count == 1

speakerFraming == HEAD_TO_UPPER_TORSO

logo.visible == true

logo.location == UPPER_RIGHT

logo.assetType == CLEAN_LOGO_ONLY

captions.location == BOTTOM

separateAddress.visible == false

separatePhone.visible == false

targetUrl.visible == false

NAPBlock.visible == false

endCard.visible == false

A normal STATE A frame violating these requirements is non-compliant.

### V45 Inset-Video Validation

Before accepting STATE A, inspect the visible bounds of the coherent talking-person scene.

Required:

scene.left   == 0

scene.top    == 0

scene.right  == W

scene.bottom == H

Reject the output when the talking-person scene rectangle is smaller than the output frame.

Do not merely check whether some background layer fills the frame.

The coherent speaker scene itself must fill the frame.

### V46 STATE B Hard State Change

At the configured endCardStartTime:

STATE_A = false

STATE_B = true

At that point:

speaker.visible = false

talkingScene.visible = false

caption.visible = false

stateALogo.visible = false

STATE B then occupies the full frame.

The logo used in STATE B is rendered as part of STATE B.

### V47 STATE A to STATE B Transition

Default transition:

hard cut

Do not crossfade the white end card over the talking presenter if doing so causes STATE A and STATE B content to appear simultaneously.

Do not temporarily show:

speaker + end-card NAP

If another transition is explicitly configured, it must preserve the mutual exclusivity of the two states.

### V48 STATE B Background

The STATE B background must be exactly:

#FFFFFF

It must cover:

x = 0% to 100%

y = 0% to 100%

Do not leave the talking-person scene visible behind it.

Do not use:

Gradient

Photograph

Office background

Speaker footage

Colored panel

Decorative pattern

Branded background image

STATE B is a plain white full-frame end card.

### V49 Required STATE B Elements

STATE B must contain all five of these elements:

Logo

Name

Address

Phone Number

Target Website URL

All five are required.

The logo does not replace any contact-information field.

Even when the logo contains the business or firm name as part of its wordmark, STATE B must still separately display:

Name

Address

Phone Number

Target Website URL

### V50 STATE B Logo Position and Size

The STATE B logo must remain in the same upper-right position used during STATE A.

Use:

right margin = 4% of frame width

top margin = 3% to 4% of frame height

Logo width:

approximately 32% to 38% of frame width

Preferred:

approximately 35%

Preserve the original logo aspect ratio.

Do not:

Stretch the logo

Squash the logo

Distort the logo

Move the logo to upper-left

Center the logo

Place it below the contact block

Place it behind the contact block

The complete logo bounding box must remain inside the frame.

### V51 STATE B Contact Information Layout

The logo and contact-information group are separate layout elements.

Conceptually:

+---------------------------------+

|                      +--------+ |

|                      |  LOGO  | |

|                      +--------+ |

|                                 |

|                                 |

|             NAME                |

|                                 |

|           ADDRESS               |

|                                 |

|        PHONE NUMBER             |

|                                 |

|      TARGET WEBSITE URL         |

|                                 |

+---------------------------------+

The contact-information fields form one vertically stacked group.

The group should be centered horizontally.

Default group bounds may use approximately:

x = 10% to 90%

y = 25% to 75%

Maintain enough spacing so the contact-information block does not collide with the upper-right logo.

### V52 Fixed STATE B Field Order

From top to bottom:

NAME

ADDRESS

PHONE NUMBER

TARGET WEBSITE URL

Do not reorder these fields because of content length.

Do not move the website URL above the phone number.

### V53 Address Wrapping

The address may wrap across multiple lines.

It remains one logical field.

Do not reduce all end-card text to an unreadable size simply to keep the address on one line.

### V54 Target Website URL

The actual target website URL must appear visibly.

Do not replace the URL with phrases such as:

Visit Our Website

Learn More

Click Here

Contact Us

Visit Us Online

unless the actual target URL is also separately visible.

### V55 STATE B Data Sources

The appearance layer must not independently choose a law firm, office, address, phone number, or location.

Article-specific identity values are resolved from the same approved source article or Google Doc used for the video's question and answer.

The source article controls article-specific values such as:

Firm or client name

Attorney when applicable

Address

Phone/contact number

City/location/geo when applicable

The appearance layer must use those resolved values.

Do not substitute another office or contact record from the general client configuration.

The target website URL must come from the approved target URL supplied for that article or video.

Do not infer or search for a missing URL.

The approved client configuration remains the source for appearance assets and operational visual settings such as:

Approved logo

Brand colors

Avatar pool

Voice pool

Visual configuration

Other approved brand assets

Do not treat the general client record as authority to replace article-specific contact information.

### V56 Missing STATE B Data

Before rendering STATE B, validate that required values are available:

logo != empty

name != empty

address != empty

phone != empty

targetUrl != empty

If a required field is missing:

Do not guess

Do not search externally

Do not substitute a different office

Do not fabricate information

Do not silently omit the required field

Return or flag a missing-required-data condition.

Use an explicitly approved fallback only when one has been separately provided.

### V57 STATE B Typography

Use a clean, simple sans-serif font unless an approved brand typography setting specifies another appropriate font.

Use:

Dark or black text

Centered contact-information alignment

Consistent vertical spacing

Strong readability

The Name may have slightly stronger typographic emphasis than the address, phone number, and URL.

Avoid:

Decorative fonts

Excessive font combinations

Excessive shadows

Excessive outlines

Tiny contact text

Poor contrast

Decorative typography

### V58 STATE B Prohibitions

Do not:

Remove the logo

Move the logo to another corner

Center the logo

Put the logo behind the contact-information group

Put the logo below the NAP/URL block

Omit the Name

Omit the Address

Omit the Phone Number

Omit the Target Website URL

Omit the URL because it appears elsewhere

Reuse the talking-person scene

Add the presenter

Add captions

Add a CTA

Add a QR code

Add social-media information

Add unrelated icons

Add decorative patterns

Change the plain white background

Add background music

STATE B must remain visually simple.

### V59 Render-Graph Separation

Use separate render logic for STATE A and STATE B.

Conceptually:

renderMainTalkingVideo()

renderEndCard()

Do not use one stacked component that simply reveals NAP beneath the talking-person scene.

Conceptually:

if state == MAIN:

render FullBleedScene

render LogoOverlay

render CaptionOverlay

if state == END_CARD:

render WhiteBackground

render EndCardLogo

render Name

render Address

render Phone

render TargetURL

### V60 Recommended Component Structure

A suitable architecture is:

VideoRoot

|

+-- MainState

|   +-- FullBleedScene

|   +-- LogoOverlay

|   +-- CaptionOverlay

|

+-- EndCardState

+-- WhiteBackground

+-- EndCardLogo

+-- ContactTextGroup

+-- Name

+-- Address

+-- Phone

+-- TargetURL

There is intentionally no persistent contact-information component inside MainState.

### V61 Background Music

There must be:

NO BACKGROUND MUSIC

This applies to:

STATE A

Transitions

STATE B

Do not use:

Stock music

AI-generated music

Ambient music

Corporate music

Instrumental music

Do not add music because a scene feels empty.

### V62 Audio Source

The existing voiceover system provides the spoken audio.

The visual system must not independently generate replacement speech.

The talking-head animation must use the actual approved generated voiceover.

Do not silently replace the approved voiceover with another provider-generated voice.

Voice selection occurs automatically through the approved voice configuration before the final voiceover is generated.

### V63 Voice Selection

Select the voice automatically from the approved voice pool.

Manual voice selection should not be required for every video.

The same approved voice may be reused across:

Videos

Attorneys

Clients

Law firms

Voice variation is not required.

Do not permanently assign one voice to a client unless a separate approved configuration explicitly requires it.

Do not require a fixed voice/avatar pairing.

Once a voice is selected for one video, keep that voice consistent throughout the video.

Do not change voices between sentences or regenerated segments unless voice reselection is explicitly required.

### V64 Voiceover Quality

The voiceover should use:

Natural speaking pace

Clear pronunciation

Natural pauses between sentences and ideas

Appropriate emphasis

Consistent volume

Consistent tone

Professional conversational delivery

Avoid:

Robotic delivery

Overly synthetic delivery

Unnaturally fast speech

Unnaturally slow speech

Excessive pauses

Missing words

Duplicated words

Abrupt changes in pitch

Abrupt changes in volume

Unexpected accent changes

Unexpected voice changes

Promotional or dramatic delivery

Audio clipping

Distortion

Crackling

Other noticeable artifacts

The generated voiceover must follow the approved script exactly.

Do not automatically:

Rewrite it

Summarize it

Expand it

Omit wording

Substitute wording

Configured pronunciation rules must be followed when available.

### V65 Lip Synchronization

The presenter must visually synchronize with the approved voiceover.

The mouth should:

Open at appropriate speech points

Close appropriately

Follow speech rhythm

Avoid noticeable delay

Remain appropriately still during silence

Avoid:

Frozen mouth during speech

Mouth movement during extended silence

Major facial artifacts

Severe audio/video drift

The result should look natural rather than mechanically synchronized.

The approved generated voiceover is the source of truth for:

Lip synchronization

Caption timing

STATE A duration

Final spoken duration

### V66 Facial Animation

The presenter should show subtle natural behavior:

Eye movement

Blinking

Facial expression

Head movement

Appropriate mouth movement

Avoid:

Excessive blinking

Fixed staring

Exaggerated expressions

Repetitive movement

Unnatural head movement

Facial freezing

Random gestures

Do not add movement merely to make the presenter appear active.

### V67 Scene Transitions

During STATE A, unnecessary scene transitions should be avoided.

If an approved transition is used, keep it subtle.

Acceptable examples may include:

Cut

Gentle fade when it does not violate state separation

Very short transition

Avoid:

Spinning

Flash transitions

Large zooms

Glitch effects

Excessive wipes

Social-media-style transition effects

For the transition from STATE A to STATE B, the default is a hard cut.

### V68 Brand Colors

Use approved client brand colors only where appropriate.

Approved brand colors may be used for:

Thumbnail

Player

Other explicitly configured branding surfaces

Do not use brand colors to override fixed caption requirements.

Captions remain:

white text

black background

STATE B remains:

#FFFFFF background

Do not:

Guess brand colors

Scrape random websites for colors

Use another client's palette

Generate arbitrary brand colors

### V69 General Typography

Use a consistent typography system.

Prefer:

Clean sans-serif fonts

Strong readability

Consistent weights

Consistent spacing

Avoid:

Decorative fonts

Excessive font combinations

Tiny text

Poor contrast

Caption-specific typography rules take priority over general typography preferences.

STATE B typography rules apply specifically to the end card.

### V70 Contrast

All text must remain readable.

STATE A caption contrast is fixed through:

#FFFFFF text

+

#000000 opaque or effectively opaque background

STATE B uses dark text against the required white background.

Do not solve layout problems by making text excessively large, excessively bold, or visually distracting.

### V71 Thumbnail Requirement

Every generated video should have a thumbnail.

The thumbnail should communicate the topic quickly.

Use:

Presenter from the actual video

Correct client logo

Approved client brand colors

Short question/topic text

The thumbnail should visually correspond to the actual video.

Do not use an unrelated person or unrelated image.

### V72 Thumbnail Text

Keep thumbnail text short.

Recommended:

3 to 6 words

Use a concise portion of the selected question or topic.

Do not use the full article title when it becomes difficult to read.

Do not create clickbait that changes the meaning of the selected video question.

The prohibition on static question/title overlays during STATE A does not prohibit topic text on the thumbnail.

### V73 Thumbnail Presenter

The thumbnail should use the same generic presenter selected for the corresponding video.

Do not introduce another person's likeness.

Do not use:

Real client likeness

Attorney likeness

Celebrity likeness

Public figure

Random third-party person

### V74 Thumbnail Branding

Use only approved branding for the correct client.

Do not place technology-provider branding on the thumbnail.

Do not add:

HeyGen

Descript

ElevenLabs

Microsoft

OpenAI

Other provider logos

### V75 Thumbnail Composition

Prioritize:

Presenter

Short question/topic

Client branding

Keep the thumbnail clean.

Do not make the logo or topic text overwhelm the presenter's face.

### V76 Video Player

Build the application's own video player.

The player should support:

Play

Pause

Seek

Volume

Fullscreen

Current time

Duration

Loading state

Error state

Poster/thumbnail

Caption controls where applicable

The player interface should be responsive.

The rendered video itself remains 9:16.

Do not unnecessarily expose generation providers.

### V77 Video Player Appearance

The player may use:

Client logo

Client colors

Client name

Avoid:

Third-party branding

Provider watermarks

Unnecessary controls

Visually noisy interface design

The player should feel like part of the application's own product.

### V78 No Third-Party Branding

Do not intentionally place technology-provider logos inside the generated video.

Do not add provider logos merely because their technology was used.

This includes:

HeyGen

Descript

ElevenLabs

Microsoft

OpenAI

Other generation-provider branding

### V79 Watermarks

Do not intentionally add technology-provider watermarks.

Do not add an internal product watermark unless explicitly required by approved product configuration.

If a provider automatically adds a watermark because of a specific plan or API configuration, identify that limitation rather than attempting to hide or manipulate it improperly.

### V80 Branding Consistency

Never mix assets from different clients.

For example:

Client A logo

+

Client B address

+

Client C phone number

is an automatic failure.

The approved logo comes from the correct client configuration.

Article-specific contact information comes from the resolved source-article information.

The target URL comes from the approved target URL input.

Avatar consistency applies within each individual video.

Different videos for the same client may use different eligible approved generic presenters.

### V81 Visual Cleanliness

Every visible element should have a clear purpose.

Do not fill empty space with:

Decorative shapes

Random icons

Stock images

Animated particles

Fake charts

Generic AI graphics

Supporting visuals

Additional marketing copy

During STATE A, the scene itself fills the complete frame.

During STATE B, intentional white space is acceptable and expected.

### V82 Animation Rules

Animation should be restrained and purposeful.

Acceptable:

Caption appearance

Minimal logo appearance when first rendered

Subtle scene transition where appropriate

Avoid:

Constant movement

Pulsing logos

Flashing text

Random zooming

Spinning objects

Excessive kinetic typography

The viewer should concentrate on the presenter and spoken answer.

### V83 No Hallucinated Visual Information

The system must never fabricate:

Client names

Attorney identities

Addresses

Phone numbers

Website URLs

Logos

Brand colors

Real-person identities

Presenter identities outside the approved generic presenter pool

Quotes

Statistics

Charts

Screenshots

Reviews

Locations

Provider capabilities

Avatar IDs

Provider assets

When information is unavailable:

Use an explicitly approved fallback when one exists

Otherwise flag for review

Never guess.

### V84 Error Handling

If a required visual asset is missing, do not invent one.

If the clean client logo is missing:

flag MISSING_CLEAN_LOGO_ASSET

If required STATE B information is missing:

flag MISSING_REQUIRED_END_CARD_DATA

If an avatar fails, do not silently substitute an unapproved person.

If a provider behaves differently from expected, do not invent unsupported API parameters or provider capabilities.

If required visual quality cannot be achieved, flag the video rather than accepting a visibly broken result.

### V85 Deterministic Regeneration

Once a specific video has been created, ordinary regeneration should preserve:

Selected avatar

Selected voice

Client logo

Layout

9:16 aspect ratio

Caption style

Logo size/position

Thumbnail style

STATE B layout

Do not randomly change the visual identity during ordinary regeneration of the same video.

This does not mean every newly generated video for the same client must use the same avatar or voice.

Each newly generated video may run avatar and voice selection again according to the approved rules.

### V86 Quality Control - Presenter

Before marking a video ready, verify:

Presenter is visible during STATE A

Presenter comes from the approved generic avatar pool

Gender-selection rules were followed when applicable

Gender was not guessed from name or appearance

Avatar variation rules were followed

Same presenter remains throughout STATE A

Face is not distorted

Eyes are not distorted

Mouth is not distorted

No identity drift occurs

No unexpected avatar switching occurs

Presenter is head-to-upper-torso

Presenter is visually dominant

Presenter is not waist-up or full-body

Presenter is not face-only

Presenter is not covered by logo

Presenter is not covered by captions

### V87 Quality Control - Full-Frame Scene

Verify:

Output is 9:16

Scene covers 100% of STATE A

No inset-video rectangle exists

No filler canvas is visible

No letterboxing exists

No pillarboxing exists

No blurred sidebar exists

No separate caption band exists

No separate logo/header region exists beyond the compact V28 contrast background

Talking-person environment fills the complete frame

Source aspect ratio was not distorted

Any failure makes STATE A non-compliant.

### V88 Quality Control - Logo

Verify during STATE A:

Correct client logo

Clean logo-only asset

No address embedded as a separate contact field

No phone number embedded as a separate contact field

No URL embedded as a separate contact field

Logo is upper-right

Right margin is approximately 4%

Top margin is approximately 3% to 4%

Width is approximately 32% to 38%

Preferred width is approximately 35%

Dark logo uses a white background

White or light logo uses a dark background

Contrast background is compact, padded, and present in STATE A, thumbnail, and STATE B

Aspect ratio is preserved

Logo remains completely inside the frame

Logo does not cover the presenter face

Logo remains visually subordinate to the presenter

Verify during STATE B:

Correct logo remains upper-right

Same positioning logic is used

Same approximate scale is used

Logo does not replace the separate Name field

### V89 Quality Control - Captions

Verify:

Every spoken portion has corresponding captions

Caption timing follows actual audio

Text is #FFFFFF

Background is #000000

Black background is opaque or effectively opaque

Caption block is content-driven rather than full-width by default

Preferred width does not exceed 75%

Hard width does not exceed 84%

Maximum is normally two visible lines

Font remains readable

Font was not excessively reduced to fit text

Captions are horizontally centered

Caption center is approximately 89% to 92% vertically

Bottom of caption block is approximately 5% to 7% above frame bottom

Captions remain over the full-screen scene

No separate blank caption area exists

Captions do not cover the primary face area

Normal captions are not forcibly converted to ALL CAPS

No caption remains after its corresponding speech

### V90 Quality Control - Audio and Lip Sync

Verify:

Approved voiceover exists

Audio plays correctly

No unexpected silence

No background music

No accidental source audio

Audio and visual durations align

Speech and mouth movement align

No obvious sync delay

No mouth movement during extended silence

No frozen mouth during speech

No severe facial artifacts

No unexpected voice change

No audio after the intended end of spoken content

### V91 Quality Control - STATE A Contact Information

Verify that during STATE A there is no separately rendered:

Address

Phone number

Target URL

Email

Contact-information block

NAP panel

Separately typeset company name used as contact information

The only allowed company-name text during STATE A is text intrinsically part of the official logo or wordmark.

### V92 Quality Control - STATE B

Verify:

STATE B exists

STATE B completely replaces STATE A

Background is exactly #FFFFFF

Speaker is absent

Talking scene is absent

Captions are absent

Logo is present

Logo is upper-right

Logo uses the required size and position

Name is present

Address is present

Phone Number is present

Target Website URL is present

Contact information is readable

Fields are in the correct order

Logo does not replace any contact field

No required field was guessed

No unrelated content appears

### V93 Quality Control - Article-Specific Identity

Verify article-specific contact information against the resolved values from the approved source article or Google Doc used for that video.

Check:

Rendered Name

=

Resolved source-article Name

Rendered Address

=

Resolved source-article Address

Rendered Phone

=

Resolved source-article Phone

Rendered article-specific location context

=

Resolved source-article context when applicable

Do not validate article-specific identity by selecting a different office from the general client configuration.

If a rendered article-specific value conflicts with the source article, fail the video.

The Target Website URL must match the approved target URL input.

### V94 Quality Control - Final Render

Check the completed file for:

Correct 9:16 aspect ratio

Correct resolution

Smooth playback

No black frames

No frozen frames

No corrupted frames

No visual flicker

No clipped graphics

No clipped logo

No clipped captions

No missing STATE A

No missing STATE B

Correct state transition

No STATE A and STATE B overlap

Correct final end-card frame

No unexpected branding animation

Correct thumbnail

A technically completed render can still fail visual validation.

### V95 Automatic Failure Conditions

Reject the output if any of these occurs:

Output is not 9:16

Talking-person scene appears as a smaller rectangle inside the frame

Visible filler exists around STATE A

Scene does not fill 100% of STATE A

contain behavior is used instead of cover/crop

Presenter is full-body

Presenter is waist-up instead of head-to-upper-torso

Presenter is face-only

Presenter is visually too small

Logo is not upper-right

Logo is stretched or distorted

Logo uses an unapproved client asset

STATE A logo contains separate address

STATE A logo contains separate phone number

STATE A logo contains target URL

STATE A logo appears as a business card or letterhead

Logo significantly violates the required scale without a justified collision constraint

Captions do not use white text and black background

Captions are outside the full-frame scene

Captions occupy a separate blank layout region

Caption text is excessively reduced instead of split

NAP appears during STATE A

Target URL appears as separate contact information during STATE A

Static question/title graphic appears during STATE A

Supporting visual appears during STATE A

STATE B is missing

STATE B contains the speaker

STATE B contains the talking-person scene

STATE B background is not plain #FFFFFF

STATE B logo is missing

STATE B logo is moved away from upper-right

Name is missing from STATE B

Address is missing from STATE B

Phone Number is missing from STATE B

Target Website URL is missing from STATE B

STATE B contact values were invented

Wrong office/contact information was substituted from client configuration

Another client's logo or branding appears

Background music appears

Voice changes unexpectedly within one video

Lip synchronization visibly fails

Render contains major presenter distortion

Render is technically complete but visibly broken

### V96 STATE A Reference Rendering Logic

Think:

CAMERA IMAGE

CAMERA IMAGE                     LOGO

CAMERA IMAGE

CAMERA IMAGE

HEAD

SHOULDERS

CHEST

UPPER TORSO

CAMERA IMAGE

CAPTIONS

CAMERA IMAGE

Do not think:

LOGO + CONTACT INFO

EMPTY CANVAS

[SMALL VIDEO]

EMPTY CANVAS

[CAPTIONS]

### V97 STATE B Reference Rendering Logic

Think:

+---------------------------------+

|                      +--------+ |

|                      |  LOGO  | |

|                      +--------+ |

|                                 |

|                                 |

|             NAME                |

|                                 |

|           ADDRESS               |

|                                 |

|        PHONE NUMBER             |

|                                 |

|      TARGET WEBSITE URL         |

|                                 |

+---------------------------------+

BACKGROUND = #FFFFFF

NO SPEAKER

NO TALKING SCENE

NO CAPTIONS

### V98 Reference Implementation Behavior

Behavioral pseudocode:

.main-state {

position: relative;

width: 100%;

height: 100%;

overflow: hidden;

}

.main-scene {

position: absolute;

inset: 0;

width: 100%;

height: 100%;

object-fit: cover;

}

.state-a-logo {

position: absolute;

top: 3% to 4%;

right: 4%;

width: approximately 35%;

preserve-aspect-ratio: true;

}

.captions {

position: absolute;

left: auto;

right: auto;

center-x: 50%;

center-y: approximately 89% to 92%;

max-width: 84%;

preferred-max-width: 75%;

text-align: center;

text-color: #FFFFFF;

background-color: #000000;

}

STATE B:

.end-card {

position: relative;

width: 100%;

height: 100%;

background: #FFFFFF;

}

.end-card-logo {

position: absolute;

top: 3% to 4%;

right: 4%;

width: approximately 35%;

preserve-aspect-ratio: true;

}

.end-card-contact-group {

position: absolute;

horizontally-centered: true;

display-order:

Name

Address

Phone

TargetURL

}

Do not implement STATE A using:

display: flex;

flex-direction: column;

justify-content: space-between;

when that creates separate logo, video, and caption regions.

Do not use:

object-fit: contain;

for the main talking-person scene.

The essential STATE A behavior is:

FULL-BLEED SCENE

+

ABSOLUTE LOGO OVERLAY

+

ABSOLUTE CAPTION OVERLAY

not:

STACKED CONTENT BLOCKS

### V99 Non-Negotiable Rules

STATE A is a full-frame 9:16 talking-person scene.

Never place the talking-person scene inside a smaller rectangle, card, panel, or blank canvas.

Use cover/crop rather than contain/pad for STATE A.

Frame the presenter from complete head through chest/upper torso.

Do not show the presenter full-body or waist-up.

The presenter must remain visually dominant.

Use one approved generic presenter per video.

Only a clean approved logo-only asset may appear in STATE A.

STATE A logo stays upper-right.

STATE A logo width should be approximately 32% to 38%, preferably about 35%.

Preserve the logo's original aspect ratio.

If the enlarged logo conflicts with the presenter's face, adjust presenter framing first.

Do not move the logo to another corner.

Do not automatically reduce the logo to the previous smaller size unless needed to resolve a collision.

No separate address, phone number, URL, or NAP block may appear during STATE A.

Captions must overlay the full-screen scene.

Captions must use white text and an opaque or effectively opaque black background.

Caption font size should be approximately 5.5% to 6.0% of frame width, preferably about 5.7%.

Caption width should preferably remain within 75% of the frame and must not exceed 84%.

Captions should normally use no more than two visible lines.

Do not continuously shrink caption text to fit excessive dialogue.

Do not create a static title/question graphic during STATE A.

Do not add supporting visuals during STATE A.

STATE B completely replaces STATE A.

STATE B background is plain #FFFFFF.

STATE B must display Logo, Name, Address, Phone Number, and Target Website URL.

The STATE B logo remains upper-right using the same positioning and approximate scale as STATE A.

The STATE B logo does not replace the separate Name field.

Never display STATE A and STATE B content simultaneously.

Use the approved source article or Google Doc for article-specific Name, Address, Phone, and geographic identity.

Do not substitute a different office from general client configuration.

Use only the approved supplied Target Website URL.

Use the approved client configuration for logo and other visual brand assets.

Do not fabricate missing information or assets.

Use no background music.

Use no unrelated third-party logos.

Synchronize the presenter to the approved generated voiceover.

Use actual voiceover timing for captions.

Keep the selected presenter and voice consistent within one video.

Run visual and technical quality checks before completion.

Do not mark a technically rendered but visibly broken video as successful.

### V100 Definition of Done

A video is visually complete only when it has:

Correct approved source association

+

Correct article-specific identity

+

Correct approved client logo

+

9:16 output

+

Full-frame STATE A talking-person scene

+

No inset video

+

No visible filler canvas

+

Approved automatically selected generic presenter

+

Gender-selection compliance when applicable

+

Presenter variation policy satisfied

+

Head-to-upper-torso framing

+

Presenter visually dominant

+

Natural presenter appearance

+

STATE A clean logo-only asset

+

STATE A logo upper-right

+

STATE A logo approximately 32% to 38% frame width

+

Automatic contrasting logo background

+

Logo aspect ratio preserved

+

No STATE A NAP

+

White captions

+

Black caption background

+

Readable caption sizing

+

Bottom-centered captions

+

No separate caption band

+

No static STATE A title graphic

+

No supporting visuals

+

Accurate lip synchronization

+

Approved automatically selected voice

+

Voice remains consistent

+

No background music

+

No unrelated logos

+

No fabricated information

+

Hard or mutually exclusive STATE A to STATE B transition

+

Plain white STATE B

+

STATE B upper-right logo

+

STATE B Name

+

STATE B Address

+

STATE B Phone Number

+

STATE B Target Website URL

+

Correct target URL

+

No speaker in STATE B

+

No captions in STATE B

+

High-quality thumbnail

+

Successful technical validation

+

Successful visual validation

The final result should look like a purpose-built, polished vertical informational video for the specific client and specific question.

STATE A should feel like a full-screen talking-person video, not a graphic template containing a video.

STATE B should feel like a clean professional contact end card.

The two states must remain visually and structurally separate.

