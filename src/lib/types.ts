import type { MetricComparison } from "./results";

export type ReviewRelationship =
  "confirms" | "detail" | "correction" | "missing" | "context" | "ambiguous";
export type HumanReview = {
  id: string;
  row: number;
  start: number;
  timestamp: string;
  step: string;
  error: string;
  timing: "explicit" | "inherited";
  inheritedFrom: number | null;
  primaryActionId: string;
  contextActionIds: string[];
  relationship: ReviewRelationship;
  explanation: string;
};
export type SummaryNote = {
  id: string;
  row: number;
  column: string;
  text: string;
  kind: string;
  timing: "run-level";
};
export type Issue = {
  id: string;
  tier: "major" | "minor";
  kind: "error" | "risk" | "observation";
  category: string;
  title: string;
  description: string;
  reviewIds: string[];
  summaryIds: string[];
  actionIds: string[];
  contextActionIds: string[];
  scope: "events" | "run-level";
  stepIds: string[];
};
export type Action = {
  annotation?: string;
  id: string;
  start: number;
  end: number;
  text: string;
  task: string;
  source: "AI-generated";
  ontologyId: string | null;
  sourcePointer: string;
  reviewIds: string[];
  issueIds: string[];
  clipStart?: number;
  clipEnd?: number;
  clipFile?: string;
};
export type RecordSegment = {
  id: string;
  actionIds: string[];
};
export type ProtocolInstruction = {
  id: string;
  title: string;
  text: string;
  label: string;
};
export type RecordStep = {
  id: string;
  name: string;
  instruction: string;
  start: number | null;
  end: number | null;
  actionIds: string[];
  segments: RecordSegment[];
  counts: { errors: number; observations: number; risks: number } | null;
};
export type CoarseRecord = {
  id: string;
  title: string;
  text: string;
  start: number;
  end: number;
  actionIds: string[];
};
export type Session = {
  schemaVersion: 9;
  analysis: {
    result: {
      closestAboveTargetPercent: number;
      replicateVariabilityPercent: number;
      summary: string;
      leaderboard?: { rank: number; totalEntries: number };
      metricComparisons?: {
        accuracy: MetricComparison;
        variability: MetricComparison;
      };
    };
    stages: {
      stepId: string;
      records: CoarseRecord[];
      findingIds: string[];
    }[];
    findings: Issue[];
  };
  customer: string;
  operator: string;
  title: string;
  duration: number;
  steps: RecordStep[];
  protocol: ProtocolInstruction[];
  actions: Action[];
  reviews: HumanReview[];
  issues: Issue[];
  summaryNotes: SummaryNote[];
  sources: { ai: string; human: string };
  counts: {
    errorNotes: number;
    timedErrorNotes: number;
    runLevelErrorNotes: number;
    sourceErrorCells: number;
    humanRows: number;
    errorCategories: number;
  };
};
export type ArchivedSession = Omit<Session, "schemaVersion" | "analysis"> & {
  schemaVersion: 4;
};
