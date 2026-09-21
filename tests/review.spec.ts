import { test, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import type { Session } from "../src/lib/types";
import {
  leaderboardContext,
  metricPercentileContext,
} from "../src/lib/results";
import { buildTimelineMarkers } from "../src/lib/findings";
loadEnvFile(".env.local");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const data: Session = JSON.parse(readFileSync("src/data/session.json", "utf8"));
const records = data.analysis.stages.flatMap((stage) => stage.records);
const activeVideo = (page: import("@playwright/test").Page) =>
  page.locator('video[data-active="true"]');
async function finishIntro(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Remember the challenge" }).click();
  await page.getByRole("button", { name: "See my results" }).click();
  await page.getByRole("button", { name: "Take a closer look" }).click();
  await expect(
    page.getByRole("heading", { name: "What happened?" }),
  ).toBeVisible();
}
async function login(
  page: import("@playwright/test").Page,
  path = "/genentech",
) {
  await page.goto(base + path);
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByLabel("Access password").press("Enter");
  await finishIntro(page);
  await expect(
    page.getByRole("heading", { name: "What happened?" }),
  ).toBeVisible();
  const timestamp = new URL(path, base).searchParams.get("t");
  const target =
    timestamp !== null
      ? Number(timestamp)
      : buildTimelineMarkers(
          data.analysis.findings,
          data.reviews,
          data.steps,
        ).find((marker) => marker.kind === "error")!.start;
  await expect
    .poll(() =>
      activeVideo(page).evaluate(
        (video: HTMLVideoElement) => video.currentTime,
      ),
    )
    .toBeCloseTo(target, 0);
  await expect
    .poll(() =>
      activeVideo(page).evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() =>
      activeVideo(page).evaluate((video: HTMLVideoElement) => video.seeking),
    )
    .toBe(false);
}

test("password protects the review and media; explicit timestamps survive login", async ({
  page,
  request,
}) => {
  for (const path of [
    "/media/genentech/original.mp4",
    "/media/genentech/overlay.mp4",
    "/frames/genentech/stock.jpg",
    "/api/media/genentech/original.mp4",
    "/media/genentech/leaderboard.png",
    "/media/genentech/protocol.png",
    "/api/media/genentech/leaderboard.png",
    "/api/media/genentech/protocol.png",
  ])
    expect(
      (
        await request.get(base + path, { headers: { Range: "bytes=0-99" } })
      ).status(),
    ).toBe(401);
  await page.goto(base + "/genentech?t=300");
  await expect(page.locator("main input:visible")).toHaveCount(1);
  await expect(page.locator("h1, main button, .wordmark")).toHaveCount(0);
  await page.getByLabel("Access password").fill("wrong-password");
  await page.getByLabel("Access password").press("Enter");
  await expect(page.getByLabel("Access password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByLabel("Access password").press("Enter");
  await finishIntro(page);
  await expect
    .poll(() =>
      activeVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(300, 0);
  await expect(
    page.locator('a[download], a[href*="download="], .more-menu, .wordmark'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /Lock review|Dismiss insight|Copy moment/,
    }),
  ).toHaveCount(0);
  for (const path of [
    "/media/genentech/original.mp4?download=1",
    "/api/media/genentech/original.mp4?download=1",
    "/media/genentech/leaderboard.png?download=1",
    "/api/media/genentech/leaderboard.png?download=1",
  ])
    expect((await page.request.get(base + path)).status()).toBe(404);
});

test("the result explanation selects all visible findings and replaces the fine-grained log", async ({
  page,
}) => {
  await login(page);
  const performance = page.getByRole("button", { name: "How did you do?" });
  await expect(performance).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".evidence-pane .result-metrics")).toHaveCount(0);
  await performance.click();
  await expect(performance).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".result-metrics")).toContainText(
    `+${data.analysis.result.closestAboveTargetPercent}%`,
  );
  await expect(page.locator(".result-metrics")).toContainText(
    `${data.analysis.result.replicateVariabilityPercent}%`,
  );
  await expect(
    page.getByRole("heading", { name: "Variability", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Likely contributors", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".tier-filters")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Major findings|Minor findings/ }),
  ).toHaveCount(0);
  await expect(page.locator(".step-record")).toHaveCount(records.length);
  if (data.analysis.result.metricComparisons) {
    for (const [metric, comparison] of Object.entries(
      data.analysis.result.metricComparisons,
    )) {
      const context = metricPercentileContext(comparison)!;
      const label =
        metric === "accuracy" ? "Accuracy" : "Replicate variability";
      await expect(
        page.getByRole("img", {
          name: `${label} performance: approximately ${context.ordinal} percentile; about ${100 - context.percentile}% of the cohort performed better. ${context.detail}`,
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(page.locator(".percentile-scale")).toHaveCount(2);
    const comparisons = Object.values(data.analysis.result.metricComparisons);
    if (comparisons.some((comparison) => "estimate" in comparison)) {
      await expect(page.locator(".percentile-source")).toHaveCount(0);
      for (const scale of await page.locator(".percentile-scale").all()) {
        await expect(scale).not.toHaveAttribute("aria-label", /rank \d/);
      }
    }
    const positions = await page
      .locator(".percentile-position")
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLElement).style.left),
      );
    expect(positions).toEqual(
      comparisons.map(
        (comparison) => `${metricPercentileContext(comparison)!.percentile}%`,
      ),
    );
    await expect(page.locator(".leaderboard-context")).toHaveCount(0);
  } else {
    const leaderboard = leaderboardContext(data.analysis.result.leaderboard)!;
    await expect(page.locator(".leaderboard-context")).toContainText(
      `≈${leaderboard.ordinal}`,
    );
    await expect(page.locator(".leaderboard-context")).toContainText(
      `Rank ${leaderboard.rank} of ${leaderboard.totalEntries}`,
    );
    await expect(page.locator(".leaderboard-context")).toHaveAttribute(
      "title",
      leaderboard.explanation,
    );
    await expect(page.locator(".percentile-scale")).toHaveCount(0);
  }
  await expect(page.locator(".step-record-text")).toHaveText(
    records.map((record) => record.text),
  );
  await expect(page.locator(".ai-action-text")).toHaveCount(0);
  await expect(page.locator(".issue-trigger strong")).toHaveText(
    data.analysis.findings.map((finding) => finding.title),
  );
  await expect(page.locator(".issue-description")).toHaveText(
    data.analysis.findings.map((finding) => finding.description),
  );
  const expectedIds = data.analysis.findings
    .map((finding) => finding.id)
    .sort();
  expect(
    await page
      .locator("[data-issue]")
      .evaluateAll((elements) =>
        elements.map((el) => el.getAttribute("data-issue")).sort(),
      ),
  ).toEqual(expectedIds);
  for (const stage of data.analysis.stages) {
    await expect(
      page.locator(`[data-step="${stage.stepId}"] [data-issue]`),
    ).toHaveCount(stage.findingIds.length);
    for (const kind of ["error", "risk", "observation"] as const) {
      const count = data.analysis.findings.filter(
        (finding) =>
          stage.findingIds.includes(finding.id) && finding.kind === kind,
      ).length;
      if (count)
        await expect(
          page.locator(`[data-step="${stage.stepId}"] .step-counts`),
        ).toContainText(`${count} ${kind}`);
    }
  }
  await page.screenshot({
    path: "/tmp/transfyr-analysis-desktop.png",
    fullPage: true,
  });
});

test("sidebar results open the protected leaderboard without changing the video position", async ({
  page,
}) => {
  await login(page);
  const card = page.locator(".evidence-pane .result-card");
  await card.getByRole("button", { name: "How did you do?" }).click();
  const trigger = card.getByRole("button", { name: "See on leaderboard" });
  const dialog = page.getByRole("dialog", {
    name: "Calibration challenge leaderboard",
  });
  const image = dialog.getByRole("img");
  const currentTime = () =>
    activeVideo(page).evaluate((video: HTMLVideoElement) => video.currentTime);
  const initialTime = await currentTime();
  const cardBounds = (await card.boundingBox())!;
  const headingBounds = (await page
    .getByRole("heading", { name: "What happened?" })
    .boundingBox())!;
  expect(cardBounds.y + cardBounds.height).toBeLessThanOrEqual(headingBounds.y);
  await expect(page.locator(".result-header")).toHaveCount(0);
  await expect(
    page.getByText("Informal, uncontrolled cohort; provided for context only."),
  ).toHaveCount(0);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(image).toHaveAttribute(
    "src",
    "/media/genentech/leaderboard.png",
  );
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(2048);
  // Keyboard events from the modal must not reach the player's global shortcuts.
  await image.click();
  await expect(
    dialog.getByRole("button", { name: "Zoom out leaderboard" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  expect(await currentTime()).toBeCloseTo(initialTime, 1);
  await expect
    .poll(() =>
      activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused),
    )
    .toBe(true);
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/transfyr-leaderboard-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await currentTime()).toBeCloseTo(initialTime, 1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused),
    )
    .toBe(false);
  const beforeOpen = await currentTime();
  await trigger.click();
  await expect
    .poll(() =>
      activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused),
    )
    .toBe(true);
  expect(Math.abs((await currentTime()) - beforeOpen)).toBeLessThan(2);
  await dialog.getByRole("button", { name: "Close leaderboard" }).click();
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(2048);
  await expect(dialog).toHaveCSS("opacity", "1");
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "/tmp/transfyr-leaderboard-mobile.png" });
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("each finding is connected to its coarse step and plays its evidence with full details", async ({
  page,
}) => {
  await login(page);
  for (const stage of data.analysis.stages) {
    const step = page.locator(`[data-step="${stage.stepId}"]`);
    const linkedCount = stage.findingIds.reduce((count, id) => {
      const finding = data.analysis.findings.find(
        (finding) => finding.id === id,
      )!;
      return (
        count +
        stage.records.filter((record) =>
          record.actionIds.some((action) =>
            [...finding.actionIds, ...finding.contextActionIds].includes(
              action,
            ),
          ),
        ).length
      );
    }, 0);
    await expect(step.locator(".evidence-link")).toHaveCount(linkedCount);
    for (const id of stage.findingIds) {
      const finding = data.analysis.findings.find(
        (finding) => finding.id === id,
      )!;
      const button = step.locator(`[data-issue="${id}"] .issue-trigger`);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect
        .poll(() =>
          activeVideo(page).evaluate((v: HTMLVideoElement) => v.paused),
        )
        .toBe(false);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(page.locator(".insight-description")).toHaveText(
        finding.description,
      );
      const left = await page.locator(".insight-overlay").boundingBox();
      const controls = await page.locator(".player-controls").boundingBox();
      expect(left!.y).toBeGreaterThanOrEqual(controls!.y + controls!.height);
      const colors = {
        error: "rgb(240, 128, 128)",
        risk: "rgb(237, 204, 103)",
        observation: "rgb(130, 182, 244)",
      };
      await expect(page.locator(".insight-overlay")).toHaveCSS(
        "border-left-color",
        colors[finding.kind],
      );
      await expect(button.locator(".issue-kind")).toHaveCSS(
        "color",
        colors[finding.kind],
      );
      await expect(
        step.locator(`[data-issue-link="${id}"] .connection-stroke`).first(),
      ).toHaveCSS("stroke", colors[finding.kind]);
    }
  }
});

test("all protocol steps start open, seek from both controls and expand without changing playback time", async ({
  page,
}) => {
  await login(page);
  const first = buildTimelineMarkers(
    data.analysis.findings,
    data.reviews,
    data.steps,
  ).find((marker) => marker.kind === "error")!;
  await expect
    .poll(() =>
      activeVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(first.start, 0);
  expect(
    await activeVideo(page).evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
  await expect(page.locator('.step-toggle[aria-expanded="true"]')).toHaveCount(
    data.analysis.stages.length,
  );
  await page
    .getByRole("button", { name: "Collapse Calibration 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Calibration 3", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator('[data-step="calibration-3"]').evaluate((element) => {
        const container = element.closest(".evidence-scroll")!;
        return Math.abs(
          element.getBoundingClientRect().top -
            container.getBoundingClientRect().top,
        );
      }),
    )
    .toBeLessThan(2);
  expect(
    await activeVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime),
  ).toBeCloseTo(first.start, 0);
  for (const stage of data.analysis.stages) {
    const step = data.steps.find((step) => step.id === stage.stepId)!;
    if (step.start === null) {
      await expect(
        page.locator(`[data-step="${step.id}"] .step-jump`),
      ).toBeDisabled();
      await expect(
        page.locator(`[data-scrubber-step="${step.id}"]`),
      ).toHaveCount(0);
      continue;
    }
    await page
      .getByRole("button", { name: `Jump to ${step.name}`, exact: true })
      .click();
    await expect
      .poll(() =>
        activeVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime),
      )
      .toBeGreaterThanOrEqual(step.start!);
    await expect(
      page.locator(`[data-id="${stage.records[0].id}"]`),
    ).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page
      .getByRole("button", {
        name: `Play ${stage.records[0].title}`,
        exact: true,
      })
      .click();
    await expect
      .poll(() =>
        activeVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime),
      )
      .toBeLessThan(step.start! + 3);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  }
});

test("perception switches preserve paused time, frames and audio settings without a reset", async ({
  page,
}) => {
  await login(page, "/genentech?t=400");
  const toggle = page.getByRole("button", {
    name: "Toggle AI overlay",
  });
  await activeVideo(page).evaluate((v: HTMLVideoElement) => {
    v.playbackRate = 1.5;
    v.volume = 0.4;
  });
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as any).__samples = samples;
    (window as any).__sampler = setInterval(
      () =>
        samples.push(
          Number(
            (
              document.querySelector(
                'input[aria-label="Seek recording"]',
              ) as HTMLInputElement
            ).value,
          ),
        ),
      10,
    );
  });
  for (const mode of ["overlay", "original", "overlay", "original"]) {
    await toggle.click();
    await expect(activeVideo(page)).toHaveAttribute("data-mode", mode);
    await expect(toggle).toBeEnabled();
    const state = await activeVideo(page).evaluate((v: HTMLVideoElement) => ({
      time: v.currentTime,
      ready: v.readyState,
      paused: v.paused,
      muted: v.muted,
      rate: v.playbackRate,
      volume: v.volume,
    }));
    expect(state.time).toBeCloseTo(400, 0);
    expect(state.ready).toBeGreaterThanOrEqual(2);
    expect(state.paused).toBe(true);
    expect(state.muted).toBe(true);
    expect(state.rate).toBe(1.5);
    expect(state.volume).toBeCloseTo(0.4);
  }
  const samples = await page.evaluate(() => {
    clearInterval((window as any).__sampler);
    return (window as any).__samples as number[];
  });
  expect(samples.length).toBeGreaterThan(0);
  expect(Math.min(...samples)).toBeGreaterThan(399);
  await expect(page.locator(".form-error[role=alert]")).toHaveCount(0);
});

