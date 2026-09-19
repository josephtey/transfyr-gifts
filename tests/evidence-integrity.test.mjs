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
    errors.flatMap((i) => i.reviewIds).length > notes.size,
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
    session.issues.find((i) => i.id === "bubbles").kind,
    "observation",
  );
});
