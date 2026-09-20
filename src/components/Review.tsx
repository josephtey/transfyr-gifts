"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Scan,
  ChevronDown,
} from "lucide-react";
import type { Session, Issue, RecordStep, CoarseRecord } from "../lib/types";
import PercentileScale from "./PercentileScale";
import EvidenceSection from "./EvidenceSection";
import SynchronizedVideo, {
  type SynchronizedVideoHandle,
} from "./SynchronizedVideo";
import { leaderboardContext } from "../lib/results";
import { buildTimelineMarkers } from "../lib/findings";

const clock = (time: number) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
const kindLabel = { error: "Error", risk: "Risk", observation: "Observation" };

function linkRecords(finding: Issue, records: CoarseRecord[]): Issue {
  const primary = records
    .filter((record) =>
      record.actionIds.some((id) => finding.actionIds.includes(id)),
    )
    .map((record) => record.id);
  const context = records
    .filter(
      (record) =>
        !primary.includes(record.id) &&
        record.actionIds.some((id) => finding.contextActionIds.includes(id)),
    )
    .map((record) => record.id);
  return { ...finding, actionIds: primary, contextActionIds: context };
}

export default function Review({
  session,
  slug,
}: {
  session: Session;
  slug: string;
}) {
  const video = useRef<SynchronizedVideoHandle>(null);
  const player = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const manualStepScroll = useRef<string | null>(null);
  const clipEnd = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"original" | "overlay">("original");
  const [muted, setMuted] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [collapsedSteps, setCollapsedSteps] = useState(() => new Set<string>());
  const findings = session.analysis.findings;
  const leaderboard = leaderboardContext(session.analysis.result.leaderboard);
  const metricComparisons = session.analysis.result.metricComparisons;
  const steps = useMemo(
    () =>
      session.analysis.stages.map((stage) => ({
        ...session.steps.find((step) => step.id === stage.stepId)!,
        ...stage,
        findings: stage.findingIds.map((id) =>
          findings.find((finding) => finding.id === id)!,
        ),
      })),
    [session, findings],
  );
  const records = useMemo(() => steps.flatMap((step) => step.records), [steps]);
  const activeRecord = records.find(
    (record) => time >= record.start && time < record.end,
  );
  const markers = useMemo(
    () => buildTimelineMarkers(findings, session.reviews, session.steps),
    [findings, session],
  );
  const actionById = useMemo(
    () => new Map(session.actions.map((action) => [action.id, action])),
    [session],
  );
  const activeAction = session.actions.find(
    (action) => time >= action.start && time < action.end,
  );
  const activeStep = steps.find(
    (step) =>
      step.start !== null &&
      step.end !== null &&
      time >= step.start &&
      time < step.end,
  );
  const activeFinding =
    findings.find((finding) => finding.id === selectedIssueId) ||
    findings.find(
      (finding) => activeAction && finding.actionIds.includes(activeAction.id),
    );
  const highlightedIssue = findings.find(
    (finding) => finding.id === (hoveredIssueId || selectedIssueId),
  );
  function playbackFailed(reason: DOMException) {
    if (reason.name !== "AbortError")
      setError("Press play to start the recording.");
  }

  function seek(target: number, play = false, end: number | null = null) {
    if (switching) return;
    const next = Math.max(0, Math.min(session.duration, target));
    clipEnd.current = end;
    setTime(next);
    setError("");
    video.current?.seek(next);
    if (play) void video.current?.play().catch(playbackFailed);
  }
  function togglePlay() {
    if (switching || !video.current) return;
    if (video.current.isPaused()) {
      clipEnd.current = null;
      setSelectedIssueId(null);
      void video.current.play().catch(playbackFailed);
    } else video.current.pause();
  }
  function watchFinding(finding: Issue) {
    if (switching) return;
    const stage = steps.find((step) => finding.stepIds.includes(step.id))!;
    const action =
      stage.actionIds
        .map((id) => actionById.get(id)!)
        .find((action) => finding.actionIds.includes(action.id)) ||
      stage.actionIds
        .map((id) => actionById.get(id)!)
        .find((action) => finding.contextActionIds.includes(action.id));
    setSelectedIssueId(finding.id);
    setCollapsedSteps((previous) => {
      const next = new Set(previous);
      next.delete(stage.id);
      return next;
    });
    if (action)
      seek(
        action.clipStart ?? Math.max(0, action.start - 3),
        true,
        action.clipEnd ?? action.end + 3,
      );
  }
  function jumpToStep(step: RecordStep) {
    if (step.start === null || switching) return;
    setSelectedIssueId(null);
    setCollapsedSteps((previous) => {
      const next = new Set(previous);
      next.delete(step.id);
      return next;
    });
    manualStepScroll.current = step.id;
    seek(step.start, true, step.end);
  }
  function toggleStep(id: string) {
    manualStepScroll.current = id;
    setCollapsedSteps((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function updateTime(next: number) {
    setTime(next);
    if (clipEnd.current !== null && next >= clipEnd.current) {
      video.current?.pause();
      clipEnd.current = null;
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const timestamp = query.get("t");
    const explicit =
      timestamp !== null &&
      timestamp.trim() !== "" &&
      Number.isFinite(Number(timestamp)) &&
      Number(timestamp) >= 0;
    const linkedAction = actionById.get(query.get("action") || "");
    const linkedFinding = findings.find(
      (finding) => finding.id === query.get("issue"),
    );
    const entry = linkedFinding
      ? buildTimelineMarkers([linkedFinding], session.reviews, session.steps)[0]
      : markers.find((marker) => marker.kind === "error");
    const target = Math.min(
      session.duration,
      explicit
        ? Number(timestamp)
        : (linkedAction?.start ?? entry?.start ?? steps[0].start!),
    );
    video.current?.seek(target);
    setTime(target);
    setSelectedIssueId(
      linkedFinding?.id ??
        (!explicit && !linkedAction ? (entry?.issueIds[0] ?? null) : null),
    );
  }, [session, actionById, findings, markers, steps]);

  // Follow grouped operations rather than every hand movement. Manual expansion wins.
  useEffect(() => {
    const container = list.current;
    if (!container) return;
    const target = manualStepScroll.current || activeRecord?.id;
    const manual = Boolean(manualStepScroll.current);
    manualStepScroll.current = null;
    if (!target) return;
    const element = container.querySelector<HTMLElement>(
      manual ? `[data-step="${target}"]` : `[data-id="${target}"]`,
    );
    if (!element) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        container.scrollTo({
          top:
            container.scrollTop +
            element.getBoundingClientRect().top -
            container.getBoundingClientRect().top -
            (manual
              ? 0
              : (element
                  .closest(".record-step")
                  ?.querySelector(".record-step-heading")
                  ?.getBoundingClientRect().height || 0) + 16),
          behavior:
            !manual &&
            playing &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "smooth"
              : "instant",
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [activeRecord?.id, collapsedSteps]);
  useEffect(() => {
    if (!playing || !activeStep) return;
    setCollapsedSteps((previous) => {
      if (!previous.has(activeStep.id)) return previous;
      const next = new Set(previous);
      next.delete(activeStep.id);
      return next;
    });
  }, [activeStep?.id, playing]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        switching ||
        (event.target as HTMLElement).closest("button,input,a,summary") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      }
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        setSelectedIssueId(null);
        seek(
          (video.current?.getTime() || 0) +
            (event.code === "ArrowRight" ? 5 : -5),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [switching]);

  return (
    <div className="review-app analysis-review">
      <header className="result-header">
        <div
          className={`result-metrics ${metricComparisons ? "has-percentile-scales" : ""}`}
          aria-label="Reported result"
        >
          <div>
            {!metricComparisons && (
              <strong>
                +{session.analysis.result.closestAboveTargetPercent}%
              </strong>
            )}
            <span>Closest final concentration above target</span>
            {metricComparisons && (
              <PercentileScale
                label="Concentration accuracy"
                value={`+${session.analysis.result.closestAboveTargetPercent}%`}
                comparison={metricComparisons.accuracy}
              />
            )}
          </div>
          <div>
            {!metricComparisons && (
              <strong>
                {session.analysis.result.replicateVariabilityPercent}%
              </strong>
            )}
            <span>Reported variability between replicates</span>
            {metricComparisons && (
              <PercentileScale
                label="Replicate variability"
                value={`${session.analysis.result.replicateVariabilityPercent}%`}
                comparison={metricComparisons.variability}
              />
            )}
          </div>
          {metricComparisons &&
            ("estimate" in metricComparisons.accuracy ||
              "estimate" in metricComparisons.variability) && (
              <p className="percentile-source">
                Percentiles estimated from the leaderboard image.
              </p>
            )}
          {!metricComparisons && leaderboard && (
            <div
              className="leaderboard-context"
              title={leaderboard.explanation}
            >
              <strong>≈{leaderboard.ordinal}</strong>
              <span>
                Overall percentile
                <br />
                Rank {leaderboard.rank} of {leaderboard.totalEntries}
              </span>
            </div>
          )}
        </div>
      </header>
      <main className="workspace">
        <section className="video-column" aria-label="Challenge recording">
          <div className="video-label">
            <span>Calibration challenge</span>
            <button
              className={`perception-toggle ${mode === "overlay" ? "enabled" : ""}`}
              disabled={switching || loading}
              aria-busy={switching}
              aria-pressed={mode === "overlay"}
              aria-label="Toggle perception overlay"
              onClick={() => void video.current?.switchMode()}
            >
              <Scan size={14} />
              <span>Perception</span>
              <span className="toggle-track">
                <span />
              </span>
            </button>
          </div>
          <div ref={player} className="player">
            <div className="video-surface" aria-busy={switching}>
              <SynchronizedVideo
                ref={video}
                slug={slug}
                muted={muted}
                onTime={updateTime}
                onPlaying={setPlaying}
                onLoading={setLoading}
                onMode={setMode}
                onSwitching={setSwitching}
                onError={setError}
                onClick={togglePlay}
              />
              {activeRecord && (
                <p className="action-caption" aria-label="Current step">
                  {activeRecord.title}
                </p>
              )}
              {!playing && !loading && !switching && (
                <button
                  className="big-play"
                  aria-label="Play recording"
                  onClick={togglePlay}
                >
                  <Play size={24} fill="currentColor" />
                </button>
              )}
              {(loading || switching) && (
                <span className="loading-label" role="status">
                  {switching ? "Switching view…" : "Loading…"}
                </span>
              )}
            </div>
            <div className="player-controls">
              <div className="step-scrubber" aria-label="Protocol steps">
                {steps
                  .filter((step) => step.start !== null)
                  .map((step) => (
                    <button
                      key={step.id}
                      data-scrubber-step={step.id}
                      disabled={switching}
                      style={{
                        left: `${(step.start! / session.duration) * 100}%`,
                        width: `${((step.end! - step.start!) / session.duration) * 100}%`,
                      }}
                      aria-label={`Jump to ${step.name}`}
                      aria-current={
                        activeStep?.id === step.id ? "step" : undefined
                      }
                      onClick={() => jumpToStep(step)}
                    >
                      <span className="scrubber-step-name">
                        {(step.end! - step.start!) / session.duration > 0.08
                          ? step.name
                          : steps.indexOf(step) + 1}
                      </span>
                      {step.findings
                        .filter((finding) => finding.scope === "run-level")
                        .map((finding) => (
                          <i
                            key={finding.id}
                            className={`chapter-finding kind-${finding.kind}`}
                            data-chapter-issue={finding.id}
                            title={finding.title}
                          />
                        ))}
                    </button>
                  ))}
              </div>
              <div className="timeline">
                <input
                  type="range"
                  min="0"
                  max={session.duration}
                  step="0.1"
                  value={time}
                  disabled={switching}
                  onChange={(event) => {
                    setSelectedIssueId(null);
                    seek(Number(event.target.value));
                  }}
                  aria-label="Seek recording"
                  aria-valuetext={clock(time)}
                  style={
                    {
                      "--progress": `${(time / session.duration) * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <div className="timeline-marks">
                  {markers
                    .filter((marker) => marker.end === undefined)
                    .map((marker) => (
                      <button
                        key={marker.id}
                        className={`timeline-marker kind-${marker.kind}`}
                        data-marker-kind={marker.kind}
                        data-marker-issues={marker.issueIds.join(",")}
                        style={{
                          left: `${(marker.start / session.duration) * 100}%`,
                        }}
                        disabled={switching}
                        aria-label={`${kindLabel[marker.kind]} · ${findings.find((finding) => finding.id === marker.issueIds[0])!.title} · ${clock(marker.start)}`}
                        onClick={() => {
                          const action = actionById.get(marker.actionId)!;
                          setSelectedIssueId(marker.issueIds[0]);
                          seek(
                            action.clipStart ?? action.start,
                            true,
                            action.clipEnd ?? action.end + 3,
                          );
                        }}
                      />
                    ))}
                </div>
              </div>
              <div className="control-row">
                <div>
                  <button
                    className="icon-button"
                    aria-label={playing ? "Pause" : "Play"}
                    disabled={switching}
                    onClick={togglePlay}
                  >
                    {playing ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play size={17} fill="currentColor" />
                    )}
                  </button>
                  <span className="time-readout">
                    {clock(time)}
                    <span> / {clock(session.duration)}</span>
                  </span>
                </div>
                <div>
                  <button
                    className="icon-button"
                    aria-label={muted ? "Unmute" : "Mute"}
                    disabled={switching}
                    onClick={() => setMuted(!muted)}
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Fullscreen"
                    onClick={() => {
                      if (document.fullscreenElement)
                        void document.exitFullscreen();
                      else
                        void player.current
                          ?.requestFullscreen()
                          .catch(() => {});
                    }}
                  >
                    <Maximize size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="video-annotation">
            {activeFinding && (
              <div className={`insight-overlay kind-${activeFinding.kind}`}>
                <div>
                  <span className="insight-indicator" />
                  <span>
                    {kindLabel[activeFinding.kind]} · {activeFinding.category}
                  </span>
                </div>
                <p>{activeFinding.title}</p>
                <p className="insight-description">
                  {activeFinding.description}
                </p>
              </div>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="evidence-pane" aria-label="Steps and findings">
          <div className="evidence-heading">
            <div className="log-heading">
              <h2>System of Record</h2>
            </div>
            <span className="findings-heading">Likely contributors</span>
          </div>
          <div
            ref={list}
            className="evidence-scroll"
            tabIndex={0}
            aria-label="Step and insight timeline"
          >
            {steps.map((step, index) => {
              const current = activeStep?.id === step.id;
              return (
                <section
                  className="record-step"
                  key={step.id}
                  data-step={step.id}
                  aria-labelledby={`heading-${step.id}`}
                >
                  <header
                    className={`record-step-heading ${current ? "is-current" : ""}`}
                  >
                    <div className="step-heading-row">
                      <span className="step-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 id={`heading-${step.id}`}>
                        <button
                          className="step-jump"
                          disabled={switching || step.start === null}
                          onClick={() => jumpToStep(step)}
                        >
                          {step.name}
                        </button>
                      </h3>
                      <div className="step-counts">
                        {(["error", "observation", "risk"] as const).map(
                          (kind) => {
                            const count = step.findings.filter(
                              (finding) => finding.kind === kind,
                            ).length;
                            return count ? (
                              <span className={`kind-${kind}`} key={kind}>
                                {count} {kind}
                                {count !== 1 ? "s" : ""}
                              </span>
                            ) : null;
                          },
                        )}
                      </div>
                      <time className="step-duration">
                        {step.start !== null && step.end !== null
                          ? clock(step.end - step.start)
                          : "—"}
                      </time>
                      <button
                        className="step-toggle"
                        onClick={() => toggleStep(step.id)}
                        aria-expanded={!collapsedSteps.has(step.id)}
                        aria-controls={`body-${step.id}`}
                        aria-label={`${collapsedSteps.has(step.id) ? "Expand" : "Collapse"} ${step.name}`}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </header>
                  <div
                    className="record-step-body"
                    id={`body-${step.id}`}
                    hidden={collapsedSteps.has(step.id)}
                  >
                    {step.records.length === 0 && (
                      <p className="step-empty">
                        No blank preparation identified in the recording.
                      </p>
                    )}
                    <EvidenceSection
                      id={step.id}
                      actions={
                        <>
                          {step.records.map((record) => {
                            const currentRecord =
                              activeRecord?.id === record.id;
                            const linked =
                              highlightedIssue &&
                              [
                                ...highlightedIssue.actionIds,
                                ...highlightedIssue.contextActionIds,
                              ].some((id) => record.actionIds.includes(id));
                            const kind = linked
                              ? highlightedIssue.kind
                              : (
                                  ["error", "risk", "observation"] as const
                                ).find((kind) =>
                                  step.findings.some(
                                    (finding) =>
                                      finding.kind === kind &&
                                      finding.actionIds.some((id) =>
                                        record.actionIds.includes(id),
                                      ),
                                  ),
                                );
                            return (
                              <article
                                key={record.id}
                                data-id={record.id}
                                data-linked={Boolean(linked)}
                                aria-current={
                                  currentRecord ? "step" : undefined
                                }
                                className={`log-entry step-record ${currentRecord ? "current" : ""} ${kind ? `kind-${kind}` : ""} ${linked ? "linked" : ""}`}
                              >
                                {currentRecord && (
                                  <span
                                    className="action-play-progress"
                                    aria-hidden="true"
                                    style={{
                                      height: `${Math.max(0, Math.min(100, ((time - record.start) / (record.end - record.start)) * 100))}%`,
                                    }}
                                  />
                                )}
                                <button
                                  className="log-action"
                                  disabled={switching}
                                  onClick={() => {
                                    setSelectedIssueId(null);
                                    seek(record.start, true, record.end);
                                  }}
                                  aria-label={`Play ${record.title}`}
                                >
                                  {currentRecord && (
                                    <span
                                      className="live-pointer"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <time>
                                    {clock(record.start)}–{clock(record.end)}
                                    {currentRecord && (
                                      <span className="now-label">Now</span>
                                    )}
                                  </time>
                                  <span>
                                    <strong>{record.title}</strong>
                                    <span className="step-record-text">
                                      {record.text}
                                    </span>
                                  </span>
                                </button>
                              </article>
                            );
                          })}
                        </>
                      }
                      findings={step.findings.map((finding) => ({
                        // Map each source action to its grouped operation, preserving evidence/context distinctions.
                        issue: linkRecords(finding, step.records),
                        node: (
                          <article
                            data-issue={finding.id}
                            className={`issue kind-${finding.kind}`}
                            onMouseEnter={() => setHoveredIssueId(finding.id)}
                            onMouseLeave={() => setHoveredIssueId(null)}
                          >
                            <button
                              className="issue-trigger"
                              disabled={switching}
                              aria-pressed={selectedIssueId === finding.id}
                              onClick={() => watchFinding(finding)}
                            >
                              <span className="finding-copy">
                                <span className="issue-kind">
                                  <i />
                                  {kindLabel[finding.kind]}
                                </span>
                                <strong>{finding.title}</strong>
                                <span className="issue-description">
                                  {finding.description}
                                </span>
                              </span>
                            </button>
                          </article>
                        ),
                      }))}
                      highlightedIssue={hoveredIssueId || selectedIssueId}
                      focusedAction={activeRecord?.id}
                    />
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
