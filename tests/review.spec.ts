import { test, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import type { Session } from "../src/lib/types";
import { countFindings, buildTimelineMarkers } from "../src/lib/findings";
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
  await page.getByLabel("Access password").press("Enter");
  await expect(
    page.getByRole("button", { name: "Major findings" }),
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
  await page.getByLabel("Access password").press("Enter");
  await expect(page.getByLabel("Access password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Access password")).toHaveAttribute(
    "placeholder",
    "Incorrect password",
  );
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByLabel("Access password").press("Enter");
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
  await page.getByRole("button", { name: "Minor findings" }).click();
  await expect(
    page.getByRole("heading", { name: "System of Record" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Errors & insights" }),
  ).toHaveCount(0);
  await expect(page.locator(".ai-action-text")).toHaveText(
    data.actions.map((a) => a.text),
  );
  await expect(page.locator(".record-step-heading h3")).toHaveText(
    data.steps.map((step) => step.name),
  );
  for (const step of data.steps) {
    await expect(
      page.locator(`[data-step="${step.id}"] .ai-action-text`),
    ).toHaveText(
      step.actionIds.map((id) => data.actions.find((a) => a.id === id)!.text),
    );
  }
  for (const step of data.steps) {
    const expand = page.getByRole("button", {
      name: `Expand ${step.name}`,
      exact: true,
    });
    if (await expand.count()) await expand.click();
  }
  await expect(page.locator(".step-instruction")).toHaveCount(0);
  await expect(page.locator('[data-step="blanks"] .step-empty')).toContainText(
    "No recorded actions identified",
  );
  await expect(page.locator('[data-step="blanks"] [data-id]')).toHaveCount(0);
  await expect(page.locator(".major-filter strong")).toHaveText(
    String(
      countFindings(
        data.issues.filter((i) => i.tier === "major"),
        data.reviews,
      ).errors,
    ),
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
      [...i.actionIds, ...i.contextActionIds]
        .filter((id) =>
          data.steps.some(
            (step) =>
              i.stepIds.includes(step.id) && step.actionIds.includes(id),
          ),
        )
        .map((id) => `${i.id}:${id}`),
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
  await expect(page.locator(".insight-description")).toHaveText(issue.description);
  await expect(page.getByRole("button", { name: "Dismiss insight" })).toHaveCount(0);
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
  await expect(page.locator('a[download], a[href*="download="]')).toHaveCount(
    0,
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
  await page
    .locator('[data-issue="calibration-two-volume"] .issue-trigger')
    .first()
    .click();
  await expect(
    page.locator('[data-issue="calibration-two-volume"] .issue-kind').first(),
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
  await expect(page.getByRole("button", { name: "Lock review" })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("steps start expanded at the first major error, and both step controls seek", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator('.step-toggle[aria-expanded="true"]')).toHaveCount(
    data.steps.length,
  );
  await expect(page.locator(".record-step-body:visible")).toHaveCount(
    data.steps.length,
  );
  const firstError = buildTimelineMarkers(
    data.issues.filter((i) => i.tier === "major"),
    data.reviews,
    data.steps,
  ).find((marker) => marker.kind === "error")!;
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(firstError.start, 1);
  expect(
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
  await expect(
    page.getByRole("slider", { name: "Seek recording" }),
  ).toHaveValue(String(firstError.start));
  await expect(
    page.locator(`[data-id="${firstError.actionId}"] .log-action`),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".insight-overlay")).toContainText(
    data.issues.find((i) => i.id === firstError.issueIds[0])!.title,
  );
  const format = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  for (const step of data.steps) {
    const header = page.locator(
      `[data-step="${step.id}"] .record-step-heading`,
    );
    await expect(header.locator(".step-duration")).toHaveText(
      step.start === null || step.end === null
        ? "—"
        : format(step.end - step.start),
    );
    if (step.counts) {
      const counts = countFindings(
        data.issues.filter((i) => i.tier === "major"),
        data.reviews,
        step,
      );
      for (const [kind, count] of Object.entries(counts)) {
        await expect(header.locator(".step-counts")).toContainText(
          `${count} ${count === 1 ? kind.slice(0, -1) : kind}`,
        );
      }
    } else
      await expect(header.locator(".step-counts")).toContainText(
        "No recorded actions identified",
      );
  }
  await expect(
    page.getByRole("button", {
      name: "Collapse Tube arrangement",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator('[data-step="arrangement"] .issue-trigger'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Collapse Tube arrangement", exact: true })
    .click();
  const headerPlacement = await page
    .locator('[data-step="calibration-1"]')
    .evaluate((el) => {
      const heading = el.querySelector("h3")!.getBoundingClientRect();
      const counts = el.querySelector(".step-counts")!.getBoundingClientRect();
      return (
        counts.left >= heading.right &&
        Math.abs(
          counts.top + counts.height / 2 - heading.top - heading.height / 2,
        ) < 2
      );
    });
  expect(headerPlacement).toBe(true);
  await page.screenshot({
    path: "/tmp/transfyr-expanded-start.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Collapse Calibration 1", exact: true })
    .click();
  await expect(
    page.locator('[data-step="calibration-1"] .record-step-body'),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Expand Calibration 1", exact: true })
    .click();
  await expect(
    page.locator('[data-step="calibration-1"] .record-step-body'),
  ).toBeVisible();
  expect(
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Collapse Calibration 1", exact: true })
    .click();
  const stage = data.steps.find((s) => s.id === "calibration-2")!;
  await page.locator('[data-step="calibration-2"] .step-jump').click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThanOrEqual(stage.start!);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await expect(
    page.getByRole("button", { name: "Collapse Calibration 2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Jump to Calibration 3", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThanOrEqual(
      data.steps.find((s) => s.id === "calibration-3")!.start!,
    );
  await expect(
    page.locator('[data-scrubber-step="calibration-3"]'),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByRole("button", { name: "Collapse Calibration 3", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-step="blanks"] .step-jump')).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Jump to Blanks", exact: true }),
  ).toHaveCount(0);
});

test("major and minor tiers can be selected independently, with only major on initially", async ({
  page,
}) => {
  await login(page);
  const majorToggle = page.getByRole("button", { name: "Major findings" });
  const minorToggle = page.getByRole("button", { name: "Minor findings" });
  await expect(majorToggle).toHaveAttribute("aria-pressed", "true");
  await expect(minorToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("reviewed error notes")).toHaveCount(0);
  await expect(page.locator(".tier-filters")).toBeVisible();
  for (const step of data.steps) {
    const expand = page.getByRole("button", {
      name: `Expand ${step.name}`,
      exact: true,
    });
    if (await expand.count()) await expand.click();
  }
  const assertTier = async (tier: "major" | "minor", visible: boolean) => {
    for (const issue of data.issues.filter((i) => i.tier === tier)) {
      const cards = page.locator(`[data-issue="${issue.id}"]`);
      if (visible) expect(await cards.count()).toBeGreaterThan(0);
      else await expect(cards).toHaveCount(0);
    }
  };
  await assertTier("major", true);
  await assertTier("minor", false);
  for (const note of data.summaryNotes) {
    const finding = data.issues.find(
      (issue) => issue.tier === "major" && issue.summaryIds.includes(note.id),
    );
    expect(finding, "Every human summary theme is available by default").toBeDefined();
    expect(await page.locator(`[data-issue="${finding!.id}"]`).count()).toBeGreaterThan(0);
  }
  await minorToggle.click();
  await assertTier("major", true);
  await assertTier("minor", true);
  for (const id of [
    "second-stop",
    "filter-wetting",
    "bubbles",
    "return-to-source",
  ])
    expect(await page.locator(`[data-issue="${id}"]`).count()).toBeGreaterThan(
      0,
    );
  await page
    .locator('[data-issue="second-stop"] .issue-trigger')
    .first()
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('[data-issue="second-stop"]')
        .first()
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  await majorToggle.click();
  await assertTier("major", false);
  await assertTier("minor", true);
  await minorToggle.click();
  await expect(page.locator(".issue-trigger")).toHaveCount(0);
  await expect(page.locator(".timeline-marker")).toHaveCount(0);
  await expect(page.locator(".ai-action-text")).toHaveCount(
    data.actions.length,
  );
  for (const step of data.steps.filter((s) => s.actionIds.length))
    await expect(
      page.locator(`[data-step="${step.id}"] .step-counts`),
    ).toContainText("0 errors");
  await majorToggle.click();
  await assertTier("major", true);
  await assertTier("minor", false);
  await expect(
    page.locator('[data-step="arrangement"] .issue-trigger'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-step="arrangement"] .step-counts'),
  ).toContainText("0 errors");
});

test("category colors stay consistent through hover, selection, playback and connectors", async ({
  page,
}) => {
  await login(page);
  for (const step of data.steps) {
    const expand = page.getByRole("button", {
      name: `Expand ${step.name}`,
      exact: true,
    });
    if (await expand.count()) await expand.click();
  }
  const colors = {
    error: "rgb(240, 128, 128)",
    risk: "rgb(237, 204, 103)",
    observation: "rgb(130, 182, 244)",
  };
  for (const [id, kind] of [
    ["tip-in-water", "error"],
    ["tip-reuse", "risk"],
    ["calibration-two-volume", "observation"],
  ] as const) {
    const finding = page.locator(`[data-issue="${id}"] .issue-trigger`).first();
    const expected = colors[kind];
    await finding.scrollIntoViewIfNeeded();
    await finding.hover();
    await expect(finding.locator("strong")).toHaveCSS("color", expected);
    await finding.click();
    await expect
      .poll(() =>
        page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
      )
      .toBe(false);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(finding.locator("strong")).toHaveCSS("color", expected);
    await expect(finding.locator(".issue-kind")).toHaveCSS("color", expected);
    await expect(
      page
        .locator(`.evidence-link[data-issue-link="${id}"] .connection-stroke`)
        .first(),
    ).toHaveCSS("stroke", expected);
    for (const action of await page
      .locator('.log-entry[data-linked="true"]')
      .all()) {
      await expect(action).toHaveCSS("border-left-color", expected);
    }
    await expect(page.locator(".insight-overlay")).toHaveCSS(
      "border-left-color",
      expected,
    );
    await expect(page.locator(".insight-description")).toHaveText(
      data.issues.find((issue) => issue.id === id)!.description,
    );
  }
  await page.screenshot({
    path: "/tmp/transfyr-category-colors.png",
    fullPage: true,
  });
});

test("scrubber includes every visible category with consistent colors and tier filtering", async ({
  page,
}) => {
  await login(page);
  const colors = {
    error: "rgb(240, 128, 128)",
    risk: "rgb(237, 204, 103)",
    observation: "rgb(130, 182, 244)",
  };
  for (const kind of ["error", "risk", "observation"] as const) {
    const markers = page.locator(`[data-marker-kind="${kind}"]`);
    expect(await markers.count()).toBeGreaterThan(0);
    for (const marker of await markers.all()) {
      expect(
        await marker.evaluate(
          (el) => getComputedStyle(el, "::after").backgroundColor,
        ),
      ).toBe(colors[kind]);
    }
  }
  await expect(page.locator('[data-marker-issues~="second-stop"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Minor findings" }).click();
  const secondStop = page
    .locator('.timeline-marker[data-marker-issues*="second-stop"]')
    .first();
  await expect(secondStop).toBeVisible();
  const firstIssue = (await secondStop.getAttribute(
    "data-marker-issues",
  ))!.split(",")[0];
  await secondStop.click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await expect(page.locator(".insight-overlay")).toContainText(
    data.issues.find((i) => i.id === firstIssue)!.title,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".form-error")).toHaveCount(0);
  await page.screenshot({
    path: "/tmp/transfyr-final-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/transfyr-final-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("an explicit beginning timestamp overrides the default first-error position", async ({
  page,
}) => {
  await login(page, "/genentech?t=0");
  await expect
    .poll(() =>
      page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBe(0);
  await expect(
    page.getByRole("slider", { name: "Seek recording" }),
  ).toHaveValue("0");
  await expect(page.locator('.step-toggle[aria-expanded="true"]')).toHaveCount(
    data.steps.length,
  );
  await expect(page.locator(".insight-overlay")).toHaveCount(0);
  await expect(page.locator(".action-caption")).toHaveText(data.actions[0].text);
  const captionBounds = await page.locator(".action-caption").boundingBox();
  const videoBounds = await page.locator(".video-surface").boundingBox();
  expect(captionBounds!.y - videoBounds!.y).toBe(12);
  expect(captionBounds!.y + captionBounds!.height).toBeLessThan(
    videoBounds!.y + videoBounds!.height,
  );
  await page.locator("video").evaluate((video: HTMLVideoElement) => {
    video.currentTime = 66;
  });
  await expect(page.locator(".action-caption")).toHaveCount(0);
  await page.locator("video").evaluate((video: HTMLVideoElement) => {
    video.currentTime = 68;
  });
  await expect(page.locator(".action-caption")).toHaveText(data.actions[2].text);
});

test("access is a single password field and the review has no branding or sharing controls", async ({
  page,
}) => {
  await page.goto(base + "/genentech");
  await expect(page.locator("main input:visible")).toHaveCount(1);
  await expect(
    page.locator(
      "main button, main a, main h1, main p, main label, main footer",
    ),
  ).toHaveCount(0);
  await expect(page.locator("main")).toHaveText("");
  await expect(page).toHaveTitle("Calibration review");
  await page.screenshot({
    path: "/tmp/transfyr-access-minimal.png",
    fullPage: true,
  });
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByLabel("Access password").press("Enter");
  await expect(
    page.getByRole("button", { name: "Major findings" }),
  ).toBeVisible();
  await expect(
    page.locator(".wordmark,.header-tools,.header-divider"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/transfyr|genentech/i);
  await expect(
    page.getByRole("button", { name: /download|copy.*link|lock review|exit/i }),
  ).toHaveCount(0);
  await expect(page.locator('a[download],a[href*="download="]')).toHaveCount(0);
  for (const path of [
    "/media/genentech/original.mp4?download=1",
    "/api/media/genentech/original.mp4?download=1",
  ]) {
    expect((await page.context().request.get(base + path)).status()).toBe(404);
  }
});

test("expanding a different step scrolls to that step instead of the selected action", async ({
  page,
}) => {
  await login(page);
  const initialTime = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  const step = page.locator('[data-step="calibration-3"]');
  await page
    .getByRole("button", { name: "Collapse Calibration 3", exact: true })
    .click();
  await expect(step.locator(".record-step-body")).toBeHidden();
  await page
    .getByRole("button", { name: "Expand Calibration 3", exact: true })
    .click();
  await expect(step.locator(".record-step-body")).toBeVisible();
  await expect
    .poll(() =>
      step.evaluate((el) => {
        const viewport = el
          .closest(".evidence-scroll")!
          .getBoundingClientRect();
        return Math.abs(el.getBoundingClientRect().top - viewport.top);
      }),
    )
    .toBeLessThan(2);
  expect(
    await page
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.currentTime),
  ).toBeCloseTo(initialTime, 1);
  expect(
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/transfyr-expanded-scroll.png",
    fullPage: true,
  });
});
