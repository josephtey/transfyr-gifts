# Transfyr customer reviews

A private video workspace built with Next.js and React: paired original/perception recordings, one chronological action log, and human-reviewed insight overlays. Dark mode, no dashboard.

## Run locally

```
npm install
cp .env.example .env.local
# Set SESSION_SECRET and a customer password in .env.local.
npm run dev
```

Open `http://localhost:3000/genentech`. Local evidence is intentionally excluded from this public repository. A fresh clone needs the customer's dataset at `src/data/session.json`, videos at `public/media/genentech/`, and stills at `public/frames/genentech/`; alternatively configure the private Blob store and `BLOB_MEDIA=1`.

`npm run build` checks types and builds production output. `npm test` runs the browser checks against a running local server. `TEST_BASE_URL` runs them against a deployment. Tests read the password from `.env.local`.

## Customer configuration

Register the slug, display name and password environment-variable name in `src/lib/customers.ts`, and its dataset filename in `src/lib/session.ts`. Each customer gets a distinct password and session audience. Dataset types are in `src/lib/types.ts`; authoring guidance is in `skills/transfyr-customer-review/references/dataset.md`.

The route is `/<customer>`. To use a customer subdomain, add your owned domain to the **personal Vercel project**, configure DNS, and set `CUSTOMER_HOSTS` to an explicit hostname-to-slug JSON map. The domain root then opens that customer's review. No custom domain is preconfigured.

## Private hosting

Deployment scope: **joe-5572**. Do not deploy to the Transfyr organization. Project: `transfyr-gifts`.

- Private Vercel Blob contains `media/<customer>/…` and `data/<customer>/session.json`.
- `BLOB_MEDIA=1` makes the server load review data privately and route media requests to authenticated handlers.
- A valid customer session is required to issue an exact-file, read-only Blob URL. URLs expire after one hour; anyone holding an issued URL can use it until expiry. The unsigned storage URLs deny access.
- The Blob CDN handles byte-range playback. Download requests stream through the authenticated route with an attachment filename.
- Customer stills also live in private Blob storage and use the same authorization layer. Images, videos, data and secrets stay out of public Git history. The Gemini key is local only.
- Password sessions last seven days. Login throttling is per function instance; add durable rate limiting before a larger public rollout. Changing the session secret revokes all sessions; changing only the password prevents new logins but does not revoke existing sessions.

Upload evidence from the source machine with `node --env-file=.env.local scripts/upload-evidence.mjs`. Deploy from that machine with `npx vercel --prod --scope joe-5572`. Customer evidence is already stored privately for production; the public repository intentionally does not contain it. Git builds can use the linked private Blob store, but the GitHub login connection must first be configured in the personal Vercel account.

## Reusable skills

`skills/craft-design` contains the reusable Craft design guidance and primary-source map. `skills/transfyr-customer-review` contains the evidence, media, customer isolation and verification workflow. Both are also installed in the author's local Codex skills folder.

## Evidence handling

The human review is primary. AI activity is preserved as model-generated description, including uncertainty and disagreements. Grouped moment boundaries are editorial. Browser recordings are compressed derivatives of the original sources, not the full-size source masters. Neither visible pipette settings nor model descriptions establish actual volumes or final concentrations.
