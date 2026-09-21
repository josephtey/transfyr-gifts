import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import type { Session, ArchivedSession } from "./types";
// Evidence is read on the server, after authentication. New customers use their own
// dataset file and protected media folder; no evidence is bundled into client JS.
const files: Record<string, { current: string; archive: string }> = {
  genentech: { current: "session.json", archive: "session-archive.json" },
};
export async function loadSession(customer: string): Promise<Session> {
  return loadDataset<Session>(
    customer,
    files[customer]?.current,
    "session-v8.json",
  );
}
export async function loadArchivedSession(
  customer: string,
): Promise<ArchivedSession> {
  return loadDataset<ArchivedSession>(
    customer,
    files[customer]?.archive,
    "session-archive-2026-09-20.json",
  );
}
async function loadDataset<T>(
  customer: string,
  localFile: string,
  blobFile: string,
): Promise<T> {
  if (!files[customer]) throw new Error("Unknown customer");
  if (process.env.BLOB_MEDIA === "1") {
    const result = await get(`data/${customer}/${blobFile}`, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200)
      throw new Error("Review data unavailable");
    return new Response(result.stream).json();
  }
  return JSON.parse(
    await readFile(path.join(process.cwd(), "src/data", localFile), "utf8"),
  );
}
