"use client";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";

export type VideoMode = "original" | "overlay";
type VideoSource = VideoMode | "side" | "top";
export type SynchronizedVideoHandle = {
  seek: (time: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  getTime: () => number;
  isPaused: () => boolean;
  switchMode: (mode?: VideoMode) => Promise<void>;
};

// Wait for an actual decodable frame at the requested time, not just metadata.
function waitForFrame(video: HTMLVideoElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const clean = () => {
      clearTimeout(timer);
      for (const event of ["loadeddata", "canplay", "seeked", "error"])
        video.removeEventListener(event, check);
      signal.removeEventListener("abort", aborted);
    };
    const aborted = () => {
      clean();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const check = () => {
      if (video.error) {
        clean();
        reject(new Error("Recording unavailable"));
      } else if (video.readyState >= 2 && !video.seeking) {
        clean();
        resolve();
      }
    };
    timer = setTimeout(() => {
      clean();
      reject(new Error("Recording timed out"));
    }, 20000);
    for (const event of ["loadeddata", "canplay", "seeked", "error"])
      video.addEventListener(event, check);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    else check();
  });
}

export default forwardRef<
  SynchronizedVideoHandle,
  {
    slug: string;
    muted: boolean;
    caption?: string;
    onTime: (time: number) => void;
    onPlaying: (playing: boolean) => void;
    onLoading: (loading: boolean) => void;
    onMode: (mode: VideoMode) => void;
    onSwitching: (switching: boolean) => void;
    onError: (message: string) => void;
    onClick: () => void;
  }
