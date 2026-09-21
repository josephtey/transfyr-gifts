import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Session } from "../lib/types";
import ResultMetrics from "./ResultMetrics";
import LeaderboardDialog from "./LeaderboardDialog";

export default function ResultCard({
  result,
  imageSrc,
  onOpenLeaderboard,
}: {
  result: Session["analysis"]["result"];
  imageSrc?: string;
  onOpenLeaderboard: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="result-card" aria-label="How did you do?">
      <button
        className="result-card-toggle"
        aria-expanded={expanded}
        aria-controls="review-performance"
        onClick={() => setExpanded((value) => !value)}
      >
        <span>How did you do?</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {expanded && (
        <div id="review-performance" className="result-card-content">
          <ResultMetrics result={result} />
          {imageSrc && (
          <div className="result-card-footer">
            <LeaderboardDialog
              imageSrc={imageSrc}
              onOpen={onOpenLeaderboard}
            />
          </div>
          )}
        </div>
      )}
    </section>
  );
}
