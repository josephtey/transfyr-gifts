import type { HumanReview, Issue, RecordStep } from "./types";

// Count source notes, not repeated cards or connector branches. Use the same
// assigned steps for visibility and totals; neighboring context is not ownership.
export function countFindings(
  issues: Issue[],
  reviews: HumanReview[],
  step?: RecordStep,
) {
  const counts = { errors: 0, observations: 0, risks: 0 };
  const byId = new Map(reviews.map((review) => [review.id, review]));
  for (const [kind, key] of [
    ["error", "errors"],
    ["observation", "observations"],
    ["risk", "risks"],
  ] as const) {
    const selected = issues.filter(
      (issue) =>
        issue.kind === kind && (!step || issue.stepIds.includes(step.id)),
    );
    const notes = new Set(
      selected
        .flatMap((issue) => issue.reviewIds)
        .filter((id) => {
          const review = byId.get(id);
          return (
            review &&
            (kind !== "error" || review.error) &&
            (!step || step.actionIds.includes(review.primaryActionId))
          );
        }),
    );
    const summaries = new Set(
      selected
        .filter((issue) => issue.scope === "run-level")
        .flatMap((issue) => issue.summaryIds),
    );
    counts[key] = notes.size + summaries.size;
  }
  return counts;
}
