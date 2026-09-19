export type Observation = {
  row: number;
  start: number;
  timestamp: string;
  action: string;
  note: string;
  timing: string;
};
export type Moment = {
  id: string;
  start: number;
  end: number;
  title: string;
  category: string;
  observation: string;
  meaning: string;
  sourceRows: Observation[];
  frame: string;
};
export type Action = {
  id: string;
  start: number;
  end: number;
  text: string;
  task: string;
  source: string;
};
export type Session = {
  overview: { title: string; body: string; caveat: string };
  customer: string;
  operator: string;
  title: string;
  duration: number;
  actions: Action[];
  moments: Moment[];
  chapters: { start: number; label: string }[];
};
