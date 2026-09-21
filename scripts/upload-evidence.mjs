// node --env-file=.env.local scripts/upload-evidence.mjs
import { put } from "@vercel/blob";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
const customer = process.argv[2] || "genentech";
if (!/^[a-z0-9-]+$/.test(customer)) throw new Error("Invalid customer slug.");
const dataset = process.argv[3] || "src/data/session.json";
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("Private Blob credentials are required.");
async function upload(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await upload(file);
    else {
      const pathname = file.replace(/^public\//, "");
      const contentType = {
        ".mp4": "video/mp4",
        ".jpg": "image/jpeg",
        ".png": "image/png",
      }[path.extname(file).toLowerCase()];
      if (!contentType) throw new Error(`Unsupported media type: ${file}`);
      await put(pathname, await readFile(file), {
        access: "private",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: true,
        contentType,
      });
      console.log("Uploaded", pathname);
    }
  }
}
await upload(`public/media/${customer}`);
for (const name of await readdir(`public/frames/${customer}`)) {
  await put(
    `media/${customer}/frames/${name}`,
    await readFile(`public/frames/${customer}/${name}`),
    {
      access: "private",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg",
    },
  );
}
const reviewBytes = await readFile(dataset);
const version = JSON.parse(reviewBytes.toString()).schemaVersion;
const reviewName = version ? `session-v${version}.json` : "session.json";
await put(`data/${customer}/${reviewName}`, reviewBytes, {
  access: "private",
  token,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
});
console.log("Uploaded private review data.");
