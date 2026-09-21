---
name: transfyr-customer-review
description: Build a minimal, private customer review experience from paired first-person and perception-overlay recordings, AI action annotations, and human calibration-challenge notes. Use for Transfyr customer gifts and similar synchronized video reviews, including preparing media and customer-specific deployment.
---

# Transfyr customer review

Build an intimate video review, with the recording as the primary experience. The recurring inputs are an original egocentric recording, a perception-overlay version of the same session, model-generated action annotations, a human reviewer sheet, and the intended challenge protocol. Inspect what is already present before asking for inputs.

## Evidence comes first

- Use the supplied human review as the primary adjudicator unless the user explicitly chooses otherwise. Keep source AI descriptions distinct from human findings in the evidence record; action descriptions are not an audio transcript.
- Preserve timestamps and original reviewer text. An untimed continuation may inherit the preceding timestamp for navigation, but mark that timing as inherited. Never assign untimed run summaries an exact observation time.
- Keep the exact AI atomic-action text, interval, ontology ID and source pointer in the private audit. In the detailed view, display the exact AI action text. In result-led mode, group consecutive AI actions into meaningful operations within the protocol stages, retaining the exact AI text in the private source record. Human adjudications such as second-stop use, wet filters, transfer failure or bubbles belong in the findings on the right, not synthesized into the AI action sentences. Do not show editing history or correction labels. Do not add extra machine-log rows for editorial summaries. Link each human step and clear-error cell to one primary AI action with optional context actions. Use the step column to verify the human-to-AI mapping and the error column for classified findings. If timestamps disagree, match the described activity cautiously and record the offset or unresolved correspondence privately. Preserve substantive uncertainty in customer copy without discussing the editing process.
- Group errors across actions with explicit many-to-many links. Distinguish errors, contamination risks and observations such as bubbles or uncertain volumes. Preserve every source error cell and run-level summary privately, including a reason when withholding an unsupported finding; omitted steps need sequence context, not fabricated exact timestamps. Counts must state their denominator and deduplicate source notes shared across categories. Give action clips context before and after, and label those boundaries as editorial.
- Resolve contradictory source labels where evidence permits. Otherwise preserve the uncertainty rather than silently selecting a tube, reagent, or volume. A pipette setting is not a measurement of delivered liquid. A contamination risk is not confirmed contamination. Do not infer final concentrations, causes of assay outcomes, or completion of blanks/cleanup without evidence.
- Check scientific interpretation against the supplied protocol and primary manufacturer guidance. Human notes are evidence, not infallible classifications. Second-stop dispensing can be normal forward blowout, and second-stop aspiration can be valid reverse pipetting. A ratio-only protocol does not require an invented fixed aliquot. Repeated same-source aspiration/dispensing can be tip pre-wetting. Do not diagnose wet filters, bubbles, or overdelivery from difficult transfers alone. Treat omission of final mixing as a uniformity risk when later sampling is not shown; distinguish it from taking a dilution aliquot without first homogenizing a freshly diluted sample. Keep uncertainty concise in the finding itself; do not present unresolved notes as visually confirmed errors. Tier expresses review priority independently of confidence. Honor the user’s requested Major grouping, including qualified findings from their summary. Preserve scientific cautions and original source links privately.
- If the user authorizes Gemini and provides credentials, use native video input from a local script. Read keys from a gitignored environment file, never from browser code. Verify currently supported models rather than assuming a legacy model works. Use the model to corroborate timestamps and visible actions; retain the human adjudication and report limitations. Do not describe sampled/model review as exhaustive visual verification.
- Optional bubble montages need visually identifiable bubbles, not just filter-wetting notes or model guesses. Skip or label uncertain candidates if the imagery is insufficient.

## Experience

For this user, use a dark, unbranded video review beside one shared scrolling timeline. Error accents are red, risks yellow and observations blue, with category labels. Findings travel with their execution records and use short connected lines rather than crossing curves. Use one “What happened?” heading above the shared timeline, without separate action and finding column labels. Clicking a record or finding plays the corresponding interval. Animate connections as they enter view; respect reduced motion. Do not show correction history, source-row explanations, linked-action counts or extra play buttons.

### Result-led review

