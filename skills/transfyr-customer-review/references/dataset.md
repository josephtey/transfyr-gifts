# Review dataset

Load the customer dataset on the server after authentication. Keep actual customer evidence out of the public source repository. The starter uses schema version 4, with a private audit, a source AI record and separate human findings.

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
  schemaVersion: 4; customer: string; operator: string;
  title: string; duration: number;
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

Validate unique IDs, sorted finite intervals, `0 ≤ start < end ≤ duration`, valid source pointers and all references. Preserve one canonical row per AI atomic action. Use half-open active intervals `[start, end)`; gaps must not retain stale captions. Match human steps semantically as well as temporally. Preserve contradictory labels in the audit and avoid unsupported specificity in customer findings. Display `text` verbatim in System of Record; keep evaluative human assertions in `Issue` descriptions.

Every human clear-error cell and run-summary note must reach a finding. Unresolved source claims can remain in the Minor tier as qualified observations or risks, with private scientific cautions. Raw notes must not disappear when scientific review changes the displayed classification. Deduplicate error counts by source note ID, since one note may support several categories. Keep risks and observations separate. Untimed continuations may inherit a preceding timestamp with their parent row recorded; run-level omissions have sequence context and no fabricated point observation.

Use `actionIds` for direct evidence and `contextActionIds` for surrounding sequence. Keep those sets disjoint. The shared scrolling view can group contiguous task segments, repeat a finding beside its evidence in each segment, and draw each relationship once. Check connector endpoints after resizing, scrolling and content changes. Visual instances never change the data count.

Storage paths: `data/<customer>/session-v4.json`, `media/<customer>/original.mp4`, `media/<customer>/overlay.mp4`, `media/<customer>/clips/action-<action-id>.mp4`, and private frames. Change the dataset filename when rolling out incompatible schemas so an older deployment can still load its original data. Browser media paths pass through customer authorization. Customer passwords and hostname mappings belong in server configuration, never in the dataset.

Manual stages follow observed work and the original protocol. Keep unknown stages untimed and their counts null, not zero. Assign each finding explicit `stepIds` from its primary evidence; assign a run-level omission to the relevant protocol stage. Context actions do not establish ownership. Only render findings within those stages, so a setup step cannot show an error counted under a later dilution step.

Stored counts describe all findings. Tier-filter buttons show errors available in each tier. Recompute stage counts from the selected tiers, using the same stage ownership as rendering. Each category counts unique source review IDs; errors require a nonempty error cell. Run-level findings add their unique summary IDs once in the owning stage. A category spanning stages can repeat visually without adding new notes. Preserve pre-rendered clip metadata through every ingestion run.

The initial selected tiers are `["major"]`. The two filter buttons support independent selection, including both or neither. Build scrubber markers from the filtered findings of all three categories; merge nearby same-kind notes without losing source coverage, and retain run-level omissions as stage ranges in data but display a small colored chapter indicator instead of a long band.
