import { test, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
async function login(page: import("@playwright/test").Page) {
  await page.goto(`${base}/genentech`);
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByRole("button", { name: "Open your review" }).click();
  await expect(
    page.getByRole("heading", { name: "Genentech / Calibration" }),
  ).toBeVisible();
}
test("private evidence stays behind the password gate", async ({
  page,
  request,
}) => {
  for (const path of [
    "/media/genentech/original.mp4",
    "/media/genentech/overlay.mp4",
    "/media/genentech/clips/stock.mp4",
    "/frames/genentech/stock.jpg",
  ]) {
    const r = await request.get(base + path, {
      headers: { Range: "bytes=0-99" },
    });
    expect(r.status()).toBe(401);
  }
  expect(
    (
      await request.get(
        base + "/_next/image?url=%2Fframes%2Fgenentech%2Fstock.jpg&w=640&q=75",
      )
    ).status(),
  ).toBe(404);
  await page.goto(base + "/genentech?t=394");
  await expect(page.getByLabel("Access password")).toBeVisible();
  await page.getByLabel("Access password").fill("wrong-password");
  await page.getByRole("button", { name: "Open your review" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn’t match");
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByRole("button", { name: "Open your review" }).click();
  await expect(page.locator("video")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(394, 0);
});
test("video, perception, annotations, clips and locking work together", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = 394;
  });
  await expect(page.locator(".log-entry.has-insight.expanded")).toContainText(
    "A tip lands in the water",
  );
  await page.getByRole("button", { name: "Toggle perception overlay" }).click();
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/media/genentech/overlay.mp4",
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(394, 0);
  await expect(page.locator(".insight-overlay")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download clip" }),
  ).toHaveAttribute("href", "/media/genentech/clips/water-tip.mp4?download=1");
  await page.getByRole("button", { name: "Play clip", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: "/tmp/transfyr-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/transfyr-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Lock review" }).click();
  await expect(page.getByLabel("Access password")).toBeVisible();
  expect(errors).toEqual([]);
});
