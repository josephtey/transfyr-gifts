import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const session = JSON.parse(readFileSync("src/data/session.json"));
const raw = JSON.parse(readFileSync("genentech/output.json"));
const original = raw.episodes.flatMap((e) =>
  e.steps.flatMap((s) => s.tasks.flatMap((t) => t.atomic_actions)),
);
const actions = new Map(session.actions.map((a) => [a.id, a]));
const reviews = new Map(session.reviews.map((r) => [r.id, r]));
test("every AI action retains its exact source text, time interval and ontology identifier", () => {
  assert.equal(session.actions.length, original.length);
  session.actions.forEach((a, index) => {
    const r = original[index];
    assert.equal(a.text, r.atomic_action);
    assert.equal(a.start, r.start_s);
    assert.equal(a.end, r.end_s);
    assert.equal(a.ontologyId, r.action_id);
    const pointer = a.sourcePointer.split("/").slice(1);
    assert.deepEqual(
      pointer.reduce((node, key) => node[key], raw),
      r,
    );
  });
});
test("source steps and tasks retain their hierarchy and cover every action once", () => {
  assert.equal(
    session.sourceSteps.length,
    raw.episodes.flatMap((e) => e.steps).length,
  );
  const protocolIds = new Set(
    session.protocol.map((instruction) => instruction.id),
  );
  for (const step of session.sourceSteps) {
    const source = step.sourcePointer
      .split("/")
      .slice(1)
      .reduce((node, key) => node[key], raw);
    assert.equal(step.name, source.step_name);
    assert.equal(step.sourceId, source.step_id);
    assert.equal(step.start, source.start_s);
    assert.equal(step.end, source.end_s);
    assert.equal(step.tasks.length, source.tasks.length);
    step.tasks.forEach((task, index) => {
      const originalTask = source.tasks[index];
      assert.equal(task.name, originalTask.task_name);
      assert.equal(task.sourceId, originalTask.task_id);
      assert.equal(task.start, originalTask.start_s);
      assert.equal(task.end, originalTask.end_s);
      assert.deepEqual(
        task.actionIds.map((id) => actions.get(id).text),
        originalTask.atomic_actions.map((a) => a.atomic_action),
      );
      assert.ok(task.protocolIds.length > 0);
      task.protocolIds.forEach((id) => assert.ok(protocolIds.has(id)));
    });
  }
  assert.deepEqual(
    session.sourceSteps.flatMap((s) => s.tasks.flatMap((t) => t.actionIds)),
    session.actions.map((a) => a.id),
  );
});
test("manual protocol stages cover all actions without inventing a blank preparation", () => {
  assert.deepEqual(
    session.steps.map((step) => step.name),
    session.protocol.map((instruction) => instruction.title),
  );
  assert.deepEqual(
    session.steps.flatMap((step) => step.actionIds),
    session.actions.map((a) => a.id),
  );
  for (const step of session.steps) {
    assert.equal(
      step.instruction,
      session.protocol.find((p) => p.id === step.id).text,
    );
    assert.deepEqual(
      step.segments.flatMap((segment) => segment.actionIds),
      step.actionIds,
    );
    if (step.actionIds.length) {
      assert.equal(step.start, actions.get(step.actionIds[0]).start);
      assert.equal(step.end, actions.get(step.actionIds.at(-1)).end);
    } else {
      assert.equal(step.start, null);
      assert.equal(step.end, null);
    }
  }
  assert.deepEqual(session.steps.find((s) => s.id === "blanks").actionIds, []);
  for (const [id, row] of [
    ["calibration-1", "review-5"],
    ["calibration-2", "review-25"],
    ["calibration-3", "review-52"],
  ]) {
    assert.ok(
      session.steps
        .find((s) => s.id === id)
        .actionIds.includes(reviews.get(row).primaryActionId),
    );
  }
});
test("all human error cells and run summaries are traceable; each review has one primary action", () => {
  for (const r of session.reviews) {
    assert.ok(actions.has(r.primaryActionId));
    assert.ok(actions.get(r.primaryActionId).reviewIds.includes(r.id));
    r.contextActionIds.forEach((id) => assert.ok(actions.has(id)));
    if (r.timing === "inherited") {
      assert.equal(r.timestamp, "");
      assert.equal(
        r.start,
        session.reviews.find((x) => x.row === r.inheritedFrom).start,
      );
    }
    if (r.error)
      assert.ok(
        session.issues.some((i) => i.reviewIds.includes(r.id)),
        r.id,
      );
  }
  for (const n of session.summaryNotes)
    assert.ok(
      session.issues.some((i) => i.summaryIds.includes(n.id)),
      n.id,
    );
  for (const i of session.issues) {
    assert.equal(new Set(i.actionIds).size, i.actionIds.length);
    for (const id of i.actionIds) {
      assert.ok(actions.has(id));
      assert.ok(
        i.reviewIds.some((rid) => reviews.get(rid).primaryActionId === id),
      );
    }
    for (const id of i.contextActionIds) assert.ok(!i.actionIds.includes(id));
  }
});
test("error totals deduplicate shared notes and distinguish run-level omissions, risks and observations", () => {
  const errors = session.issues.filter((i) => i.kind === "error");
  const notes = new Set(
    errors.flatMap((i) => i.reviewIds).filter((id) => reviews.get(id).error),
  );
  const summary = new Set(
    errors.filter((i) => i.scope === "run-level").flatMap((i) => i.summaryIds),
  );
  assert.equal(session.counts.errorNotes, notes.size + summary.size);
  assert.equal(
    session.counts.sourceErrorCells,
    session.reviews.filter((r) => r.error).length,
  );
  assert.ok(
    errors.flatMap((i) => i.reviewIds).length >= notes.size,
    "Many-to-many references must not inflate the headline count.",
  );
  for (const i of session.issues.filter((i) => i.scope === "run-level")) {
    assert.deepEqual(i.actionIds, []);
    assert.ok(i.contextActionIds.length > 0);
    assert.deepEqual(i.reviewIds, []);
  }
});
test("missing actions, timing offsets, and internal reviewer contradictions remain explicit", () => {
  assert.equal(reviews.get("review-5").relationship, "correction");
  assert.equal(reviews.get("review-15").relationship, "missing");
  assert.equal(reviews.get("review-12").primaryActionId, "ai-40");
  assert.ok(reviews.get("review-12").start < actions.get("ai-40").start);
  for (const id of ["review-47", "review-49", "review-51"])
    assert.equal(reviews.get(id).relationship, "ambiguous");
  assert.equal(
    session.issues.find((i) => i.id === "calibration-two-volume").kind,
    "observation",
  );
});

