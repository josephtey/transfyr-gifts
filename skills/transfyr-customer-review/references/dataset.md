# Review dataset

Load the customer dataset on the server after authentication. Keep actual customer evidence out of the public source repository. The starter uses schema version 2, with a private audit, a source AI record and separate human findings.

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
  category: string; title: string; description: string;
  reviewIds: string[]; summaryIds: string[];
  actionIds: string[]; contextActionIds: string[];
  scope: 'events' | 'run-level';
};
type SummaryNote = {
  id: string; row: number; column: string; text: string;
  kind: string; timing: 'run-level';
};
type Session = {
  schemaVersion: 2; customer: string; operator: string;
  title: string; duration: number;
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

Every human clear-error cell and run-summary note must reach a finding. Deduplicate error counts by source note ID, since one note may support several categories. Keep risks and observations separate. Untimed continuations may inherit a preceding timestamp with their parent row recorded; run-level omissions have sequence context and no fabricated point observation.

Use `actionIds` for direct evidence and `contextActionIds` for surrounding sequence. Keep those sets disjoint. The shared scrolling view can group contiguous task segments, repeat a finding beside its evidence in each segment, and draw each relationship once. Check connector endpoints after resizing, scrolling and content changes. Visual instances never change the data count.

Storage paths: `data/<customer>/session-v2.json`, `media/<customer>/original.mp4`, `media/<customer>/overlay.mp4`, `media/<customer>/clips/action-<action-id>.mp4`, and private frames. Change the dataset filename when rolling out incompatible schemas so an older deployment can still load its original data. Browser media paths pass through customer authorization. Customer passwords and hostname mappings belong in server configuration, never in the dataset.
