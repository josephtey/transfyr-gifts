# Transfyr customer reviews

A private, result-led video review built with Next.js and React. Original AI actions are grouped into meaningful operations within the complete protocol. The supplied outcome explanation determines which findings appear beside those records. Reported result metrics and optional overall leaderboard rank/percentile appear above the recording. Percentiles use the share of entries ranked below the current entry. Each measurement can show its own horizontal percentile scale from independent ranks, or clearly labeled visual estimates when the user accepts approximation. An overall rank cannot substitute for those ranks. The full AI log and original adjudications remain in the private dataset; the current grouped step title appears over the video, while the selected finding and its details appear below it. There are no severity filters.

Original and perception videos stay mounted. Switching holds the old frame until the alternate source is ready at the same timestamp, then crossfades while preserving playback, speed, volume, mute and clip boundaries. The unbranded access page remains a single password field.

The previous fine-grained experience is preserved at `/<customer>/archive`, with a frozen private dataset and its original Major/Minor filters. The same password protects both views. The archive URL survives the login redirect.

## Run locally

```
npm install
cp .env.example .env.local
# Set SESSION_SECRET and a customer password in .env.local.
npm run dev
```

Open `http://localhost:3000/genentech`. Local evidence is intentionally excluded from this public repository. A fresh clone needs the customer's dataset at `src/data/session.json`, videos at `public/media/genentech/`, and stills at `public/frames/genentech/`; alternatively configure the private Blob store and `BLOB_MEDIA=1`.

`npm run test:data` verifies source preservation, review coverage, and count deduplication against the private evidence files. `npm run build` checks types and builds production output. `npm test` runs the browser checks against a running local server. `TEST_BASE_URL` runs them against a deployment. Tests read the password from `.env.local`.

## Customer configuration

Register the slug, display name and password environment-variable name in `src/lib/customers.ts`, and its dataset filename in `src/lib/session.ts`. Each customer gets a distinct password and session audience. Dataset types are in `src/lib/types.ts`; authoring guidance is in `skills/transfyr-customer-review/references/dataset.md`.

The route is `/<customer>`. To use a customer subdomain, add your owned domain to the **personal Vercel project**, configure DNS, and set `CUSTOMER_HOSTS` to an explicit hostname-to-slug JSON map. The domain root then opens that customer's review. No custom domain is preconfigured.

## Private hosting

Deployment scope: **joe-5572**. Do not deploy to the Transfyr organization. Project: `transfyr-gifts`.

- Private Vercel Blob contains `media/<customer>/…` and `data/<customer>/session-v8.json`. The frozen previous version uses `data/<customer>/session-archive-2026-09-20.json`; locally it is `src/data/session-archive.json`. Archive data is also excluded from Git and deployment uploads.
- `BLOB_MEDIA=1` makes the server load review data privately and route media requests to authenticated handlers.
- A valid customer session is required to issue an exact-file, read-only Blob URL. URLs expire after one hour; anyone holding an issued URL can use it until expiry. The unsigned storage URLs deny access.
- The Blob CDN handles byte-range playback. Attachment-download requests are disabled.
- Customer stills also live in private Blob storage and use the same authorization layer. Images, videos, data and secrets stay out of public Git history. The Gemini key is local only.
- Password sessions last seven days. Login throttling is per function instance; add durable rate limiting before a larger public rollout. Changing the session secret revokes all sessions; changing only the password prevents new logins but does not revoke existing sessions.

Upload evidence from the source machine with `node --env-file=.env.local scripts/upload-evidence.mjs`. Deploy from that machine with `npx vercel --prod --scope joe-5572`. Customer evidence is already stored privately for production; the public repository intentionally does not contain it. Git builds can use the linked private Blob store, but the GitHub login connection must first be configured in the personal Vercel account.

## Reusable skills

`skills/craft-design` contains the reusable Craft design guidance and primary-source map. `skills/transfyr-customer-review` contains the evidence, media, customer isolation and verification workflow. `skills/joe-interface-style` captures the user's preferred dark, minimal interfaces, direct interactions, consistent category colors and motion that preserves context. All three are also installed in the author's local Codex skills folder.

## Evidence handling

The human review is primary. Exact AI text, original intervals and human-row mappings remain in the private audit; the System of Record displays neutral step summaries tied to original AI intervals and the findings contain human adjudication, without editing history or correction badges. Every finding is linked to its supporting actions, with separate context links for sequence-level evidence. Stage counts describe the displayed findings; many source actions can support one finding without inflating its count. Clip boundaries are editorial. Browser recordings are compressed derivatives of the original sources, not the full-size source masters. Neither visible pipette settings nor model descriptions establish actual volumes or final concentrations.