test("only accepted findings are displayed and their stage counts agree with placement", () => {
  const expectedCounts = new Map();
  for (const stage of session.steps) {
    if (!stage.actionIds.length) {
      assert.equal(stage.counts, null);
      continue;
    }
    const counts = {};
    for (const [kind, label] of [
      ["error", "errors"],
      ["observation", "observations"],
      ["risk", "risks"],
    ]) {
      const findings = session.issues.filter(
        (i) => i.kind === kind && i.stepIds.includes(stage.id),
      );
      const notes = new Set(
        findings
          .flatMap((i) => i.reviewIds)
          .filter(
            (id) =>
              stage.actionIds.includes(reviews.get(id).primaryActionId) &&
              (kind !== "error" || reviews.get(id).error),
          ),
      );
      const summaries = new Set(
        findings
          .filter((i) => i.scope === "run-level")
          .flatMap((i) => i.summaryIds),
      );
      counts[label] = notes.size + summaries.size;
      assert.equal(
        findings.length === 0,
        counts[label] === 0,
        `${stage.id}: visible ${kind} findings must agree with counts`,
      );
    }
    expectedCounts.set(stage.id, counts);
    assert.deepEqual(stage.counts, counts);
  }
  assert.equal(
    session.steps.reduce((sum, stage) => sum + (stage.counts?.errors ?? 0), 0),
    session.counts.errorNotes,
  );
  for (const issue of session.issues) {
    assert.ok(issue.stepIds.length);
    for (const id of issue.stepIds)
      assert.ok(session.steps.some((s) => s.id === id));
    for (const id of issue.actionIds) {
      const owner = session.steps.find((s) => s.actionIds.includes(id));
      assert.ok(issue.stepIds.includes(owner.id));
    }
  }
  for (const id of [
    "second-stop",
    "filter-wetting",
    "bubbles",
    "return-to-source",
  ]) {
    assert.equal(
      session.issues.find((i) => i.id === id).tier,
      ["filter-wetting", "return-to-source"].includes(id) ? "major" : "minor",
    );
    assert.notEqual(session.issues.find((i) => i.id === id).kind, "error");
    assert.ok(
      session.scientificCautions.some((i) => i.id === id && i.reason.length),
    );
  }
  for (const note of session.summaryNotes) {
    assert.ok(
      session.issues.some(
        (issue) => issue.tier === "major" && issue.summaryIds.includes(note.id),
      ),
      `${note.id}: every human summary theme must appear in Major`,
    );
  }
  assert.equal(session.issues.find((i) => i.id === "tip-reuse").kind, "risk");
  assert.equal(
    session.issues.find((i) => i.id === "final-mixing").kind,
    "risk",
  );
  assert.deepEqual(session.issues.find((i) => i.id === "no-mixing").stepIds, [
    "calibration-1",
  ]);
  assert.equal(
    session.issues.some((i) => i.stepIds.includes("arrangement")),
    false,
  );
});
test("prepared media clips keep their boundaries and exist after ingestion", async () => {
  const { stat } = await import("node:fs/promises");
  for (const a of session.actions.filter((a) => a.clipFile)) {
    assert.ok(a.clipStart >= 0 && a.clipStart <= a.start);
    assert.ok(a.clipEnd >= a.end && a.clipEnd <= session.duration);
    assert.ok(
      (await stat(`public/media/genentech/clips/${a.clipFile}`)).size > 0,
    );
  }
  assert.ok(session.actions.find((a) => a.id === "ai-44").clipFile);
});

