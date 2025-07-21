import { useEffect } from "react";
import { useCountdown } from "react-timing-hooks";
import { useLocalStorage } from "usehooks-ts";

type Args = {
  key: string;
  duration: number;
};

/**
 * Custom hook to manage a countdown timer.
 * It uses local storage to persist the state across page reloads.
 * When the countdown reaches zero, it sets a boolean flag in local storage
 */
export function usePersistentCountdown({ key, duration }: Args) {
  const [reachedRequiredTime, setReachedRequiredTime] = useLocalStorage(key, false);
  const [countdownValue] = useCountdown(reachedRequiredTime ? 0 : duration, 0, { startOnMount: true });

  useEffect(() => {
    if (duration && countdownValue === 0) {
      setReachedRequiredTime(true);
    }
  }, [countdownValue, duration, setReachedRequiredTime]);

  return { countdownValue, reachedRequiredTime };
}
