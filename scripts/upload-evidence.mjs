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
      await put(pathname, await readFile(file), {
        access: "private",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: true,
        contentType: "video/mp4",
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
await put(`data/${customer}/session.json`, await readFile(dataset), {
  access: "private",
  token,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
});
console.log("Uploaded private review data.");
