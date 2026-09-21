import { NextRequest, NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { customers } from "../../../../../lib/customers";
import { cookieName, verifySession } from "../../../../../lib/auth";
export const runtime = "nodejs";
export const maxDuration = 300;

type GitHubAsset = { name: string; url: string };

async function githubMediaRedirect(customer: string, assetName: string) {
  const repository = process.env.GITHUB_MEDIA_REPOSITORY;
  const token = process.env.GITHUB_MEDIA_TOKEN;
  const tag = process.env[`GITHUB_MEDIA_RELEASE_${customer.toUpperCase()}`];
  if (!repository || !token || !tag)
    return new NextResponse("Media unavailable", { status: 503 });

  const release = await fetch(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!release.ok)
    return new NextResponse("Media unavailable", { status: 503 });
  const assets = ((await release.json()) as { assets?: GitHubAsset[] }).assets;
  const asset = assets?.find((candidate) => candidate.name === assetName);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const download = await fetch(asset.url, {
    headers: {
      Accept: "application/octet-stream",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    cache: "no-store",
  });
  const location = download.headers.get("location");
  if (download.status !== 302 || !location)
    return new NextResponse("Media unavailable", { status: 503 });
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customer: string; asset: string[] }> },
) {
  const { customer, asset } = await params;
  if (
    !customers[customer] ||
    !asset.every((part) => /^[a-zA-Z0-9_-]+(?:\.(?:mp4|jpg|png))?$/.test(part))
  )
    return new NextResponse("Not found", { status: 404 });
  if (
    !(await verifySession(
      request.cookies.get(cookieName(customer))?.value,
      customer,
    ))
  )
    return new NextResponse("Authentication required", { status: 401 });
  if (request.nextUrl.searchParams.has("download"))
    return new NextResponse("Not found", { status: 404 });
  if (process.env.MEDIA_PROVIDER === "github") {
    if (asset.length !== 1)
      return new NextResponse("Not found", { status: 404 });
    return githubMediaRedirect(customer, asset[0]);
  }
  const pathname = `media/${customer}/${asset.join("/")}`;
  const expires = Date.now() + 60 * 60 * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil: expires,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  const { presignedUrl } = await presignUrl(token, {
    pathname,
    operation: "get",
    access: "private",
    validUntil: expires,
  });
  // Signed URLs are scoped to exactly one file and expire in one hour. The CDN
  // handles byte-range requests, so scrubbing never buffers a whole MP4 in a function.
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: presignedUrl,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
