# Review dataset

The shared player receives a server-loaded dataset; never import a real customer dataset into a client component.

```ts
type Session = {
  customer: string;
  title: string;
  duration: number; // seconds on the canonical recording timebase
  overview: { title: string; body: string; caveat: string };
  chapters: { start: number; label: string }[];
  actions: {
    id: string; start: number; end: number;
    text: string; task: string; source: 'AI-generated';
  }[];
  moments: {
    id: string; start: number; end: number; // editorial interval
    title: string; category: string;
    observation: string; meaning: string;
    frame: string;
    sourceRows: {
      row: number; start: number; timestamp: string;
      action: string; note: string; timing: 'explicit' | 'inherited';
    }[];
  }[];
};
```

Require unique IDs; finite seconds; 0 ≤ start < end ≤ recording duration; sorted actions and moments; preserved source row text; and existing still/clip files. Small source/video-duration differences may be due to frame rounding—inspect rather than stretching a timebase. Use half-open active intervals `[start, end)` so adjacent actions do not both claim a boundary. Overlapping source actions need an explicit UI policy rather than silent deduplication.

Storage convention used by the starter: `data/<customer>/session.json`, `media/<customer>/original.mp4`, `media/<customer>/overlay.mp4`, `media/<customer>/clips/<moment>.mp4`, and protected `/frames/<customer>/<moment>.jpg`. Keep the actual backing store private; browser URLs should pass the customer authorization layer. A customer's password environment variable and optional hostname mapping live in server configuration, never in this dataset.