test("timeline clusters retain every selected category's notes and omissions remain ranges", async () => {
  const { buildTimelineMarkers } = await import("../src/lib/findings.ts");
  for (const selected of [
    session.issues.filter((i) => i.tier === "major"),
    session.issues.filter((i) => i.tier === "minor"),
    session.issues,
  ]) {
    const markers = buildTimelineMarkers(
      selected,
      session.reviews,
      session.steps,
    );
    for (const issue of selected)
      for (const reviewId of issue.reviewIds) {
        assert.ok(
          markers.some(
            (marker) =>
              marker.kind === issue.kind &&
              marker.issueIds.includes(issue.id) &&
              marker.reviewIds.includes(reviewId),
          ),
        );
      }
    for (const marker of markers) {
      assert.ok(
        marker.issueIds.every((id) =>
          selected.some((i) => i.id === id && i.kind === marker.kind),
        ),
      );
      if (marker.end !== undefined) {
        assert.ok(marker.end > marker.start);
        assert.equal(marker.reviewIds.length, 0);
        assert.ok(
          marker.issueIds.every(
            (id) => selected.find((i) => i.id === id).scope === "run-level",
          ),
        );
      } else {
        assert.equal(
          marker.start,
          Math.min(...marker.reviewIds.map((id) => reviews.get(id).start)),
        );
      }
    }
  }
});

