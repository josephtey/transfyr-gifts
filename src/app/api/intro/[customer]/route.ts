import { NextRequest, NextResponse } from "next/server";
import { customers, customerForHost } from "../../../../lib/customers";
import { cookieName, readSession, signSession } from "../../../../lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customer: string }> },
) {
  const { customer } = await params;
  const hostCustomer = customerForHost(request.headers.get("host") || "");
  if (!customers[customer] || (hostCustomer && customer !== hostCustomer))
    return new NextResponse("Not found", { status: 404 });
  const origin = request.headers.get("origin");
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    /* Invalid origin is rejected below. */
  }
  if (!originHost || originHost !== request.headers.get("host"))
    return new NextResponse("Invalid origin", { status: 403 });
  const access = await readSession(
    request.cookies.get(cookieName(customer))?.value,
    customer,
  );
  if (!access)
    return new NextResponse("Authentication required", { status: 401 });
  const response = new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
  response.cookies.set(
    cookieName(customer),
    await signSession(customer, {
      introComplete: true,
      expiresAt: access.expiresAt,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, access.expiresAt - Math.floor(Date.now() / 1000)),
    },
  );
  return response;
}