>(function SynchronizedVideo(props, ref) {
  const videos = useRef<Partial<Record<VideoSource, HTMLVideoElement>>>({});
  const active = useRef<VideoMode>("original");
  const [mode, setMode] = useState<VideoMode>("original");
  const switching = useRef(false);
  const desiredTime = useRef(0);
  const pendingSeek = useRef(false);
  const pendingPlay = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => () => controller.current?.abort(), []);

  useImperativeHandle(
    ref,
    () => ({
      getTime: () =>
        pendingSeek.current
          ? desiredTime.current
          : (videos.current[active.current]?.currentTime ??
            desiredTime.current),
      isPaused: () => videos.current[active.current]?.paused ?? true,
      seek(time) {
        desiredTime.current = time;
        pendingSeek.current = true;
        for (const video of Object.values(videos.current))
          if (video && video.readyState >= 1) video.currentTime = time;
        if ((videos.current[active.current]?.readyState ?? 0) >= 1)
          pendingSeek.current = false;
      },
      async play() {
        const video = videos.current[active.current];
        pendingPlay.current = true;
        if (video && video.readyState >= 1) {
          pendingPlay.current = false;
          for (const sourceMode of ["side", "top"] as const) {
            const reference = videos.current[sourceMode];
            if (!reference || reference.readyState < 1) continue;
            reference.playbackRate = video.playbackRate;
            reference.muted = true;
            if (Math.abs(reference.currentTime - video.currentTime) > 0.2)
              reference.currentTime = video.currentTime;
            void reference.play().catch(() => {});
          }
          await video.play();
        }
      },
      pause() {
        pendingPlay.current = false;
        for (const video of Object.values(videos.current)) video?.pause();
      },
      async switchMode(requestedMode) {
        if (switching.current) return;
        const source = videos.current[active.current];
        const next: VideoMode =
          requestedMode ??
          (active.current === "original" ? "overlay" : "original");
        if (next === active.current) return;
        const target = videos.current[next];
        if (!source || !target) return;
        const resume = !source.paused || pendingPlay.current;
        const time = pendingSeek.current
          ? desiredTime.current
          : source.currentTime;
        const playbackRate = source.playbackRate;
        const volume = source.volume;
        switching.current = true;
        latest.current.onSwitching(true);
        latest.current.onLoading(true);
        latest.current.onError("");
        // Keep the displayed video's last frame mounted while the other seeks.
        for (const video of Object.values(videos.current)) video?.pause();
        controller.current?.abort();
        const transaction = new AbortController();
        controller.current = transaction;
        try {
          target.playbackRate = playbackRate;
          target.volume = volume;
          target.muted = true;
          if (target.readyState < 1) {
            await new Promise<void>((resolve, reject) => {
              const clean = () => {
                clearTimeout(timer);
                target.removeEventListener("loadedmetadata", done);
                target.removeEventListener("error", fail);
                transaction.signal.removeEventListener("abort", fail);
              };
              const done = () => {
                clean();
                resolve();
              };
              const fail = () => {
                clean();
                reject(new Error("Recording unavailable"));
              };
              const timer = setTimeout(fail, 20000);
              target.addEventListener("loadedmetadata", done, { once: true });
              target.addEventListener("error", fail, { once: true });
              transaction.signal.addEventListener("abort", fail, {
                once: true,
              });
              target.preload = "auto";
              if (target.error) target.load();
              if (target.readyState >= 1) done();
            });
          }
          target.playbackRate = playbackRate;
          target.volume = volume;
          target.currentTime = time;
          await waitForFrame(target, transaction.signal);
          if (transaction.signal.aborted) return;
          if (resume) {
            for (const sourceMode of ["side", "top"] as const) {
              const reference = videos.current[sourceMode];
              if (!reference || reference.readyState < 1) continue;
              reference.playbackRate = playbackRate;
              reference.muted = true;
              if (Math.abs(reference.currentTime - time) > 0.2)
                reference.currentTime = time;
              void reference.play().catch(() => {});
            }
            await target.play();
          }
          if (transaction.signal.aborted) {
            target.pause();
            return;
          }
          // A decoded seeked frame is ready before React reveals the alternate video.
          source.muted = true;
          target.muted = latest.current.muted;
          desiredTime.current = time;
          pendingSeek.current = false;
          pendingPlay.current = false;
          active.current = next;
          setMode(next);
          latest.current.onMode(next);
          latest.current.onTime(time);
          latest.current.onPlaying(!target.paused);
        } catch (error) {
          if (!transaction.signal.aborted) {
            latest.current.onError("Could not switch recordings. Try again.");
            if (active.current !== next) {
              source.muted = latest.current.muted;
              if (resume) await source.play().catch(() => {});
              latest.current.onPlaying(!source.paused);
            }
          }
        } finally {
          switching.current = false;
          if (!transaction.signal.aborted) {
            latest.current.onSwitching(false);
            latest.current.onLoading(false);
          }
        }
      },
    }),
    [],
  );

  return (
    <div className="synchronized-views">
      <div className="fpv-view">
        {(["original", "overlay"] as const).map((sourceMode) => (
          <video
            key={sourceMode}
            ref={(element) => {
              if (element) videos.current[sourceMode] = element;
            }}
            data-mode={sourceMode}
            data-active={mode === sourceMode}
            aria-hidden={mode !== sourceMode}
            src={`/media/${props.slug}/${sourceMode}.mp4`}
            controlsList="nodownload"
            playsInline
            preload="metadata"
            muted={mode !== sourceMode || props.muted}
            onClick={props.onClick}
            onLoadedMetadata={(event) => {
              if (sourceMode !== active.current || switching.current) return;
              const video = event.currentTarget;
              if (pendingSeek.current) {
                video.currentTime = desiredTime.current;
                pendingSeek.current = false;
              }
              if (pendingPlay.current) {
                pendingPlay.current = false;
                for (const referenceMode of ["side", "top"] as const) {
                  const reference = videos.current[referenceMode];
                  if (!reference || reference.readyState < 1) continue;
                  reference.currentTime = video.currentTime;
                  reference.playbackRate = video.playbackRate;
                  void reference.play().catch(() => {});
                }
                void video.play().catch((reason: DOMException) => {
                  if (reason.name !== "AbortError")
                    latest.current.onError("Press play to start the recording.");
                });
              }
            }}
          onPlay={() => {
            if (sourceMode === active.current && !switching.current)
              props.onPlaying(true);
          }}
          onPause={() => {
            if (sourceMode === active.current && !switching.current)
              props.onPlaying(false);
          }}
          onWaiting={() => {
            if (sourceMode === active.current) props.onLoading(true);
          }}
          onCanPlay={() => {
            if (
              sourceMode === active.current &&
              !switching.current &&
              !videos.current[sourceMode]?.seeking
            )
              props.onLoading(false);
          }}
          onSeeking={() => {
            if (sourceMode === active.current && !switching.current)
              props.onLoading(true);
          }}
          onSeeked={(event) => {
            if (
              sourceMode === active.current &&
              !switching.current &&
              event.currentTarget.readyState >= 2
            )
              props.onLoading(false);
          }}
          onEnded={() => {
            if (sourceMode === active.current) props.onPlaying(false);
          }}
          onError={() => {
            if (sourceMode === active.current && !switching.current) {
              props.onLoading(false);
              props.onError(
                "The recording could not load. Reload to renew access.",
              );
            }
          }}
          onTimeUpdate={(event) => {
            if (
              sourceMode !== active.current ||
              switching.current ||
              pendingSeek.current
            )
              return;
            desiredTime.current = event.currentTarget.currentTime;
            for (const referenceMode of ["side", "top"] as const) {
              const reference = videos.current[referenceMode];
              if (
                reference &&
                reference.readyState >= 1 &&
                Math.abs(reference.currentTime - desiredTime.current) > 0.35
              )
                reference.currentTime = desiredTime.current;
            }
            props.onTime(desiredTime.current);
          }}
          />
        ))}
        <span className="camera-label">FPV</span>
        {props.caption && (
          <p className="action-caption" aria-label="Current step">
            {props.caption}
          </p>
        )}
      </div>
      <div className="reference-views">
        {(["side", "top"] as const).map((sourceMode) => (
          <div className="reference-view" key={sourceMode}>
            <video
              ref={(element) => {
                if (element) videos.current[sourceMode] = element;
              }}
              data-mode={sourceMode}
              src={`/media/${props.slug}/${sourceMode}.mp4`}
              controlsList="nodownload"
              playsInline
              preload="metadata"
              muted
              aria-label={`${sourceMode === "side" ? "Side" : "Top"} view`}
              onClick={props.onClick}
              onLoadedMetadata={(event) => {
                event.currentTarget.currentTime = desiredTime.current;
                event.currentTarget.playbackRate =
                  videos.current[active.current]?.playbackRate ?? 1;
                if (!videos.current[active.current]?.paused)
                  void event.currentTarget.play().catch(() => {});
              }}
            />
            <span className="camera-label">
              {sourceMode === "side" ? "Side" : "Top"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
