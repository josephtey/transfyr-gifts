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
  return (
    <section className="result-card" aria-label="Reported result">
      <ResultMetrics result={result} />
      {imageSrc && (
        <>
          <div className="result-card-footer">
            <LeaderboardDialog
              imageSrc={imageSrc}
              onOpen={onOpenLeaderboard}
            />
          </div>
        </>
      )}
    </section>
  );
}
