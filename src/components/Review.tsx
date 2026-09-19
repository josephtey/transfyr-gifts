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
import type { Session, Moment } from "../lib/types";
const clock = (t: number) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
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
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const duration = session.duration;
  const activeMoment = session.moments.find(
    (m) => time >= m.start && time < m.end,
  );
  const activeAction = session.actions.find(
    (a) => time >= a.start && time < a.end,
  );
  const insight =
    activeMoment && activeMoment.id !== dismissed ? activeMoment : undefined;
  const entries = useMemo(
    () =>
      [
        ...session.actions.map((a) => ({
          id: a.id,
          start: a.start,
          end: a.end,
          text: a.text.replace(/^The operator /, ""),
          moment: undefined as Moment | undefined,
        })),
        ...session.moments.map((m) => ({
          id: m.id,
          start: m.start,
          end: m.end,
          text: m.title,
          moment: m,
        })),
      ].sort(
        (a, b) => a.start - b.start || Number(!!b.moment) - Number(!!a.moment),
      ),
    [session],
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
    if (v.paused)
      void v
        .play()
        .catch(() => setError("The recording could not play. Try reloading."));
    else v.pause();
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
  function selectEntry(id: string, start: number) {
    video.current?.pause();
    setSelected(id);
    seek(start);
  }
  function watchMoment(moment: Moment) {
    setSelected(moment.id);
    clipEnd.current = Math.min(duration, moment.end + 3);
    seek(Math.max(0, moment.start - 4), true, true);
  }
  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(Math.floor(time)));
    url.searchParams.delete("moment");
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
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (Number.isFinite(t) && t > 0) {
      pending.current = { time: Math.min(duration, t), playing: false };
      setTime(Math.min(duration, t));
      if (video.current && video.current.readyState >= 1) {
        video.current.currentTime = Math.min(duration, t);
        pending.current = null;
      }
    }
  }, [duration]);
  useEffect(() => {
    if (playing) setSelected(null);
    const id = selected || activeAction?.id || activeMoment?.id;
    if (!id || !list.current) return;
    const element = list.current.querySelector<HTMLElement>(
      `[data-id="${id}"]`,
    );
    if (element) {
      const top = element.offsetTop - list.current.offsetTop;
      if (
        top < list.current.scrollTop ||
        top + element.offsetHeight >
          list.current.scrollTop + list.current.clientHeight
      )
        list.current.scrollTo({
          top: Math.max(0, top - 75),
          behavior: "instant",
        });
    }
  }, [activeMoment?.id, activeAction?.id, playing, selected]);
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
        seek((video.current?.currentTime || 0) - 5);
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        seek((video.current?.currentTime || 0) + 5);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
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
              {insight && (
                <div className="insight-overlay" key={insight.id}>
                  <div>
                    <span className="insight-indicator" />
                    <span>Reviewer insight</span>
                    <time>{clock(insight.start)}</time>
                    <button
                      aria-label="Dismiss insight"
                      onClick={() => setDismissed(insight.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <p>{insight.meaning}</p>
                </div>
              )}
              {!insight && activeAction && (
                <p className="action-caption">{activeAction.text}</p>
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
                  {session.moments.map((m) => (
                    <button
                      key={m.id}
                      style={{ left: `${(m.start / duration) * 100}%` }}
                      aria-label={`${clock(m.start)}: ${m.title}`}
                      title={m.title}
                      onClick={() => selectEntry(m.id, m.start)}
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="log-column" aria-label="Action log">
          <div className="log-heading">
            <h2>Action log</h2>
            <span>
              <i />
              Reviewer insight
            </span>
          </div>
          <div ref={list} className="action-log" tabIndex={0}>
            {entries.map((entry) => {
              const current = entry.moment
                ? activeMoment?.id === entry.id
                : activeAction?.id === entry.id;
              const expanded =
                !!entry.moment && (selected === entry.id || current);
              return (
                <article
                  key={entry.id}
                  data-id={entry.id}
                  className={`log-entry ${entry.moment ? "has-insight" : ""} ${current ? "current" : ""} ${expanded ? "expanded" : ""}`}
                >
                  <button
                    className="log-action"
                    onClick={() => selectEntry(entry.id, entry.start)}
                    aria-label={`${clock(entry.start)} ${entry.text}`}
                  >
                    <time>{clock(entry.start)}</time>
                    <span>{entry.text}</span>
                    {entry.moment && <i aria-label="Human-reviewed insight" />}
                  </button>
                  {expanded && entry.moment && (
                    <div className="log-insight">
                      <p>{entry.moment.observation}</p>
                      <div>
                        <button onClick={() => watchMoment(entry.moment!)}>
                          <Play size={11} fill="currentColor" />
                          Play clip
                        </button>
                        <a
                          href={`/media/${slug}/clips/${entry.id}.mp4?download=1`}
                          download
                          aria-label="Download clip"
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="log-footer">
            AI action log · highlighted moments reviewed by a human
          </div>
        </aside>
      </main>
    </div>
  );
}
