# Review dataset

Load the customer dataset on the server after authentication. Keep actual customer evidence out of the public source repository. The current view uses schema version 7, with a private audit, grouped AI operations and separate human findings. The archived detailed view uses schema version 4.

```ts
type Action = {
  id: string;
  start: number; end: number; // original AI interval in seconds
  text: string; // exact original atomic action, retained for audit
  annotation?: string; // optional editorial audit; NEVER use in System of Record
  task: string; source: 'AI-generated';
  ontologyId: string | null; sourcePointer: string;
  reviewIds: string[]; issueIds: string[];
  clipStart?: number; clipEnd?: number; clipFile?: string;
};
type HumanReview = {
  id: string; row: number;
  start: number; timestamp: string;
  step: string; error: string; // verbatim source cells
  timing: 'explicit' | 'inherited'; inheritedFrom: number | null;
  primaryActionId: string; contextActionIds: string[];
  relationship: 'confirms' | 'detail' | 'correction' | 'missing' | 'context' | 'ambiguous';
  explanation: string; // private alignment audit, not customer copy
};
type Issue = {
  id: string; kind: 'error' | 'risk' | 'observation';
  tier: 'major' | 'minor'; stepIds: string[];
  category: string; title: string; description: string;
  reviewIds: string[]; summaryIds: string[];
  actionIds: string[]; contextActionIds: string[];
  scope: 'events' | 'run-level';
};
type SummaryNote = {
  id: string; row: number; column: string; text: string;
  kind: string; timing: 'run-level';
};
type RecordStep = {
  id: string; name: string; instruction: string;
  start: number | null; end: number | null;
  actionIds: string[];
  segments: { id: string; actionIds: string[] }[];
  counts: { errors: number; observations: number; risks: number } | null;
};
type ScientificCaution = {
  id: string; reviewIds: string[]; summaryIds: string[];
  reason: string; // private scientific assessment; preserve uncertainty in customer copy
};
type Session = {
  schemaVersion: 7; customer: string; operator: string;
  title: string; duration: number;
  analysis: {
    result: {
      closestAboveTargetPercent: number; replicateVariabilityPercent: number;
      summary: string; leaderboard?: { rank: number; totalEntries: number };
      metricComparisons?: {
        accuracy: { rank: number; totalEntries: number } | { estimate: number; totalEntries: number };
        variability: { rank: number; totalEntries: number } | { estimate: number; totalEntries: number };
      };
    };
    stages: {
      stepId: string; findingIds: string[];
      records: { id: string; title: string; text: string; start: number; end: number; actionIds: string[] }[];
    }[];
    findings: Issue[];
  };
  steps: RecordStep[];
  protocol: {id: string; title: string; text: string; label: string}[];
  sourceSteps?: unknown[]; // untouched source hierarchy, private provenance
  scientificCautions: ScientificCaution[];
  actions: Action[]; reviews: HumanReview[];
  issues: Issue[]; summaryNotes: SummaryNote[];
  sources: { ai: string; human: string };
  counts: {
    errorNotes: number; timedErrorNotes: number; runLevelErrorNotes: number;
    sourceErrorCells: number; humanRows: number; errorCategories: number;
  };
};
```

Validate unique IDs, sorted finite intervals, `0 ≤ start < end ≤ duration`, valid source pointers and all references. Preserve one canonical row per AI atomic action. Use half-open active intervals `[start, end)`; gaps must not retain stale captions. Match human steps semantically as well as temporally. Preserve contradictory labels in the audit and avoid unsupported specificity in customer findings. Display source `text` verbatim in the archived detailed view; use neutral source-grounded operation summaries in the current System of Record; keep evaluative human assertions in `Issue` descriptions.

Every human clear-error cell and run-summary note must reach a finding in the private evidence record; the current customer view may select only outcome-relevant findings. Unresolved source claims can remain in the Minor tier as qualified observations or risks, with private scientific cautions. Raw notes must not disappear when scientific review changes the displayed classification. Deduplicate error counts by source note ID, since one note may support several categories. Keep risks and observations separate. Untimed continuations may inherit a preceding timestamp with their parent row recorded; run-level omissions have sequence context and no fabricated point observation.

Use `actionIds` for direct evidence and `contextActionIds` for surrounding sequence. Keep those sets disjoint. The shared scrolling view can group contiguous task segments, repeat a finding beside its evidence in each segment, and draw each relationship once. Check connector endpoints after resizing, scrolling and content changes. Visual instances never change the data count.

Storage paths: `data/<customer>/session-v7.json`, `media/<customer>/original.mp4`, `media/<customer>/overlay.mp4`, `media/<customer>/clips/action-<action-id>.mp4`, and private frames. Change the dataset filename when rolling out incompatible schemas so an older deployment can still load its original data. Browser media paths pass through customer authorization. Customer passwords and hostname mappings belong in server configuration, never in the dataset.

Manual stages follow observed work and the original protocol. Keep unknown stages untimed and their counts null, not zero. Assign each finding explicit `stepIds` from its primary evidence; assign a run-level omission to the relevant protocol stage. Context actions do not establish ownership. Only render findings within those stages, so a setup step cannot show an error counted under a later dilution step.

For the archived tiered view, stored counts describe all findings. Tier-filter buttons show errors available in each tier. Recompute stage counts from the selected tiers, using the same stage ownership as rendering. Each category counts unique source review IDs; errors require a nonempty error cell. Run-level findings add their unique summary IDs once in the owning stage. A category spanning stages can repeat visually without adding new notes. Preserve pre-rendered clip metadata through every ingestion run.

In the archived tiered view, the initial selected tiers are `["major"]`. The two filter buttons support independent selection, including both or neither. Build scrubber markers from the filtered findings of all three categories; merge nearby same-kind notes without losing source coverage, and retain run-level omissions as stage ranges in data but display a small colored chapter indicator instead of a long band.

## Result-led projection

Schema 7 uses `analysis.result` for supplied percentages, an explanatory summary and optional leaderboard rank/cohort size. Keep leaderboard provenance privately. Display approximate overall performance percentile as the share of entries ranked below the subject; do not invent per-measurement percentiles or a score formula. Optional `metricComparisons` supplies independent ranks or, when the user accepts approximation, image-based percentile estimates for the individual horizontal scales. Estimates must be visibly labeled, rounded to avoid spurious precision and never converted into purported exact ranks. Preserve the image and estimate rationale in the private audit.

`analysis.stages` has one entry per protocol stage, each with `stepId`, ordered `records` and `findingIds`. Each record has a stable ID, neutral title/summary, source action IDs, and start/end inherited from its first/last source actions. Cover every original action once, in order. Keep group boundaries meaningful and unknown stages empty/untimed. The video overlay uses the current grouped title, not atomic-action text.

`analysis.findings` retains direct/context source links and private source issue IDs. Map original action links onto the containing grouped records for drawing connections; preserve direct versus contextual support. Original `actions`, `issues`, human reviews and source hierarchy remain unchanged. Only the analysis findings appear in the current customer view, with no severity filters. Do not recalculate or rename a supplied variability statistic without its measurement definition.

The archived schema-4 view uses a separately frozen dataset and authenticated archive route. Keep the archive snapshot out of public Git and independent of the current dataset path.
