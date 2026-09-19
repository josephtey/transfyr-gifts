// Run manually: node --env-file=.env scripts/review-video.mjs
// API key stays in this local process; only the written review enters the repo.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const videoPath = process.argv[2] || "public/media/genentech/original.mp4";
const notesPath = process.argv[3] || "genentech/Chris Bakan Run - Sheet1.csv";
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("Set GEMINI_API_KEY in .env.");
const base = "https://generativelanguage.googleapis.com";
const headers = { "x-goog-api-key": key };
async function checked(r) {
  if (!r.ok)
    throw new Error(
      `Gemini request failed (${r.status}): ${(await r.text()).slice(0, 600)}`,
    );
  return r;
}
const models = await (
  await checked(await fetch(`${base}/v1beta/models`, { headers }))
).json();
const names = models.models.map((x) => x.name);
const model = [
  "models/gemini-3.1-pro-preview",
  "models/gemini-3-flash-preview",
].find((x) => names.includes(x));
if (!model) throw new Error("No supported video-review model available.");
console.log("Review model:", model);
const bytes = await readFile(videoPath);
const start = await checked(
  await fetch(`${base}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": "video/mp4",
    },
    body: JSON.stringify({
      file: { display_name: "Genentech calibration review" },
    }),
  }),
);
let { file } = await (
  await checked(
    await fetch(start.headers.get("x-goog-upload-url"), {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: bytes,
    }),
  )
).json();
console.log("Uploaded video; processing.");
try {
  const deadline = Date.now() + 300000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    file = await (
      await checked(await fetch(`${base}/v1beta/${file.name}`, { headers }))
    ).json();
  }
  if (file.state !== "ACTIVE")
    throw new Error("Video processing did not complete.");
  const notes = await readFile(notesPath, "utf8");
  const prompt = `Review this full egocentric calibration video against the human reviewer notes below. The human review is the primary adjudicator. Check temporal alignment and visually inspect the key moments identified in the notes. Do not assert exact volume, plunger stop, filter wetness, concentration or contamination if not visually resolvable. Do not invent or infer tube identities when ambiguous. Protocol: arrange 8 tubes with QR-top tube for Calibration 3; in duplicate, Calibration 1 1:1 from BSA stock, Calibration 2 1:1 from Calibration 1, Calibration 3 1:10 from Calibration 2; blanks water only; 0.45 mL stock available; keep Cal3 and blanks. Also check for clearly visible bubbles in pipette tips: give a short list of specific timestamps only where bubbles are visually resolvable; do not equate filter wetting with bubbles or claim exhaustive detection. Return concise Markdown with timestamp alignment, observations you can corroborate, claims requiring human expertise, discrepancies and coverage limitations (including blanks/cleanup). Exact human rows:\n${notes}`;
  const response = await (
    await checked(
      await fetch(`${base}/v1beta/${model}:generateContent`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { file_data: { mime_type: "video/mp4", file_uri: file.uri } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 6000 },
        }),
      }),
    )
  ).json();
  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("\n");
  if (!text) throw new Error("No review text returned.");
  await mkdir("review", { recursive: true });
  await writeFile(
    "review/gemini-cross-check.md",
    `# Video cross-check\n\nModel: ${model}. Input: full compressed original video. Automated corroboration, not replacement of human adjudication.\n\n${text}\n`,
  );
  console.log("Saved review/gemini-cross-check.md");
} finally {
  await fetch(`${base}/v1beta/${file.name}`, { method: "DELETE", headers });
}
