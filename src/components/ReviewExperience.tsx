"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Session } from "../lib/types";
import Review from "./Review";
import ResultMetrics from "./ResultMetrics";
import ExitButton from "./ExitButton";

type Beat = "welcome" | "results" | "why";

export default function ReviewExperience({
  session,
  slug,
  leaderboardImage,
  showIntro,
}: {
  session: Session;
  slug: string;
  leaderboardImage?: string;
  showIntro: boolean;
}) {
  const [complete, setComplete] = useState(!showIntro);
  const [beat, setBeat] = useState<Beat>("welcome");
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!complete) heading.current?.focus({ preventScroll: true });
  }, [beat, complete]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (complete) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [complete]);

  useEffect(() => {
    if (beat !== "why" || complete) return;
    const controller = new AbortController();
    let revealTimer: ReturnType<typeof setTimeout>;
    setError(false);
    const hold = new Promise<void>((resolve) => {
      revealTimer = setTimeout(resolve, 1900);
    });
    async function revealReview() {
      try {
        const response = await fetch(`/api/intro/${slug}`, {
          method: "POST",
          signal: controller.signal,
        });
        if (response.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.assign(
            `/${slug}/access?next=${encodeURIComponent(next)}`,
          );
          return;
        }
        if (!response.ok)
          throw new Error("Unable to save introduction progress");
        await hold;
        if (controller.signal.aborted) return;
        setComplete(true);
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>(
            ".analysis-review .log-heading h2",
          );
          target?.setAttribute("tabindex", "-1");
          target?.focus({ preventScroll: true });
        });
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void revealReview();
    return () => {
      controller.abort();
      clearTimeout(revealTimer);
    };
  }, [beat, complete, slug, attempt]);

  function advance(next: Beat) {
    if (leaving) return;
    setLeaving(true);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    advanceTimer.current = setTimeout(
      () => {
        setBeat(next);
        setLeaving(false);
      },
      reduced ? 0 : 220,
    );
  }

  return (
    <>
      {(complete || beat === "why") && (
        <div
          className={showIntro ? "review-arrival" : undefined}
          data-revealed={complete}
          inert={!complete}
          aria-hidden={!complete ? true : undefined}
        >
          <Review
            session={session}
            slug={slug}
            leaderboardImage={leaderboardImage}
          />
        </div>
      )}
      {!complete && (
        <main
          className="review-intro"
          aria-label="Calibration challenge introduction"
        >
          <div className="intro-exit">
            <ExitButton slug={slug} />
          </div>
          <section
            key={beat}
            className={`intro-beat intro-${beat}${leaving ? " is-leaving" : ""}`}
            aria-labelledby="intro-heading"
          >
            {beat === "welcome" && (
              <>
                <p className="intro-greeting">
                  Hey! Thanks for stopping by and taking the
                  <br className="intro-desktop-break" /> Transfyr Calibration
                  Challenge.
                </p>
                <h1 ref={heading} tabIndex={-1} id="intro-heading">
                  <span className="intro-line">
                    <span>How do you think</span>
                  </span>
                  <span className="intro-line">
                    <span>you did?</span>
                  </span>
                </h1>
                <button
                  className="intro-continue"
                  onClick={() => advance("results")}
                  disabled={leaving}
                >
                  See my results <ArrowRight size={17} aria-hidden="true" />
                </button>
              </>
            )}
            {beat === "results" && (
              <>
                <h1 ref={heading} tabIndex={-1} id="intro-heading">
                  Your results.
                </h1>
                <ResultMetrics result={session.analysis.result} />
                <button
                  className="intro-continue"
                  onClick={() => advance("why")}
                  disabled={leaving}
                >
                  Take a closer look <ArrowRight size={17} aria-hidden="true" />
                </button>
              </>
            )}
            {beat === "why" && (
              <>
                <h1 ref={heading} tabIndex={-1} id="intro-heading">
                  Why?
                </h1>
                <div className="intro-reveal-line" aria-hidden="true">
                  <span />
                </div>
                {error && (
                  <div className="intro-retry">
                    <p role="alert">
                      Couldn't open the review. Please try again.
                    </p>
                    <button
                      className="intro-continue"
                      onClick={() => setAttempt((value) => value + 1)}
                    >
                      Try again <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <div
            className="intro-progress"
            aria-label={`Introduction: ${beat === "welcome" ? "welcome" : beat === "results" ? "your results" : "explore why"}`}
          >
            {(["welcome", "results", "why"] as const).map((step, index) => (
              <span
                key={step}
                data-current={beat === step}
                data-past={index < ["welcome", "results", "why"].indexOf(beat)}
              />
            ))}
          </div>
        </main>
      )}
    </>
  );
}