test("FPV, side and top views stay visible and synchronized", async ({ page }) => {
  await login(page, "/genentech?t=600");
  const side = page.locator('video[data-mode="side"]');
  const top = page.locator('video[data-mode="top"]');
  await expect(side).toBeVisible();
  await expect(top).toBeVisible();
  await expect(page.getByText("FPV", { exact: true })).toBeVisible();
  await expect(page.getByText("Side", { exact: true })).toBeVisible();
  await expect(page.getByText("Top", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const primaryTime = await activeVideo(page).evaluate(
        (video: HTMLVideoElement) => video.currentTime,
      );
      const sideTime = await side.evaluate(
        (video: HTMLVideoElement) => video.currentTime,
      );
      const topTime = await top.evaluate(
        (video: HTMLVideoElement) => video.currentTime,
      );
      return Math.max(
        Math.abs(primaryTime - sideTime),
        Math.abs(primaryTime - topTime),
      );
    })
    .toBeLessThan(0.5);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() => side.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(false);
  await expect
    .poll(() => top.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(false);
  await page.getByRole("button", { name: "Toggle AI overlay" }).click();
  await expect(activeVideo(page)).toHaveAttribute("data-mode", "overlay", {
    timeout: 25_000,
  });
  await expect(side).toBeVisible();
  await expect(top).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toHaveCount(0);
});

test("perception keeps playing and retains clip boundaries", async ({
  page,
}) => {
  await login(page, "/genentech?t=500");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const before = await activeVideo(page).evaluate(
    (v: HTMLVideoElement) => v.currentTime,
  );
  await page.getByRole("button", { name: "Toggle AI overlay" }).click();
  await expect(activeVideo(page)).toHaveAttribute("data-mode", "overlay");
  await expect
    .poll(() => activeVideo(page).evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  const after = await activeVideo(page).evaluate(
    (v: HTMLVideoElement) => v.currentTime,
  );
  expect(after).toBeGreaterThanOrEqual(before);
  expect(after - before).toBeLessThan(4);
  const finding = data.analysis.findings.find(
    (finding) => finding.id === "stock-bypass",
  )!;
  const action = data.actions.find(
    (action) => action.id === finding.actionIds[0],
  )!;
  await page.locator('[data-issue="stock-bypass"] .issue-trigger').click();
  await page.getByRole("button", { name: "Toggle AI overlay" }).click();
  await expect(activeVideo(page)).toHaveAttribute("data-mode", "original");
  await expect(
    page.getByRole("button", { name: "Toggle AI overlay" }),
  ).toBeEnabled();
  await activeVideo(page).evaluate((v: HTMLVideoElement, end) => {
    v.currentTime = end! + 0.1;
  }, action.clipEnd);
  await expect
    .poll(() => activeVideo(page).evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
});

test("the grouped step title replaces atomic captions and playback follows grouped operations", async ({
  page,
}) => {
  await login(page, "/genentech?t=0");
  await expect(page.locator(".action-caption")).toHaveText(records[0].title);
  const caption = await page.locator(".action-caption").boundingBox();
  const fpv = await page.locator(".fpv-view").boundingBox();
  expect(caption!.x - fpv!.x).toBe(14);
  expect(Math.round(fpv!.y + fpv!.height - caption!.y - caption!.height)).toBe(
    14,
  );
  await activeVideo(page).evaluate((v: HTMLVideoElement) => {
    v.currentTime = 66;
  });
  await expect(page.locator(".action-caption")).toHaveCount(0);
  await activeVideo(page).evaluate((v: HTMLVideoElement) => {
    v.currentTime = 68;
  });
  await expect(page.locator(".action-caption")).toHaveText(
    records.find((record) => 68 >= record.start && 68 < record.end)!.title,
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await activeVideo(page).evaluate((v: HTMLVideoElement) => {
    v.currentTime = 705;
  });
  const current = records.find(
    (record) => 705 >= record.start && 705 < record.end,
  )!;
  await expect(page.locator(".action-caption")).toHaveText(current.title);
  await expect(page.locator(`[data-id="${current.id}"]`)).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(
    page.locator(`[data-id="${current.id}"] .live-pointer`),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator(`[data-id="${current.id}"]`).evaluate((element) => {
        const scroll = element.closest(".evidence-scroll")!;
        const header = element
          .closest(".record-step")!
          .querySelector(".record-step-heading")!;
        return Math.abs(
          element.getBoundingClientRect().top -
            scroll.getBoundingClientRect().top -
            header.getBoundingClientRect().height -
            16,
        );
      }),
    )
    .toBeLessThan(2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

test("scrubber, mobile and reduced motion keep the focused explanation usable", async ({
  page,
}) => {
  await login(page);
  const allowed = new Set(data.analysis.findings.map((finding) => finding.id));
  for (const marker of await page.locator("[data-marker-issues]").all())
    for (const id of (await marker.getAttribute("data-marker-issues"))!.split(
      ",",
    ))
      expect(allowed.has(id)).toBe(true);
  await expect(page.locator(".timeline-marker.is-span")).toHaveCount(0);
  await expect(page.locator("[data-chapter-issue]")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator('[data-issue="final-water"] .issue-trigger')
    .scrollIntoViewIfNeeded();
  await page.locator('[data-issue="final-water"] .issue-trigger').click();
  await expect(page.locator(".insight-description")).toHaveText(
    data.analysis.findings.find((finding) => finding.id === "final-water")!
      .description,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(activeVideo(page)).toHaveCSS("transition-duration", "0s");
  await page.screenshot({
    path: "/tmp/transfyr-analysis-mobile.png",
    fullPage: true,
  });
});

test("the previous version remains password protected and preserves its original records and filters", async ({
  page,
}) => {
  const archived = JSON.parse(
    readFileSync("src/data/session-archive.json", "utf8"),
  );
  await page.goto(base + "/genentech/archive?t=394");
  await expect(page.getByLabel("Access password")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page
    .getByLabel("Access password")
    .fill(process.env.CUSTOMER_PASSWORD_GENENTECH!);
  await page.getByLabel("Access password").press("Enter");
  await expect(page).toHaveURL(base + "/genentech/archive?t=394");
  await expect(
    page.getByRole("button", { name: "Major findings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Minor findings" }),
  ).toBeVisible();
  await expect(page.locator(".ai-action-text")).toHaveText(
    archived.actions.map((action: { text: string }) => action.text),
  );
  await expect(page.locator(".record-step")).toHaveCount(archived.steps.length);
  await expect(page.locator(".result-header")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeCloseTo(394, 0);
});

test("a slow perception load holds the current frame and playhead until the new frame is ready", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/media/genentech/overlay.mp4", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await login(page, "/genentech?t=400");
    const toggle = page.getByRole("button", {
      name: "Toggle AI overlay",
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-busy", "true");
    await expect(toggle).toBeDisabled();
    await expect(activeVideo(page)).toHaveAttribute("data-mode", "original");
    await expect(activeVideo(page)).toHaveCSS("opacity", "1");
    await expect(
      page.getByRole("slider", { name: "Seek recording" }),
    ).toHaveValue("400");
    const currentFrame = await activeVideo(page).evaluate(
      (video: HTMLVideoElement) => ({
        time: video.currentTime,
        ready: video.readyState,
      }),
    );
    expect(currentFrame.time).toBeCloseTo(400, 0);
    expect(currentFrame.ready).toBeGreaterThanOrEqual(2);
    release();
    await expect(activeVideo(page)).toHaveAttribute("data-mode", "overlay");
    await expect(toggle).toBeEnabled();
    await expect(
      page.getByRole("slider", { name: "Seek recording" }),
    ).toHaveValue("400");
    await expect(activeVideo(page)).toHaveCSS("opacity", "1");
    await expect(page.locator(".form-error[role=alert]")).toHaveCount(0);
  } finally {
    release();
  }
});
