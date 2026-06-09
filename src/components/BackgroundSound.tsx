import React from "react";
import {
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/solid";

const TRACK_SRC = "/haven_0.mp3";
const STORAGE_KEY = "space-haven-radio-playing";

const BackgroundSound = () => {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);

  React.useEffect(() => {
    const shouldResume =
      window.localStorage.getItem(STORAGE_KEY) === "true" && audioRef.current;

    if (!shouldResume) {
      return;
    }

    void audioRef.current
      ?.play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        window.localStorage.setItem(STORAGE_KEY, "false");
        setIsPlaying(false);
      });
  }, []);

  const play = () => {
    if (!audioRef.current) {
      return;
    }

    void audioRef.current.play().then(() => {
      window.localStorage.setItem(STORAGE_KEY, "true");
      setIsPlaying(true);
    });
  };

  const pause = () => {
    audioRef.current?.pause();
    window.localStorage.setItem(STORAGE_KEY, "false");
    setIsPlaying(false);
  };

  const toggleMuted = () => {
    setIsMuted((currentValue) => {
      const nextValue = !currentValue;

      if (audioRef.current) {
        audioRef.current.muted = nextValue;
      }

      return nextValue;
    });
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded border border-slate-700 bg-slate-950/90 px-2 py-2 text-slate-100 shadow-lg backdrop-blur">
      <audio ref={audioRef} loop preload="auto" src={TRACK_SRC} />
      <div className="hidden min-w-0 px-1 sm:block">
        <p className="text-[0.65rem] font-black uppercase tracking-wide text-teal-300">
          Radio
        </p>
        <p className="max-w-[8rem] truncate text-xs text-slate-300">
          Haven Signal
        </p>
      </div>
      <button
        type="button"
        onClick={isPlaying ? pause : play}
        className="flex h-9 w-9 items-center justify-center rounded border border-rose-300 bg-rose-500 text-white"
        aria-label={isPlaying ? "Pause radio" : "Play radio"}
      >
        {isPlaying ? (
          <PauseIcon className="h-5 w-5" />
        ) : (
          <PlayIcon className="h-5 w-5" />
        )}
      </button>
      <button
        type="button"
        onClick={toggleMuted}
        className="flex h-9 w-9 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200"
        aria-label={isMuted ? "Unmute radio" : "Mute radio"}
      >
        {isMuted ? (
          <SpeakerXMarkIcon className="h-5 w-5" />
        ) : (
          <SpeakerWaveIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};

export default BackgroundSound;
