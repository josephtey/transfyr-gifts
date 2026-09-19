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

export type TimelineMarker = {
  id: string;
  kind: Issue["kind"];
  start: number;
  end?: number;
  actionId: string;
  issueIds: string[];
  reviewIds: string[];
};

export function buildTimelineMarkers(
  issues: Issue[],
  reviews: HumanReview[],
  steps: RecordStep[],
) {
  const markers: TimelineMarker[] = [];
  for (const kind of ["error", "risk", "observation"] as const) {
    const relevant = issues.filter((issue) => issue.kind === kind);
    const notes = reviews
      .filter((review) =>
        relevant.some((issue) => issue.reviewIds.includes(review.id)),
      )
      .sort((a, b) => a.start - b.start);
    let cluster: TimelineMarker | undefined;
    let clusterStep: string | undefined;
    for (const note of notes) {
      const step = steps.find((stage) =>
        stage.actionIds.includes(note.primaryActionId),
      )?.id;
      const ids = relevant
        .filter((issue) => issue.reviewIds.includes(note.id))
        .map((issue) => issue.id);
      // Keep nearby same-category notes in one target without dropping their links.
      if (cluster && clusterStep === step && note.start - cluster.start <= 8) {
        cluster.reviewIds.push(note.id);
        cluster.issueIds = [...new Set([...cluster.issueIds, ...ids])];
      } else {
        cluster = {
          id: `${kind}-${note.id}`,
          kind,
          start: note.start,
          actionId: note.primaryActionId,
          issueIds: ids,
          reviewIds: [note.id],
        };
        markers.push(cluster);
        clusterStep = step;
      }
    }
    // An omission spans its protocol stage; it is not a fabricated point event.
    for (const issue of relevant.filter(
      (finding) => finding.scope === "run-level",
    )) {
      for (const step of steps.filter((stage) =>
        issue.stepIds.includes(stage.id),
      )) {
        if (step.start === null || step.end === null) continue;
        markers.push({
          id: `${issue.id}-${step.id}`,
          kind,
          start: step.start,
          end: step.end,
          actionId:
            step.actionIds.find((id) => issue.contextActionIds.includes(id)) ||
            step.actionIds[0],
          issueIds: [issue.id],
          reviewIds: [],
        });
      }
    }
  }
  return markers.sort((a, b) => a.start - b.start);
}
