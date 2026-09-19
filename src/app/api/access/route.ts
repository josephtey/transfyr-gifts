import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { customers, customerForHost } from "../../../lib/customers";
import { cookieName, signSession } from "../../../lib/auth";
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const customer = String(form.get("customer") || "");
  const config = customers[customer];
  const hostCustomer = customerForHost(request.headers.get("host") || "");
  if (!config || (hostCustomer && customer !== hostCustomer))
    return new NextResponse("Not found", { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    return new NextResponse("Invalid origin", { status: 403 });
  const requestOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  const target = new URL(`/${customer}/access`, requestOrigin);
  const next = String(form.get("next") || `/${customer}`);
  const safeNext =
    next === "/" || next === `/${customer}` || next.startsWith(`/${customer}?`)
      ? next
      : `/${customer}`;
  target.searchParams.set("next", safeNext);
  if (form.get("logout")) {
    const response = NextResponse.redirect(target, 303);
    response.cookies.delete(cookieName(customer));
    return response;
  }
  const password = process.env[config.passwordEnv];
  if (!password || !process.env.SESSION_SECRET)
    return new NextResponse("Access is not configured yet.", { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const attemptKey = `${customer}:${ip}`;
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.reset < now) attempts.delete(key);
  const attempt = attempts.get(attemptKey) || { count: 0, reset: now + 900000 };
  if (attempt.count >= 10) {
    target.searchParams.set("error", "rate");
    return NextResponse.redirect(target, 303);
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (
    !timingSafeEqual(
      digest(String(form.get("password") || "")),
      digest(password),
    )
  ) {
    attempt.count++;
    attempts.set(attemptKey, attempt);
    target.searchParams.set("error", "password");
    return NextResponse.redirect(target, 303);
  }
  attempts.delete(attemptKey);
  const response = NextResponse.redirect(new URL(safeNext, requestOrigin), 303);
  response.cookies.set(cookieName(customer), await signSession(customer), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
