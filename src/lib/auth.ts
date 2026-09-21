import { SignJWT, jwtVerify } from "jose";
export const cookieName = (customer: string) => `transfyr_${customer}`;
// Bumped for the introduction launch: previously issued logins must sign in again.
const SESSION_VERSION = 3;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}
export async function signSession(
  customer: string,
  options: { introComplete?: boolean; expiresAt?: number } = {},
) {
  return new SignJWT({
    customer,
    version: SESSION_VERSION,
    introComplete: options.introComplete ?? false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("transfyr-review")
    .setAudience(customer)
    .setExpirationTime(options.expiresAt ?? "7d")
    .sign(secret());
}
export async function verifySession(
  token: string | undefined,
  customer: string,
) {
  return (await readSession(token, customer)) !== null;
}

export async function readSession(
  token: string | undefined,
  customer: string,
): Promise<{
  customer: string;
  introComplete: boolean;
  expiresAt: number;
} | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "transfyr-review",
      audience: customer,
      algorithms: ["HS256"],
    });
    if (
      payload.customer !== customer ||
      payload.version !== SESSION_VERSION ||
      typeof payload.exp !== "number"
    )
      return null;
    return {
      customer,
      introComplete: payload.introComplete === true,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}
