"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";

export default function LeaderboardDialog({
  imageSrc,
  onOpen = () => {},
}: {
  imageSrc: string;
  onOpen?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

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
    <>
      <button
        className="leaderboard-button"
        aria-haspopup="dialog"
        onClick={() => {
          onOpen();
          setImageError(false);
          setZoomed(false);
          setOpen(true);
        }}
      >
        See on leaderboard <ArrowUpRight size={14} aria-hidden="true" />
      </button>
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
                Unable to load the leaderboard. Close and reopen to try again.
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
  );
}
