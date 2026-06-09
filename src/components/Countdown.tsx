import React from "react";

import { formatDuration } from "@/utils/gameData";

type CountdownProps = {
  seconds?: number | null;
  target?: Date | string | null;
  onDone?: () => void;
};

const Countdown = ({ seconds, target, onDone }: CountdownProps) => {
  const getInitialSeconds = React.useCallback(() => {
    if (target) {
      const targetDate = target instanceof Date ? target : new Date(target);
      return Math.max(0, Math.ceil((targetDate.getTime() - Date.now()) / 1000));
    }

    return Math.max(0, Math.ceil(seconds ?? 0));
  }, [seconds, target]);
  const [remainingSeconds, setRemainingSeconds] = React.useState(getInitialSeconds);

  React.useEffect(() => {
    setRemainingSeconds(getInitialSeconds());

    const interval = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        const nextSeconds = target ? getInitialSeconds() : Math.max(0, currentSeconds - 1);

        if (nextSeconds === 0 && currentSeconds !== 0) {
          onDone?.();
        }

        return nextSeconds;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [getInitialSeconds, onDone, target]);

  return <span>{remainingSeconds === 0 ? "Ready" : formatDuration(remainingSeconds)}</span>;
};

export default Countdown;