When the user supplies an outcome explanation, use it to select the customer-facing findings. Present the supplied result metrics without inventing their statistical definition. If a leaderboard is supplied, verify the highlighted rank and total entries. An approximate overall performance percentile can use 100 × (total − rank) / total, with higher better; state the rank and denominator and do not imply separate accuracy or variability percentiles. Show neutral grouped operations under every protocol stage: instrument preparation, transfers, water additions and finishing operations should remain distinguishable. Keep unknown stages untimed and avoid claiming completion without evidence; retain the full AI actions, original human notes and excluded findings privately. Interpretive errors and causal hypotheses belong in the finding descriptions. Preserve uncertainty about volumes and mechanisms: second-stop use alone does not establish overdelivery. Do not claim quantitative attribution of the measured result.

Do not show Major/Minor controls in this mode. The explanation alone defines the visible set. Counts represent the displayed findings, not every underlying source cell. Show durations and counts beside each step heading, with all steps initially expanded. Clicking a stage title or scrubber chapter seeks and plays its interval. Opening a chevron anchors scrolling to that stage without seeking. Follow the current grouped operation during playback, rather than every fine-grained hand movement.

Keep the current grouped step title at the top of the video independently of findings. Do not overlay atomic-action prose. Hide the overlay outside grouped intervals without an empty-state message. Keep the selected finding and full description below the scrubber with no dismiss control. Begin paused at the first included error, while honoring explicit deep-link timestamps, including zero. Keep chapter labels quiet; show only the explanation's event markers, and use a chapter indicator for a run-level omission rather than an invented point timestamp or long colored band.

### Media interaction and access

Preserve original/perception timestamp, play/pause state, speed, volume, mute and contextual clip boundaries. Keep both media elements mounted. Hold the displayed decoded frame until the alternate source has sought and decoded the matching timestamp, then crossfade. Ignore inactive-video events; they must never reset the playhead or scroll position. Guard repeated switches, handle delayed metadata and failure, and respect reduced motion. Inspect the timebases before assuming the recordings align.

The access screen contains only a password input, submitted with Enter; show a failed entry through the field. Do not add company/customer branding, download or copy-link controls. A quiet Exit button signs out to the password input, whose border and focus outline are hidden while focused. Disable attachment-download requests.

### Preserve an earlier version

When asked to save an older version, freeze its view component and dataset behind an authenticated archive route. Preserve the original fine-grained records, findings and filters there rather than making the archive depend on current data. Ensure login returns to the archive URL and that evidence remains private. An archive may use the earlier Major/Minor mode while the new result-led view uses no tiers. Do not add navigation clutter unless requested; return both links at handover.

Use the [dataset contract](references/dataset.md) to retain source-level provenance beneath the presentation. Keep customer result metrics, explanations, names and media out of public source and reusable components.

## Media and privacy

Inspect durations, codecs, dimensions, and audio tracks before encoding. Browser copies should use H.264/AAC and MP4 faststart. Preserve the source masters locally; label compressed downloads as browser-optimized. Overlay exports may lack audio; only reuse the original audio when time alignment is verified. Generate actual downloadable clips and stills from the same timestamps used by the UI.

For multiple customers, use explicit customer slugs and host mappings, not arbitrary host-prefix inference. Configure a unique server-side password per customer, signed scoped sessions, and authentication on both the page/data and every media path. Do not ship secrets or review JSON in a public JS bundle.

Use private storage for video, and issue exact-file, read-only, expiring links only after authentication. Keep review JSON private too. Ensure static image optimization or alternate file paths do not bypass authentication. Test denied requests without a session, legitimate range requests, and cross-customer denial.

Before pushing, inspect repository visibility. Keep customer evidence and customer-specific ingestion scripts out of public Git history. A public source repo can deploy with data fetched privately on the server. Ignore keys, local authentication state, generated screenshots and source recordings.

## Verify and hand over

Verify desktop and narrow layouts with actual media; test login failure/success, a deep link through login, seeking, active captions, mode switching while paused and playing, clip boundaries, freeze-frame close/focus, removed download/share controls, working Exit/sign-out, password submission with Enter, and denied direct media requests. Check the production URL too: a local pass does not prove hosted range requests or private storage work.

Deployment requires the user's authorization. Honor the requested account and scope. Explicitly verify the linked project and owner; never fall back to an organizational/team account when a personal account is requested. Keep custom domains as explicit configuration; do not claim a subdomain exists before DNS and Vercel configuration are completed.

Return the working URL, access information, and the few meaningful remaining limitations. Distinguish a local preview, live deployment, source push and automatic Git integration. A failed Git integration does not imply the site itself cannot deploy through the CLI.
