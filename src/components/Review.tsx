"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Scan,
  X,
  Download,
  LogOut,
  MoreHorizontal,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import type { Session, Action, Issue } from "../lib/types";
import EvidenceSection from "./EvidenceSection";
const clock = (t: number) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const kindLabel = { error: "Error", risk: "Risk", observation: "Observation" };
export default function Review({
  session,
  slug,
}: {
  session: Session;
  slug: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const player = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pending = useRef<{ time: number; playing: boolean } | null>(null);
  const clipEnd = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"original" | "overlay">("original");
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const duration = session.duration;
  const actionById = useMemo(
    () => new Map(session.actions.map((a) => [a.id, a])),
    [session],
  );
  const activeAction = session.actions.find(
    (a) => time >= a.start && time < a.end,
  );
  const focusAction = playing
    ? activeAction
    : selected
      ? actionById.get(selected)
      : activeAction;
  const downloadAction = (selected && actionById.get(selected)) || focusAction;
  const chosenIssue = session.issues.find((i) => i.id === selectedIssueId);
  const highlightedIssue = session.issues.find(
    (i) => i.id === (hoveredIssueId || selectedIssueId),
  );
  const linkedActions = new Set(
    highlightedIssue
      ? [...highlightedIssue.actionIds, ...highlightedIssue.contextActionIds]
      : [],
  );
  const relatedIssues = new Set(focusAction?.issueIds || []);
  const primaryIssues = session.issues.filter(
    (i) => focusAction && i.actionIds.includes(focusAction.id),
  );
  const overlayIssue =
    chosenIssue ||
    primaryIssues.find((i) => i.kind === "error") ||
    primaryIssues[0];
  const overlayVisible =
    overlayIssue &&
    overlayIssue.id !== dismissed &&
    (!chosenIssue || linkedActions.has(selected || focusAction?.id || ""));
  const errorReviewIds = useMemo(
    () =>
      new Set(
        session.issues
          .filter((i) => i.kind === "error")
          .flatMap((i) => i.reviewIds),
      ),
    [session],
  );
  const markers = useMemo(
    () =>
      session.reviews
        .filter((r) => errorReviewIds.has(r.id) && r.error)
        .filter(
          (r, index, all) =>
            all.findIndex((x) => x.start === r.start) === index,
        ),
    [session, errorReviewIds],
  );
  function seek(t: number, play = false, clip = false) {
    const target = Math.max(0, Math.min(duration, t));
    if (!clip) clipEnd.current = null;
    setTime(target);
    setError("");
    setDismissed(null);
    if (video.current) {
      video.current.currentTime = target;
      if (play)
        void video.current
          .play()
          .catch(() => setError("Press play to start the recording."));
    }
  }
  function togglePlay() {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      setSelected(null);
      clipEnd.current = null;
      void v
        .play()
        .catch(() => setError("The recording could not play. Try reloading."));
    } else v.pause();
  }
  function changeMode() {
    const v = video.current;
    if (!v) return;
    pending.current = { time: v.currentTime, playing: !v.paused };
    v.pause();
    setLoading(true);
    setError("");
    setMode(mode === "original" ? "overlay" : "original");
  }
  function selectAction(
    action: Action,
    preserveIssue = false,
    timestamp = action.start,
  ) {
    video.current?.pause();
    setSelected(action.id);
    if (!preserveIssue) setSelectedIssueId(null);
    seek(timestamp);
  }
  function watchAction(action: Action, preserveIssue = false) {
    setSelected(action.id);
    if (!preserveIssue) setSelectedIssueId(null);
    clipEnd.current = action.clipEnd ?? action.end + 3;
    seek(action.clipStart ?? Math.max(0, action.start - 3), true, true);
  }
  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(Math.floor(time)));
    if (selected) url.searchParams.set("action", selected);
    else url.searchParams.delete("action");
    if (selectedIssueId) url.searchParams.set("issue", selectedIssueId);
    else url.searchParams.delete("issue");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.history.replaceState(null, "", url);
      setError("Copy the page address to share this moment.");
    }
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = Number(q.get("t"));
    if (Number.isFinite(t) && t > 0) {
      pending.current = { time: Math.min(duration, t), playing: false };
      setTime(Math.min(duration, t));
      if (video.current && video.current.readyState >= 1) {
        video.current.currentTime = Math.min(duration, t);
        pending.current = null;
      }
    }
    if (actionById.has(q.get("action") || "")) setSelected(q.get("action"));
    if (session.issues.some((i) => i.id === q.get("issue")))
      setSelectedIssueId(q.get("issue"));
  }, [duration, actionById, session.issues]);
  useEffect(() => {
    const id = playing ? activeAction?.id : selected || activeAction?.id;
    if (!id || !list.current) return;
    const el = list.current.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (el) {
      const top =
        el.getBoundingClientRect().top -
        list.current.getBoundingClientRect().top +
        list.current.scrollTop;
      if (
        playing ||
        top < list.current.scrollTop ||
        top + Math.min(el.offsetHeight, 200) >
          list.current.scrollTop + list.current.clientHeight
      )
        list.current.scrollTo({
          top: Math.max(
            0,
            top - (playing ? list.current.clientHeight * 0.32 : 55),
          ),
          behavior:
            playing &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "smooth"
              : "instant",
        });
    }
  }, [activeAction?.id, selected, playing]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest("button,input,a,summary") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        setSelected(null);
        seek((video.current?.currentTime || 0) - 5);
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        setSelected(null);
        seek((video.current?.currentTime || 0) + 5);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const sections = useMemo(() => {
    const result: { id: string; task: string; actions: Action[] }[] = [];
    for (const action of session.actions) {
      const last = result[result.length - 1];
      if (last?.task === action.task) last.actions.push(action);
      else result.push({ id: action.id, task: action.task, actions: [action] });
    }
    return result;
  }, [session.actions]);
  function renderAction(action: Action) {
    const supportingIssues = session.issues.filter((i) =>
      i.actionIds.includes(action.id),
    );
    const hasError = supportingIssues.some((i) => i.kind === "error");
    const expanded = selected === action.id;
    const current = activeAction?.id === action.id;
    const linked = linkedActions.has(action.id);
    const contextOnly =
      linked && highlightedIssue?.contextActionIds.includes(action.id);
    return (
      <article
        key={action.id}
        data-id={action.id}
        data-linked={linked ? "true" : "false"}
        data-context={contextOnly ? "true" : "false"}
        aria-current={current ? "step" : undefined}
        className={`log-entry ${hasError ? "has-error" : supportingIssues.length ? "has-finding" : ""} ${current ? "current" : ""} ${linked ? "linked" : ""} ${contextOnly ? "context-link" : ""} ${expanded ? "expanded" : ""}`}
      >
        {current && (
          <span
            className="action-play-progress"
            aria-hidden="true"
            style={{
              height: `${Math.max(0, Math.min(100, ((time - action.start) / (action.end - action.start)) * 100))}%`,
            }}
          />
        )}
        <button
          className="log-action"
          onClick={() => watchAction(action)}
          aria-label={`${clock(action.start)} ${action.text}`}
          aria-pressed={focusAction?.id === action.id}
        >
          {current && <span className="live-pointer" aria-hidden="true" />}
          <time>
            {clock(action.start)}
            {current && <span className="now-label">Now</span>}
          </time>
          <span>
            <span className="ai-action-text">
              {action.text}
            </span>
          </span>
        </button>
      </article>
    );
  }
  function renderIssue(issue: Issue, localActions: Action[]) {
    const linked = relatedIssues.has(issue.id);
    return (
      <article
        key={issue.id}
        data-issue={issue.id}
        data-linked={linked ? "true" : "false"}
        className={`issue kind-${issue.kind} ${linked ? "linked" : ""}`}
        onMouseEnter={() => setHoveredIssueId(issue.id)}
        onMouseLeave={() => setHoveredIssueId(null)}
      >
        <button
          className="issue-trigger"
          onClick={() => {
            const action =
              localActions.find((a) => issue.actionIds.includes(a.id)) ||
              localActions.find((a) => issue.contextActionIds.includes(a.id));
            setSelectedIssueId(issue.id);
            if (action) watchAction(action, true);
          }}
          aria-pressed={selectedIssueId === issue.id}
        >
          <span className="finding-copy">
            <span className="issue-kind">
              <i />
              {kindLabel[issue.kind]}
            </span>
            <strong>{issue.title}</strong>
            <span className="issue-description">{issue.description}</span>
          </span>
        </button>
      </article>
    );
  }
  return (
    <div className="review-app">
      <header className="app-header">
        <a className="wordmark" href={`/${slug}`}>
          transfyr
          <span />
        </a>
        <span className="header-divider" />
        <h1>
          {session.customer}
          <span> / Calibration</span>
        </h1>
        <div
          className="review-count"
          title={`${session.counts.timedErrorNotes} timestamped or inherited spreadsheet error notes + ${session.counts.runLevelErrorNotes} run-level error. Notes supporting multiple categories count once. Risks and observations are separate.`}
        >
          <strong>{session.counts.errorNotes}</strong>
          <span>reviewed error notes</span>
        </div>
        <div className="header-tools">
          <details className="more-menu">
            <summary aria-label="Recording options">
              <MoreHorizontal size={19} />
            </summary>
            <div>
              <button onClick={share}>
                {copied ? <Check size={14} /> : <LinkIcon size={14} />}{" "}
                {copied ? "Copied" : "Copy moment link"}
              </button>
              {downloadAction?.clipFile && (
                <a
                  href={`/media/${slug}/clips/${downloadAction.clipFile}?download=1`}
                  download
                  aria-label="Download action clip"
                >
                  <Download size={14} />
                  Current action clip
                </a>
              )}
              <a href={`/media/${slug}/original.mp4?download=1`} download>
                <Download size={14} />
                Original recording
              </a>
              <a href={`/media/${slug}/overlay.mp4?download=1`} download>
                <Download size={14} />
                Perception recording
              </a>
            </div>
          </details>
          <form action="/api/access" method="post">
            <input type="hidden" name="customer" value={slug} />
            <input type="hidden" name="logout" value="1" />
            <button
              className="icon-button"
              title="Lock review"
              aria-label="Lock review"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>
      <main className="workspace">
        <section className="video-column" aria-label="Challenge recording">
          <div className="video-label">
            <span>Calibration challenge</span>
            <button
              className={`perception-toggle ${mode === "overlay" ? "enabled" : ""}`}
              onClick={changeMode}
              aria-pressed={mode === "overlay"}
              aria-label="Toggle perception overlay"
            >
              <Scan size={14} />
              <span>Perception</span>
              <span className="toggle-track">
                <span />
              </span>
            </button>
          </div>
          <div ref={player} className="player">
            <div className="video-surface">
              <video
                ref={video}
                src={`/media/${slug}/${mode}.mp4`}
                poster={`/frames/${slug}/poster.jpg`}
                playsInline
                preload="metadata"
                muted={muted}
                onClick={togglePlay}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onWaiting={() => setLoading(true)}
                onCanPlay={() => setLoading(false)}
                onEnded={() => setPlaying(false)}
                onError={() => {
                  setLoading(false);
                  setError(
                    "The recording could not load. Reload to renew access.",
                  );
                }}
                onLoadedMetadata={() => {
                  const v = video.current!;
                  if (pending.current) {
                    v.currentTime = pending.current.time;
                    if (pending.current.playing) void v.play().catch(() => {});
                    pending.current = null;
                  }
                }}
                onTimeUpdate={() => {
                  const v = video.current!;
                  setTime(v.currentTime);
                  if (
                    clipEnd.current !== null &&
                    v.currentTime >= clipEnd.current
                  ) {
                    v.pause();
                    clipEnd.current = null;
                  }
                }}
              />
              {!playing && !loading && (
                <button
                  className="big-play"
                  aria-label="Play recording"
                  onClick={togglePlay}
                >
                  <Play size={24} fill="currentColor" />
                </button>
              )}
              {loading && (
                <span className="loading-label" role="status">
                  Loading…
                </span>
              )}
            </div>
            <div className="player-controls">
              <div className="timeline">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={time}
                  onChange={(e) => {
                    setSelected(null);
                    seek(Number(e.target.value));
                  }}
                  aria-label="Seek recording"
                  aria-valuetext={clock(time)}
                  style={
                    {
                      "--progress": `${(time / duration) * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <div className="timeline-marks">
                  {markers.map((r) => (
                    <button
                      key={r.id}
                      className={
                        highlightedIssue?.reviewIds.includes(r.id)
                          ? "linked-marker"
                          : ""
                      }
                      style={{ left: `${(r.start / duration) * 100}%` }}
                      aria-label={`${clock(r.start)}: ${r.error}`}
                      title={r.error}
                      onClick={() =>
                        selectAction(
                          actionById.get(r.primaryActionId)!,
                          false,
                          r.start,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="control-row">
                <div>
                  <button
                    className="icon-button"
                    aria-label={playing ? "Pause" : "Play"}
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
                    <span> / {clock(duration)}</span>
                  </span>
                </div>
                <div>
                  <button
                    className="icon-button"
                    aria-label={muted ? "Unmute" : "Mute"}
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
            {overlayVisible && (
              <div className={`insight-overlay kind-${overlayIssue.kind}`}>
                <div>
                  <span className="insight-indicator" />
                  <span>
                    {kindLabel[overlayIssue.kind]} · {overlayIssue.category}
                  </span>
                  <button
                    aria-label="Dismiss insight"
                    onClick={() => setDismissed(overlayIssue.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
                <p>{overlayIssue.title}</p>
              </div>
            )}
            {!overlayVisible && activeAction && (
              <p className="action-caption">
                {activeAction.text}
              </p>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="evidence-pane" aria-label="Actions and findings">
          <div className="evidence-heading">
            <div className="log-heading">
              <h2>System of Record</h2>
            </div>
          </div>
          <div
            ref={list}
            className="evidence-scroll"
            tabIndex={0}
            aria-label="Action and insight timeline"
          >
            {sections.map((section) => (
              <EvidenceSection
                key={section.id}
                id={section.id}
                actions={section.actions.map(renderAction)}
                findings={session.issues
                  .filter((issue) =>
                    section.actions.some(
                      (a) =>
                        issue.actionIds.includes(a.id) ||
                        issue.contextActionIds.includes(a.id),
                    ),
                  )
                  .map((issue) => ({
                    issue,
                    node: renderIssue(issue, section.actions),
                  }))}
                highlightedIssue={hoveredIssueId || selectedIssueId}
                focusedAction={focusAction?.id}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
