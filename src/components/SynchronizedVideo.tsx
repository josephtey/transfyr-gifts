"use client";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";

type Mode = "original" | "overlay";
export type SynchronizedVideoHandle = {
  seek: (time: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  getTime: () => number;
  isPaused: () => boolean;
  switchMode: () => Promise<void>;
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
    onTime: (time: number) => void;
    onPlaying: (playing: boolean) => void;
    onLoading: (loading: boolean) => void;
    onMode: (mode: Mode) => void;
    onSwitching: (switching: boolean) => void;
    onError: (message: string) => void;
    onClick: () => void;
  }
>(function SynchronizedVideo(props, ref) {
  const videos = useRef<Partial<Record<Mode, HTMLVideoElement>>>({});
  const active = useRef<Mode>("original");
  const [mode, setMode] = useState<Mode>("original");
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
        const video = videos.current[active.current];
        if (video && video.readyState >= 1) {
          video.currentTime = time;
          pendingSeek.current = false;
        }
      },
      async play() {
        const video = videos.current[active.current];
        pendingPlay.current = true;
        if (video && video.readyState >= 1) {
          pendingPlay.current = false;
          await video.play();
        }
      },
      pause() {
        pendingPlay.current = false;
        videos.current[active.current]?.pause();
      },
      async switchMode() {
        if (switching.current) return;
        const source = videos.current[active.current];
        const next: Mode =
          active.current === "original" ? "overlay" : "original";
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
        source.pause();
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
          if (resume) await target.play();
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
    <>
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
            props.onTime(desiredTime.current);
          }}
        />
      ))}
    </>
  );
});
