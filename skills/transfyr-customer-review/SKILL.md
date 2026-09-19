---
name: transfyr-customer-review
description: Build a minimal, private customer review experience from paired first-person and perception-overlay recordings, AI action annotations, and human calibration-challenge notes. Use for Transfyr customer gifts and similar synchronized video reviews, including preparing media and customer-specific deployment.
---

# Transfyr customer review

Build an intimate video review, with the recording as the primary experience. The recurring inputs are an original egocentric recording, a perception-overlay version of the same session, model-generated action annotations, a human reviewer sheet, and the intended challenge protocol. Inspect what is already present before asking for inputs.

## Evidence comes first

- Use the supplied human review as the primary adjudicator unless the user explicitly chooses otherwise. Keep source AI descriptions distinct from human findings in the evidence record; action descriptions are not an audio transcript.
- Preserve timestamps and original reviewer text. An untimed continuation may inherit the preceding timestamp for navigation, but mark that timing as inherited. Never assign untimed run summaries an exact observation time.
- Keep the exact AI atomic-action text, interval, ontology ID and source pointer in the private audit. For this customer-facing experience, the System of Record displays the exact AI action text. Human adjudications such as second-stop use, wet filters, transfer failure or bubbles belong in the findings on the right, not synthesized into the AI action sentences. Do not show editing history or correction labels. Do not add extra machine-log rows for editorial summaries. Link each human step and clear-error cell to one primary AI action with optional context actions. Use the step column to verify the human-to-AI mapping and the error column for classified findings. If timestamps disagree, match the described activity cautiously and record the offset or unresolved correspondence privately. Preserve substantive uncertainty in customer copy without discussing the editing process.
- Group errors across actions with explicit many-to-many links. Distinguish errors, contamination risks and observations such as bubbles or uncertain volumes. Preserve every source error cell and run-level summary; omitted steps need sequence context, not fabricated exact timestamps. Counts must state their denominator and deduplicate source notes shared across categories. Give action clips context before and after, and label those boundaries as editorial.
- Resolve contradictory source labels where evidence permits. Otherwise preserve the uncertainty rather than silently selecting a tube, reagent, or volume. A pipette setting is not a measurement of delivered liquid. A contamination risk is not confirmed contamination. Do not infer final concentrations, causes of assay outcomes, or completion of blanks/cleanup without evidence.
- If the user authorizes Gemini and provides credentials, use native video input from a local script. Read keys from a gitignored environment file, never from browser code. Verify currently supported models rather than assuming a legacy model works. Use the model to corroborate timestamps and visible actions; retain the human adjudication and report limitations. Do not describe sampled/model review as exhaustive visual verification.
- Optional bubble montages need visually identifiable bubbles, not just filter-wetting notes or model guesses. Skip or label uncertain candidates if the imagery is insufficient.

## Experience

For this user, default to dark mode: a video beside one scrolling timeline containing actions and their findings. Findings must travel with the relevant actions; never give the findings a separate scroll area. Draw persistent solid lines for evidence and dashed lines for sequence context, with stronger emphasis on hover or selection. Every action-to-finding relationship needs a line. A category spanning different parts of the recording can appear beside each relevant action group; this must not inflate the headline error count.

Show only the source AI actions, concise human findings and their connecting lines. Use coral for errors, amber for risks, and blue for observations, with category labels too. Omit correction badges, editing history, source-row explanations, linked-action counts, timestamp lists, and extra action buttons. Keep one headline count of distinct reviewed error notes. Use the heading “System of Record” with no right-column heading. Clicking an action plays its contextual clip and stops at its end; clicking a finding plays its first associated action in that segment. Show the current action with a live pointer and progress, and follow playback in the shared scroll area; place downloads in the recording menu. Put the current insight below the scrubber so it cannot cover the recording or playback controls. Animate the connecting line being drawn as a finding enters the shared scroll viewport, followed by a restrained finding reveal. Keep geometry anchors stationary while text animates, and honor reduced motion. Later explicit user direction takes precedence.

Keep original/perception switching at the same timestamp, speed, audio state, and play/pause state. The files must actually share a timebase; inspect metadata and matched frames. Ensure annotation gaps show no active action and do not carry the previous caption indefinitely. Selecting an action immediately plays its contextual clip with lead-in and pauses after the editorial end. Share links preserve the timestamp through login. Freeze frames are evidence context, not proof of an invisible plunger stop or liquid volume.

Use the [dataset contract](references/dataset.md) when shaping inputs. Keep customer text, summaries, paths, branding and media out of the reusable component. If the user plans their own introduction, make the editorial overview easy to replace.

## Media and privacy

Inspect durations, codecs, dimensions, and audio tracks before encoding. Browser copies should use H.264/AAC and MP4 faststart. Preserve the source masters locally; label compressed downloads as browser-optimized. Overlay exports may lack audio; only reuse the original audio when time alignment is verified. Generate actual downloadable clips and stills from the same timestamps used by the UI.

For multiple customers, use explicit customer slugs and host mappings, not arbitrary host-prefix inference. Configure a unique server-side password per customer, signed scoped sessions, and authentication on both the page/data and every media path. Do not ship secrets or review JSON in a public JS bundle.

Use private storage for video, and issue exact-file, read-only, expiring links only after authentication. Keep review JSON private too. Ensure static image optimization or alternate file paths do not bypass authentication. Test denied requests without a session, legitimate range requests, and cross-customer denial.

Before pushing, inspect repository visibility. Keep customer evidence and customer-specific ingestion scripts out of public Git history. A public source repo can deploy with data fetched privately on the server. Ignore keys, local authentication state, generated screenshots and source recordings.

## Verify and hand over

Verify desktop and narrow layouts with actual media; test login failure/success, a deep link through login, seeking, active captions, mode switching while paused and playing, clip boundaries, freeze-frame close/focus, downloads, logout, and denied direct media requests. Check the production URL too: a local pass does not prove hosted range requests or private storage work.

Deployment requires the user's authorization. Honor the requested account and scope. Explicitly verify the linked project and owner; never fall back to an organizational/team account when a personal account is requested. Keep custom domains as explicit configuration; do not claim a subdomain exists before DNS and Vercel configuration are completed.

Return the working URL, access information, and the few meaningful remaining limitations. Distinguish a local preview, live deployment, source push and automatic Git integration. A failed Git integration does not imply the site itself cannot deploy through the CLI.
