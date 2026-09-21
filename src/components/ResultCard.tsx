import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { Session } from "../lib/types";
import { leaderboardContext } from "../lib/results";
import PercentileScale from "./PercentileScale";

export default function ResultCard({
  result,
  imageSrc,
  onOpenLeaderboard,
}: {
  result: Session["analysis"]["result"];
  imageSrc?: string;
  onOpenLeaderboard: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const leaderboard = leaderboardContext(result.leaderboard);
  const metricComparisons = result.metricComparisons;

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <section className="result-card" aria-label="Reported result">
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
      {imageSrc && (
        <>
          <div className="result-card-footer">
            <button
              className="leaderboard-button"
              aria-haspopup="dialog"
              onClick={() => {
                onOpenLeaderboard();
                setImageError(false);
                setZoomed(false);
                setOpen(true);
              }}
            >
              See on leaderboard <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
          <dialog
            ref={dialog}
            className="leaderboard-dialog"
            aria-label="Calibration challenge leaderboard"
            onClose={() => setOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) dialog.current?.close();
            }}
          >
            <div className="leaderboard-dialog-content">
              <div className="leaderboard-dialog-toolbar">
                <button
                  className="icon-button"
                  aria-label="Close leaderboard"
                  onClick={() => dialog.current?.close()}
                  autoFocus
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              {open &&
                (imageError ? (
                  <p className="leaderboard-image-error" role="alert">
                    Unable to load the leaderboard. Close and reopen to try
                    again.
                  </p>
                ) : (
                  <div className="leaderboard-image-viewport">
                    <button
                      className="leaderboard-image-toggle"
                      data-zoomed={zoomed}
                      aria-label={
                        zoomed ? "Zoom out leaderboard" : "Zoom in leaderboard"
                      }
                      aria-pressed={zoomed}
                      onClick={() => setZoomed(!zoomed)}
                    >
                      <img
                        className="leaderboard-image"
                        src={imageSrc}
                        alt="Calibration challenge leaderboard, with your result highlighted in yellow."
                        onError={() => setImageError(true)}
                      />
                    </button>
                  </div>
                ))}
            </div>
          </dialog>
        </>
      )}
    </section>
  );
}
