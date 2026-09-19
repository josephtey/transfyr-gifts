---
name: transfyr-customer-review
description: Build a minimal, private customer review experience from paired first-person and perception-overlay recordings, AI action annotations, and human calibration-challenge notes. Use for Transfyr customer gifts and similar synchronized video reviews, including preparing media and customer-specific deployment.
---

# Transfyr customer review

Build an intimate video review, with the recording as the primary experience. The recurring inputs are an original egocentric recording, a perception-overlay version of the same session, model-generated action annotations, a human reviewer sheet, and the intended challenge protocol. Inspect what is already present before asking for inputs.

## Evidence comes first

- Use the supplied human review as the primary adjudicator unless the user explicitly chooses otherwise. Keep AI action descriptions labeled and distinct from the human insights; these descriptions are not an audio transcript.
- Preserve timestamps and original reviewer text. An untimed continuation may inherit the preceding timestamp for navigation, but mark that timing as inherited. Never assign untimed run summaries an exact observation time.
- Collapse a long review into a manageable set of meaningful moments. Each needs a plain-language observation, its bounded implication, original source rows, and an editorial viewing interval. Give clips a little context before and after the moment; do not present those boundaries as source annotations.
- Resolve contradictory source labels where evidence permits. Otherwise preserve the uncertainty rather than silently selecting a tube, reagent, or volume. A pipette setting is not a measurement of delivered liquid. A contamination risk is not confirmed contamination. Do not infer final concentrations, causes of assay outcomes, or completion of blanks/cleanup without evidence.
- If the user authorizes Gemini and provides credentials, use native video input from a local script. Read keys from a gitignored environment file, never from browser code. Verify currently supported models rather than assuming a legacy model works. Use the model to corroborate timestamps and visible actions; retain the human adjudication and report limitations. Do not describe sampled/model review as exhaustive visual verification.
- Optional bubble montages need visually identifiable bubbles, not just filter-wetting notes or model guesses. Skip or label uncertain candidates if the imagery is insufficient.

## Experience

For this user, default to dark mode and a minimal video-first workspace: large video on the left, one continuous chronological action log on the right. Highlight human-reviewed actions within that same log and show the insight as a simple video overlay. No separate activity/highlight tabs, overview sections, cards, chapters or decorative copy. Keep essential playback controls and a single perception toggle. Put infrequent downloads and sharing in a small overflow menu. Preserve a later explicit visual direction if it changes this preference.

Keep original/perception switching at the same timestamp, speed, audio state, and play/pause state. The files must actually share a timebase; inspect metadata and matched frames. Ensure annotation gaps show no active action and do not carry the previous caption indefinitely. Selecting a moment seeks there; watching a clip adds lead-in and pauses after the editorial end. Share links preserve the timestamp through login. Freeze frames are evidence context, not proof of an invisible plunger stop or liquid volume.

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
