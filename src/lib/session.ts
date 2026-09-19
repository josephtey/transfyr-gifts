import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import type { Session } from "./types";
// Evidence is read on the server, after authentication. New customers use their own
// dataset file and protected media folder; no evidence is bundled into client JS.
const files: Record<string, string> = { genentech: "session.json" };
export async function loadSession(customer: string): Promise<Session> {
  if (!files[customer]) throw new Error("Unknown customer");
  if (process.env.BLOB_MEDIA === "1") {
    const result = await get(`data/${customer}/session-v4.json`, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200)
      throw new Error("Review data unavailable");
    return new Response(result.stream).json();
  }
  return JSON.parse(
    await readFile(
      path.join(process.cwd(), "src/data", files[customer]),
      "utf8",
    ),
  );
}
