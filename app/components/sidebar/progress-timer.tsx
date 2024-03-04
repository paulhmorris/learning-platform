import { UserLessonProgress } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useCountdown } from "react-timing-hooks";

import { cn, formatSeconds, useUser } from "~/lib/utils";
import { SUBMIT_INTERVAL_MS } from "~/routes/_app.courses.$courseSlug.$lessonSlug._index";
import { APIResponseData } from "~/types/utils";

interface Props {
  lesson: APIResponseData<"api::lesson.lesson">;
  progress: UserLessonProgress | null;
}

export function ProgressTimer({ lesson, progress }: Props) {
  const duration = lesson.attributes.required_duration_in_seconds ?? 0;
  const user = useUser();
  const fetcher = useFetcher();
  const countdownStart = duration - (progress?.durationInSeconds ?? 0);
  const [countdownValue, { pause, resume, isPaused }] = useCountdown(countdownStart, 0, {
    startOnMount: true,
  });

  // Submit progress after 15 seconds or when the countdown reaches 0
  const shouldSubmit =
    countdownStart !== countdownValue && (countdownValue === 0 || countdownValue % (SUBMIT_INTERVAL_MS / 1000) === 0);

  useEffect(() => {
    if (typeof duration === "undefined" || progress?.isCompleted) {
      return;
    }

    if (shouldSubmit) {
      fetcher.submit({ userId: user.id, lessonId: lesson.id }, { method: "POST", action: "?index", navigate: false });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSubmit]);

  // Pause the timer when the tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    };

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
        {formatSeconds(countdownValue)} minutes remaining
      </span>
      {process.env.NODE_ENV === "production"
        ? createPortal(
            <div className="fixed bottom-8 left-8 flex flex-col gap-2 rounded border bg-background px-8 py-4 shadow-xl">
              <p className="text-sm font-bold">Timer controls:</p>
              <button
                type="button"
                className="rounded bg-primary px-3 py-1 font-bold hover:bg-primary/90"
                onClick={isPaused ? resume : pause}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
