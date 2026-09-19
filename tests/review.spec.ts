import { test, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import type { Session } from "../src/lib/types";
loadEnvFile(".env.local");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const data: Session = JSON.parse(readFileSync("src/data/session.json", "utf8"));
async function login(
  page: import("@playwright/test").Page,
  path = "/genentech",
) {
  await page.goto(base + path);
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByRole("button", { name: "Open your review" }).click();
  await expect(
    page.getByRole("heading", { name: "Genentech / Calibration" }),
  ).toBeVisible();
}
test("password and private evidence protections work, including deep links", async ({
  page,
  request,
}) => {
  for (const path of [
    "/media/genentech/original.mp4",
    "/media/genentech/overlay.mp4",
    "/media/genentech/clips/stock.mp4",
    "/frames/genentech/stock.jpg",
  ])
    expect(
      (
        await request.get(base + path, { headers: { Range: "bytes=0-99" } })
      ).status(),
    ).toBe(401);
  expect([401, 403, 404]).toContain(
    (
      await request.get(
        base + "/_next/image?url=%2Fframes%2Fgenentech%2Fstock.jpg&w=640&q=75",
      )
    ).status(),
  );
  await page.goto(base + "/genentech?t=394");
  await page.getByLabel("Access password").fill("wrong-password");
  await page.getByRole("button", { name: "Open your review" }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "doesn’t match",
  );
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByRole("button", { name: "Open your review" }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(394, 0);
});
test("one timeline connects every finding and keeps AI records separate from human findings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "/genentech?t=390");
  await expect(
    page.getByRole("heading", { name: "System of Record" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Errors & insights" }),
  ).toHaveCount(0);
  await expect(page.locator(".ai-action-text")).toHaveText(
    data.actions.map((a) => a.text),
  );
  await expect(page.locator(".review-count strong")).toHaveText(
    String(data.counts.errorNotes),
  );
  await expect(
    page.locator(".correction-tag,.human-evidence,.issue-source"),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      /Human correction|Missing from AI|Unresolved disagreement|Source & alignment/,
    ),
  ).toHaveCount(0);
  const expectedLinks = data.issues
    .flatMap((i) =>
      [...i.actionIds, ...i.contextActionIds].map((id) => `${i.id}:${id}`),
    )
    .sort();
  await expect
    .poll(() =>
      page
        .locator(".evidence-link")
        .evaluateAll((nodes) =>
          nodes
            .map(
              (n) =>
                `${n.getAttribute("data-issue-link")}:${n.getAttribute("data-action")}`,
            )
            .sort(),
        ),
    )
    .toEqual(expectedLinks);
  // There is one scroll surface. Actions, findings and connectors move together.
  const scroll = page.locator(".evidence-scroll");
  const section = page
    .locator(".evidence-section")
    .filter({ has: page.locator('[data-id="ai-44"]') });
  const action = section.locator('[data-id="ai-44"] .log-action');
  const finding = section.locator('[data-issue="tip-in-water"] .issue-trigger');
  const before = {
    a: await action.boundingBox(),
    f: await finding.boundingBox(),
  };
  await scroll.evaluate((el) => {
    el.scrollTop += 100;
  });
  const after = {
    a: await action.boundingBox(),
    f: await finding.boundingBox(),
  };
  expect(before.a!.y - after.a!.y).toBeCloseTo(100, 0);
  expect(before.f!.y - after.f!.y).toBeCloseTo(100, 0);
  await action.click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const anchorError = async () =>
    section.evaluate((el) => {
      let maximum = 0;
      for (const link of el.querySelectorAll<SVGGElement>(".evidence-link")) {
        const action = el
          .querySelector(`[data-id="${link.dataset.action}"] .log-action`)!
          .getBoundingClientRect();
        const finding = el
          .querySelector(
            `[data-issue="${link.dataset.issueLink}"] .issue-trigger`,
          )!
          .getBoundingClientRect();
        const a = link
          .querySelector(".action-endpoint")!
          .getBoundingClientRect();
        const f = link
          .querySelector(".finding-endpoint")!
          .getBoundingClientRect();
        maximum = Math.max(
          maximum,
          Math.abs(a.y + a.height / 2 - action.y - action.height / 2),
          Math.abs(f.y + f.height / 2 - finding.y - finding.height / 2),
        );
      }
      return maximum;
    });
  await expect.poll(anchorError).toBeLessThan(1);
  await finding.click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect.poll(anchorError).toBeLessThan(1);
  const issue = data.issues.find((i) => i.id === "tip-in-water")!;
  const ids = await page
    .locator(".log-entry[data-linked=true]")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-id")).sort());
  expect(ids).toEqual([...issue.actionIds, ...issue.contextActionIds].sort());
  await expect(
    section.locator(
      '.evidence-link[data-issue-link="tip-in-water"].is-emphasized',
    ),
  ).toHaveCount(2);
  await expect(page.locator(".insight-overlay")).toBeVisible();
  const playbackTime = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  const insightBounds = await page.locator(".insight-overlay").boundingBox();
  const controlsBounds = await page.locator(".player-controls").boundingBox();
  expect(insightBounds!.y).toBeGreaterThanOrEqual(
    controlsBounds!.y + controlsBounds!.height,
  );
  await expect(
    page.getByText(/View linked actions|total linked|Linked findings/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle perception overlay" }).click();
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/media/genentech/overlay.mp4",
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(playbackTime, 0);
  const focus = data.actions.find((a) => a.id === "ai-44")!;
  await expect(
    page.locator('a[aria-label="Download action clip"]'),
  ).toHaveAttribute(
    "href",
    `/media/genentech/clips/${focus.clipFile}?download=1`,
  );
  await expect(
    page.getByRole("button", { name: "Play action", exact: true }),
  ).toHaveCount(0);
  await action.click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThanOrEqual(focus.clipStart!);
  await page.locator("video").evaluate((v: HTMLVideoElement, end) => {
    v.currentTime = end! - 0.1;
  }, focus.clipEnd);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
  const revealed = section.locator('[data-finding="tip-in-water"]');
  await expect(revealed).toHaveAttribute("data-in-view", "true");
  await expect
    .poll(() =>
      finding.evaluate((el) =>
        Number(getComputedStyle(el.closest(".issue")!).opacity),
      ),
    )
    .toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      finding.evaluate(
        (el) => getComputedStyle(el.closest(".issue")!).transitionDuration,
      ),
    )
    .toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect.poll(anchorError).toBeLessThan(1);
  await page.screenshot({
    path: "/tmp/transfyr-evidence-desktop.png",
    fullPage: true,
  });
  // Cross-segment links navigate the same timeline, including later findings.
  await page.locator('[data-issue="bubbles"] .issue-trigger').first().click();
  await expect(
    page.locator('[data-issue="bubbles"] .issue-kind').first(),
  ).toContainText("Observation");
  await page
    .locator('[data-issue="missing-water"] .issue-trigger')
    .first()
    .click();
  await expect(
    page
      .locator(
        '[data-issue="missing-water"] .issue-trigger[aria-pressed="true"]',
      )
      .first(),
  ).toContainText("Water omitted");
  // Continuous playback follows the real action, even after playing a selected clip.
  if (await page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused))
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = 705;
  });
  await expect(page.locator('[data-id="ai-97"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator('[data-id="ai-97"] .live-pointer')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('[data-id="ai-97"]').evaluate((el) => {
        const viewport = el
          .closest(".evidence-scroll")!
          .getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        return rect.top >= viewport.top && rect.bottom <= viewport.bottom;
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator('.evidence-link[data-in-view="true"] .line-reveal')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset)),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/transfyr-evidence-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await expect
    .poll(() => page.locator(".evidence-link").count())
    .toBe(expectedLinks.length);
  await page.getByRole("button", { name: "Lock review" }).click();
  await expect(page.getByLabel("Access password")).toBeVisible();
  expect(errors).toEqual([]);
});
