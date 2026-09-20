<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## User preferences for this project

- The current review is an explanation of the reported result. Show the supplied outcome metrics as callouts anchored to their percentile dots, without a narrative header summary. Show meaningful grouped operations within all protocol stages, and only findings that contribute to the supplied explanation. No Major/Minor filters or labels. Keep all original AI actions, human review cells and excluded findings in the private audit. Do not relabel reported variability as a calculated CV or imply quantitative causal attribution. Leaderboard context must state rank and cohort size; a performance percentile is the share of entries ranked below this entry, with higher better. Use separate horizontal percentile scales for accuracy and replicate variability when independent cohort ranks are available. Never reuse the overall rank for both. When the user accepts image-based approximation, round the separate estimates, label their source, and do not imply exact ranks.
- Dark mode, unbranded, video beside a single scrolling step-and-finding timeline. Use “System of Record” for neutral step summaries; human interpretation belongs in the findings. Draw restrained, animated connections from each step to its findings. Clicking a step or finding plays the corresponding interval. Follow playback at the grouped-operation level. All steps start expanded; show counts of displayed findings and durations on the right. Manual expansion anchors to that step without seeking.
- The current grouped step title stays at the top of the video; do not overlay atomic-action sentences. Hide it outside grouped intervals. Findings and full descriptions stay below the scrubber without dismiss controls. Scrubber markers and chapters reflect only the explanation. Start paused at the first included error; explicit timestamps including zero override that default.
- Perception switches must retain time, playing/paused state, speed, volume, mute and clip boundaries. Keep the old decoded frame visible until the alternate recording has sought and decoded its matching frame, then crossfade; respect reduced motion. Suppress inactive-video events so they cannot reset the playhead. Guard rapid switches and preserve playback on failure.
- Errors red, risks yellow, observations blue. Never use priority or selection to change category colors. Preserve conditional language about uncertain volumes, filter wetting and proposed causal mechanisms.
- The previous fine-grained review is frozen at `/<customer>/archive`, with its original source component, dataset, filters and action log. Keep this route and all its evidence under the same password gate. Do not let current-data updates mutate the archive.
- Access screen: one password input, Enter submits. No branding, customer names, downloads, copy-link or logout/exit controls. Attachment-download requests remain disabled.
- Vercel deployments target personal `joe-5572` only, never the Transfyr team. The GitHub repo is public: customer evidence, result explanations, ingestion scripts and secrets stay out of Git.
