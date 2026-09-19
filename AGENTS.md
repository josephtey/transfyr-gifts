<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## User preferences for this project

- Dark mode: video beside a single scrolling action-and-finding timeline. Findings travel with their actions; draw persistent connectors with short branches joining a shared rail per finding. Avoid crossing diagonal curves; keep background paths subdued and the current relationship clear. Use the heading “System of Record” and no right-column heading. Clicking an action or finding plays the corresponding clip directly. Draw connector lines into view, then reveal findings; respect reduced motion. Show a live playhead and progress on the actual current action, and scroll the shared timeline with playback. System of Record must display the exact AI actions. Human adjudications, including second-stop use, filter wetting and failed transfers, belong only in the findings on the right. Omit correction badges, source/audit explanations, linked-action counts, timestamp lists, or extra buttons. Keep the underlying AI record and human mapping intact privately. Put the active insight below the scrubber. Retain the deduplicated error-note count at the top.
- Protocol stages are manually segmented from observed work, start collapsed, and show durations plus error/observation/risk counts. Step titles and scrubber chapters seek; chevrons only expand/collapse. Unknown stages have no invented time. Default to supported major findings and contamination risks with one “Show more” toggle. Counts, highlights, and finding placement must use the same visible tier and explicit step ownership; context links cannot cause zero-count steps to display errors. Withhold scientifically unsupported claims privately, even in the expanded tier.
- Category colors are invariant: observations blue, errors red, risks yellow. Selection and playback retain the category color on actions, findings, connectors, and overlays.
- Vercel deployments must target the personal `joe-5572` scope. Never use the Transfyr team.
- This GitHub repo is public. Customer videos, review data, environment files and evidence-derived ingestion code stay out of Git.
- Human notes are the primary adjudication; keep AI action descriptions distinguishable.
