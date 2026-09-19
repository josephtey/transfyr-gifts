import { NextRequest, NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { customers } from "../../../../../lib/customers";
import { cookieName, verifySession } from "../../../../../lib/auth";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customer: string; asset: string[] }> },
) {
  const { customer, asset } = await params;
  if (
    !customers[customer] ||
    !asset.every((part) => /^[a-zA-Z0-9_-]+(?:\.(?:mp4|jpg))?$/.test(part))
  )
    return new NextResponse("Not found", { status: 404 });
  if (
    !(await verifySession(
      request.cookies.get(cookieName(customer))?.value,
      customer,
    ))
  )
    return new NextResponse("Authentication required", { status: 401 });
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
  if (request.nextUrl.searchParams.get("download") !== "1")
    return new NextResponse(null, {
      status: 307,
      headers: {
        Location: presignedUrl,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  const upstream = await fetch(presignedUrl, { signal: request.signal });
  if (!upstream.ok)
    return new NextResponse("Recording unavailable", {
      status: upstream.status,
    });
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${customer}-${asset.at(-1)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
