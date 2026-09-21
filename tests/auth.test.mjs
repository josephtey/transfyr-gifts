import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT, decodeJwt } from "jose";
import { signSession, verifySession, readSession } from "../src/lib/auth.ts";

process.env.SESSION_SECRET =
  "test-only-session-signing-key-for-introduction-tests";
const key = new TextEncoder().encode(process.env.SESSION_SECRET);

test("previous session generations are rejected despite valid signatures", async () => {
  for (const claims of [
    { customer: "test" },
    { customer: "test", version: 1, introComplete: true },
  ]) {
    const old = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("transfyr-review")
      .setAudience("test")
      .setExpirationTime("7d")
      .sign(key);
    assert.equal(await verifySession(old, "test"), false);
  }
});

test("new logins require the intro and remain scoped to their customer", async () => {
  const current = await signSession("test");
  assert.equal(await verifySession(current, "test"), true);
  assert.equal((await readSession(current, "test")).introComplete, false);
  assert.equal(await verifySession(current, "another-customer"), false);
  assert.equal(await verifySession(undefined, "test"), false);
  assert.equal(await verifySession("invalid", "test"), false);
});

test("intro completion preserves expiry and cannot revive expired sessions", async () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const finished = await signSession("test", {
    introComplete: true,
    expiresAt,
  });
  assert.equal((await readSession(finished, "test")).introComplete, true);
  assert.equal(decodeJwt(finished).exp, expiresAt);
  const expired = await signSession("test", {
    introComplete: true,
    expiresAt: 1,
  });
  assert.equal(await verifySession(expired, "test"), false);
});
