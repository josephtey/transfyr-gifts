import type { Session } from "../lib/types";
import { leaderboardContext } from "../lib/results";
import PercentileScale from "./PercentileScale";

export default function ResultMetrics({
  result,
}: {
  result: Session["analysis"]["result"];
}) {
  const leaderboard = leaderboardContext(result.leaderboard);
  const metricComparisons = result.metricComparisons;
  return (
    <div
      className={`result-metrics ${metricComparisons ? "has-percentile-scales" : ""}`}
      aria-label="Reported result"
    >
      <div>
        <h2 className="result-metric-title">Accuracy</h2>
        <p
          className="result-measurement"
          title="Closest final concentration relative to the expected concentration"
        >
          <strong>+{result.closestAboveTargetPercent}%</strong>
          <span>above expected</span>
        </p>
        {metricComparisons && (
          <PercentileScale
            label="Accuracy"
            comparison={metricComparisons.accuracy}
          />
        )}
      </div>
      <div>
        <h2 className="result-metric-title">Variability</h2>
        <p
          className="result-measurement"
          title="Reported variability between replicates"
        >
          <strong>{result.replicateVariabilityPercent}%</strong>
          <span>variability</span>
        </p>
        {metricComparisons && (
          <PercentileScale
            label="Replicate variability"
            comparison={metricComparisons.variability}
          />
        )}
      </div>
      {!metricComparisons && leaderboard && (
        <div className="leaderboard-context" title={leaderboard.explanation}>
          <strong>≈{leaderboard.ordinal}</strong>
          <span>
            Overall percentile
            <br />
            Rank {leaderboard.rank} of {leaderboard.totalEntries}
          </span>
        </div>
      )}
    </div>
  );
}
