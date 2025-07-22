import { UserLessonProgress } from "@prisma/client";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useFetcher } from "react-router";
import { useCountdown } from "react-timing-hooks";

import { cn, formatSeconds } from "~/lib/utils";
import { SUBMIT_INTERVAL_MS } from "~/routes/api.lesson-progress";
import { APIResponseData } from "~/types/utils";

interface Props {
  lesson: APIResponseData<"api::lesson.lesson">;
  progress: Omit<UserLessonProgress, "createdAt" | "updatedAt"> | null;
  setClientProgressPercentage: (percentage: number) => void;
}

export function ProgressTimer({ lesson, progress, setClientProgressPercentage }: Props) {
  const duration = lesson.attributes.required_duration_in_seconds ?? 0;
  const fetcher = useFetcher({ key: "lesson-progress" });
  const countdownStart = duration - (progress?.durationInSeconds ?? 0);
  const [countdownValue, { pause, resume, isPaused }] = useCountdown(countdownStart, 0, { startOnMount: true });

  // Update client side progress percentage
  useEffect(() => {
    const percentage = Math.floor(((duration - countdownValue) / duration) * 100);
    setClientProgressPercentage(percentage);
  }, [countdownValue, setClientProgressPercentage, countdownStart, duration]);

  // Submit progress after 15 seconds or when the countdown reaches 0
  const shouldSubmit =
    countdownStart !== countdownValue && (countdownValue === 0 || countdownValue % (SUBMIT_INTERVAL_MS / 1000) === 0);

  useEffect(() => {
    if (typeof duration === "undefined" || progress?.isCompleted) {
      return;
    }

    if (shouldSubmit) {
      void fetcher.submit(
        { lessonId: lesson.id, intent: "increment-duration" },
        { method: "POST", action: "/api/lesson-progress" },
      );
    }
  }, [shouldSubmit]);

  // Pause the timer when the tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => (document.hidden ? pause() : resume());

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pause, resume]);

  if (!duration) {
    return null;
  }

  if (progress?.isCompleted) {
    return (
      <span className="font-bold text-success" aria-label="Lesson completed">
        Completed!
      </span>
    );
  }

  return (
    <>
      <span
        aria-label="Time remaining on this lesson"
        className={cn(countdownValue === 0 && "text-success", "tabular-nums")}
      >
        {formatSeconds(countdownValue)} remaining
      </span>
      {process.env.NODE_ENV === "development" && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              className="fixed bottom-8 left-8 rounded bg-primary p-3 font-bold text-black shadow-xl hover:bg-primary/90"
              onClick={isPaused ? resume : pause}
            >
              {isPaused ? <IconPlayerPlayFilled /> : <IconPlayerPauseFilled />}
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