test("grouped records cover every source action and retain only explanation-relevant findings", () => {
  assert.equal(session.schemaVersion, 7);
  assert.equal(session.analysis.stages.length, session.steps.length);
  assert.equal(session.analysis.findings.length, 8);
  const included = new Set(
    session.analysis.findings.map((finding) => finding.id),
  );
  assert.deepEqual(
    new Set(session.analysis.stages.flatMap((stage) => stage.findingIds)),
    included,
  );
  for (const stage of session.analysis.stages) {
    assert.ok(session.steps.some((step) => step.id === stage.stepId));
    const step = session.steps.find((step) => step.id === stage.stepId);
    assert.deepEqual(
      stage.records.flatMap((record) => record.actionIds),
      step.actionIds,
    );
    for (const record of stage.records) {
      assert.ok(record.title && record.text && record.actionIds.length);
      assert.equal(record.start, actions.get(record.actionIds[0]).start);
      assert.equal(record.end, actions.get(record.actionIds.at(-1)).end);
    }
    for (const id of stage.findingIds)
      assert.deepEqual(
        session.analysis.findings.find((finding) => finding.id === id).stepIds,
        [stage.stepId],
      );
  }
  const grouped = session.analysis.stages.flatMap((stage) => stage.records);
  assert.equal(
    new Set(grouped.map((record) => record.id)).size,
    grouped.length,
  );
  assert.deepEqual(
    grouped.flatMap((record) => record.actionIds),
    session.actions.map((action) => action.id),
  );
  for (const finding of session.analysis.findings) {
    assert.ok(finding.reviewIds.length || finding.summaryIds.length);
    for (const id of finding.reviewIds) assert.ok(reviews.has(id));
    for (const id of finding.actionIds.concat(finding.contextActionIds))
      assert.ok(actions.has(id));
    for (const id of finding.sourceIssueIds)
      assert.ok(session.issues.some((issue) => issue.id === id));
    assert.ok(finding.description.length);
  }
  const excluded = [
    "tip-in-water",
    "tip-contact",
    "tip-reuse",
    "tip-fit",
    "bubbles",
    "return-to-source",
  ];
  assert.ok(
    session.analysis.findings.every((finding) =>
      finding.sourceIssueIds.every((id) => !excluded.includes(id)),
    ),
  );
  assert.match(
    session.analysis.findings.find((finding) => finding.id === "final-water")
      .description,
    /If .*fully dispensed/,
  );
});

test("leaderboard context uses overall rank with higher performance percentiles meaning better placement", async () => {
  const { leaderboardContext } = await import("../src/lib/results.ts");
  assert.equal(
    leaderboardContext({ rank: 1, totalEntries: 100 }).percentile,
    99,
  );
  assert.equal(
    leaderboardContext({ rank: 100, totalEntries: 100 }).percentile,
    0,
  );
  assert.equal(
    leaderboardContext({ rank: 80, totalEntries: 100 }).ordinal,
    "20th",
  );
  assert.equal(
    leaderboardContext({ rank: 19, totalEntries: 100 }).ordinal,
    "81st",
  );
  assert.equal(
    leaderboardContext({ rank: 89, totalEntries: 100 }).ordinal,
    "11th",
  );
  for (const input of [
    undefined,
    { rank: 0, totalEntries: 10 },
    { rank: 11, totalEntries: 10 },
    { rank: 1, totalEntries: 0 },
  ])
    assert.equal(leaderboardContext(input), null);
  const { rank, totalEntries } = session.analysis.result.leaderboard;
  assert.ok(rank >= 1 && rank <= totalEntries);
});

test("image-based metric estimates are labeled and never manufacture exact ranks", async () => {
  const { metricPercentileContext } = await import("../src/lib/results.ts");
  const estimated = metricPercentileContext({
    estimate: 35,
    totalEntries: 100,
  });
  assert.equal(estimated.percentile, 35);
  assert.equal(estimated.estimated, true);
  assert.match(estimated.detail, /Estimated from .* image/);
  assert.equal("rank" in estimated, false);
  const measured = metricPercentileContext({ rank: 25, totalEntries: 100 });
  assert.equal(measured.percentile, 75);
  assert.equal(measured.estimated, false);
  for (const value of [-1, 101, NaN, Infinity])
    assert.equal(
      metricPercentileContext({ estimate: value, totalEntries: 100 }),
      null,
    );
  for (const comparison of Object.values(
    session.analysis.result.metricComparisons,
  )) {
    const context = metricPercentileContext(comparison);
    assert.ok(context && context.percentile >= 0 && context.percentile <= 100);
  }
});
