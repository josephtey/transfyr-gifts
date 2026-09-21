"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Session } from "../lib/types";
import Review from "./Review";
import ResultMetrics from "./ResultMetrics";
import ExitButton from "./ExitButton";

const beats = ["welcome", "challenge", "results", "why"] as const;
type Beat = (typeof beats)[number];

export default function ReviewExperience({
  session,
  slug,
  leaderboardImage,
  protocolImage,
  showIntro,
}: {
  session: Session;
  slug: string;
  leaderboardImage?: string;
  protocolImage?: string;
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
                  Hey! Thanks for stopping by—and for completing the
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
                  onClick={() => advance("challenge")}
                  disabled={leaving}
                >
                  Remember the challenge{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </>
            )}
            {beat === "challenge" && (
              <>
                <div className="intro-challenge-copy">
                  <p className="intro-kicker">The challenge</p>
                  <h1 ref={heading} tabIndex={-1} id="intro-heading">
                    Build a dilution series in duplicate.
                  </h1>
                  <ol className="intro-protocol">
                    <li>
                      <span>01</span>
                      <b>Calibration 1</b>
                      <em>1:1 from BSA stock</em>
                    </li>
                    <li>
                      <span>02</span>
                      <b>Calibration 2</b>
                      <em>1:1 from Calibration 1</em>
                    </li>
                    <li>
                      <span>03</span>
                      <b>Calibration 3</b>
                      <em>1:10 from Calibration 2</em>
                    </li>
                    <li>
                      <span>04</span>
                      <b>Blanks</b>
                      <em>Water only</em>
                    </li>
                  </ol>
                  <p className="intro-protocol-note">
                    Eight tubes · QR top for Calibration 3 · two replicates ·
                    0.45 mL BSA stock available
                  </p>
                  <button
                    className="intro-continue"
                    onClick={() => advance("results")}
                    disabled={leaving}
                  >
                    See my results <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
                {protocolImage && (
                  <div className="intro-protocol-figure">
                    <img
                      src={`/media/${slug}/${protocolImage}`}
                      alt="Diagram of the duplicate BSA dilution series: Calibration 1 at 1 to 1, Calibration 2 at 1 to 1, Calibration 3 at 1 to 10, and water-only blanks."
                    />
                  </div>
                )}
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
            aria-label={`Introduction: ${beat === "welcome" ? "welcome" : beat === "challenge" ? "challenge reminder" : beat === "results" ? "your results" : "explore why"}`}
          >
            {beats.map((step, index) => (
              <span
                key={step}
                data-current={beat === step}
                data-past={index < beats.indexOf(beat)}
              />
            ))}
          </div>
        </main>
      )}
    </>
  );
}
