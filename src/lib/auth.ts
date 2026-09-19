import { SignJWT, jwtVerify } from "jose";
export const cookieName = (customer: string) => `transfyr_${customer}`;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}
export async function signSession(customer: string) {
  return new SignJWT({ customer })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("transfyr-review")
    .setAudience(customer)
    .setExpirationTime("7d")
    .sign(secret());
}
export async function verifySession(
  token: string | undefined,
  customer: string,
) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "transfyr-review",
      audience: customer,
      algorithms: ["HS256"],
    });
    return payload.customer === customer;
  } catch {
    return false;
  }
}
