import { test, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import { SignJWT, decodeJwt } from "jose";
import { signSession } from "../src/lib/auth";

loadEnvFile(".env.local");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const data = JSON.parse(readFileSync("src/data/session.json", "utf8"));
async function enter(
  page: import("@playwright/test").Page,
  path = "/genentech?t=300",
) {
  await page.goto(base + path);
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByLabel("Access password").press("Enter");
  await expect(
    page.getByRole("heading", { name: "How do you think you did?" }),
  ).toBeVisible();
}

test("new login shows welcome, results and why once, preserving deep links on return", async ({
  page,
}) => {
  await enter(page);
  await expect(page.locator(".analysis-review")).toHaveCount(0);
  await expect(
    page.getByText("Transfyr Calibration Challenge.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".intro-beat.intro-welcome")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.locator(".intro-line > span").last()).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page.screenshot({ path: "/tmp/transfyr-intro-welcome.png" });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "See my results" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your results." }),
  ).toBeVisible();
  const metrics = page.locator(".intro-results .result-metrics");
  await expect(metrics).toContainText(
    `+${data.analysis.result.closestAboveTargetPercent}%`,
  );
  await expect(metrics).toContainText(
    `${data.analysis.result.replicateVariabilityPercent}%`,
  );
  await expect(page.locator(".percentile-scale")).toHaveCount(2);
  await expect(
    page.locator(".intro-results .result-metrics > div").last(),
  ).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/transfyr-intro-results.png" });
  const before = (await page.context().cookies()).find(
    (cookie) => cookie.name === "transfyr_genentech",
  )!;
  await page.getByRole("button", { name: "Take a closer look" }).click();
  await expect(
    page.getByRole("heading", { name: "Why?", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".intro-why h1")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/transfyr-intro-why.png" });
  await expect(page.locator(".review-intro")).toHaveCount(0);
  const heading = page.getByRole("heading", { name: "What happened?" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator('video[data-active="true"]')
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeCloseTo(300, 0);
  const after = (await page.context().cookies()).find(
    (cookie) => cookie.name === "transfyr_genentech",
  )!;
  expect(decodeJwt(after.value).introComplete).toBe(true);
  expect(decodeJwt(after.value).exp).toBe(decodeJwt(before.value).exp);
  expect(after.httpOnly).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What happened?" }),
  ).toBeVisible();
  await expect(page.locator(".review-intro")).toHaveCount(0);
  // A fresh login receives its own intro, without changing the password.
  await enter(page, "/genentech/access");
});

test("the intro fits a narrow screen and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await expect(page.locator(".intro-line > span").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.screenshot({ path: "/tmp/transfyr-intro-mobile-welcome.png" });
  await page.getByRole("button", { name: "See my results" }).click();
  await expect(page.locator(".intro-results")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const button = await page
    .getByRole("button", { name: "Take a closer look" })
    .boundingBox();
  expect(button!.y + button!.height).toBeLessThan(844);
  await expect(
    page.locator(".intro-results .percentile-track").first(),
  ).toHaveCSS("animation-name", "none");
  await page.screenshot({ path: "/tmp/transfyr-intro-mobile-results.png" });
  await page.getByRole("button", { name: "Take a closer look" }).click();
  await expect(
    page.getByRole("heading", { name: "What happened?" }),
  ).toBeVisible();
});

test("revoked sessions cannot access reviews or media, and intro completion is authenticated", async ({
  browser,
  request,
}) => {
  expect(
    (
      await request.post(base + "/api/intro/genentech", {
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(401);
  const context = await browser.newContext();
  const cookie = { name: "transfyr_genentech", url: base, httpOnly: true };
  const old = await new SignJWT({ customer: "genentech" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("transfyr-review")
    .setAudience("genentech")
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
  await context.addCookies([{ ...cookie, value: old }]);
  for (const path of [
    "/media/genentech/original.mp4",
    "/api/media/genentech/leaderboard.png",
  ]) {
    expect(
      (
        await context.request.get(base + path, {
          headers: { Range: "bytes=0-99" },
        })
      ).status(),
    ).toBe(401);
  }
  const page = await context.newPage();
  await page.goto(base + "/genentech");
  await expect(page.getByLabel("Access password")).toBeVisible();
  expect(
    (await context.cookies()).some((item) => item.name === cookie.name),
  ).toBe(false);
  // A current token signed by the same key is accepted, proving generation revocation.
  await context.addCookies([
    { ...cookie, value: await signSession("genentech") },
  ]);
  await page.goto(base + "/genentech");
  await expect(page.locator(".review-intro")).toBeVisible();
  expect(
    (
      await context.request.post(base + "/api/intro/genentech", {
        headers: { Origin: "https://another-site.invalid" },
      })
    ).status(),
  ).toBe(403);
  await context.close();
});

test("failed intro completion can retry without losing the review", async ({
  page,
}) => {
  await enter(page);
  await page.route("**/api/intro/genentech", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.getByRole("button", { name: "See my results" }).click();
  await page.getByRole("button", { name: "Take a closer look" }).click();
  await expect(page.locator(".intro-retry").getByRole("alert")).toContainText(
    "Couldn't open the review",
  );
  await page.unroute("**/api/intro/genentech");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "What happened?" }),
  ).toBeVisible();
});

test("Exit signs out from both the intro and review, and the password focus has no border", async ({
  page,
}) => {
  for (const fromReview of [false, true]) {
    await enter(page);
    if (fromReview) {
      await page.getByRole("button", { name: "See my results" }).click();
      await page.getByRole("button", { name: "Take a closer look" }).click();
      await expect(
        page.getByRole("heading", { name: "What happened?" }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Exit", exact: true }).click();
    const input = page.getByLabel("Access password");
    await expect(input).toBeVisible();
    await input.click();
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS("outline-style", "none");
    await expect(input).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".review-intro, .analysis-review")).toHaveCount(
      0,
    );
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "transfyr_genentech",
      ),
    ).toBe(false);
    expect(
      (
        await page.request.get(base + "/media/genentech/leaderboard.png")
      ).status(),
    ).toBe(401);
    await page.goto(base + "/genentech");
    await expect(input).toBeVisible();
  }
});
