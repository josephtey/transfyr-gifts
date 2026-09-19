import { NextRequest, NextResponse } from "next/server";
import { customers, customerForHost } from "./lib/customers";
import { cookieName, verifySession } from "./lib/auth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hostCustomer = customerForHost(request.headers.get("host") || "");
  const parts = path.split("/").filter(Boolean);
  const apiMedia = parts[0] === "api" && parts[1] === "media";
  const media = parts[0] === "media" || parts[0] === "frames" || apiMedia;
  const customer = apiMedia
    ? parts[2]
    : media
      ? parts[1]
      : customers[parts[0]]
        ? parts[0]
        : hostCustomer;
  if (path === "/" && !hostCustomer)
    return NextResponse.redirect(new URL("/genentech", request.url));
  if (
    path === "/api/access" ||
    path === "/favicon.svg" ||
    path === "/robots.txt"
  )
    return NextResponse.next();
  if (
    !customer ||
    !customers[customer] ||
    (hostCustomer && customer !== hostCustomer)
  )
    return new NextResponse("Not found", { status: 404 });
  if (path === `/${customer}/access` || (hostCustomer && path === "/access")) {
    return hostCustomer && path === "/access"
      ? NextResponse.rewrite(
          new URL(`/${customer}/access${request.nextUrl.search}`, request.url),
        )
      : NextResponse.next();
  }
  if (
    !(await verifySession(
      request.cookies.get(cookieName(customer))?.value,
      customer,
    ))
  ) {
    if (media)
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      });
    const url = new URL(`/${customer}/access`, request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (
    (parts[0] === "media" || parts[0] === "frames") &&
    process.env.BLOB_MEDIA === "1"
  ) {
    const response = NextResponse.rewrite(
      new URL(
        parts[0] === "frames"
          ? `/api/media/${customer}/frames/${parts.slice(2).join("/")}${request.nextUrl.search}`
          : `/api${path}${request.nextUrl.search}`,
        request.url,
      ),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const response =
    hostCustomer && path === "/"
      ? NextResponse.rewrite(
          new URL(`/${customer}${request.nextUrl.search}`, request.url),
        )
      : NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = { matcher: ["/((?!_next/static).*)"] };
