import { UserLessonProgress } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
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
  const [lastSubmitMs, setLastSubmitMs] = useState<number | null>(null);
  const [countdownValue, { pause, resume }] = useCountdown(duration - (progress?.durationInSeconds ?? 0), 0, {
    startOnMount: true,
  });

  // Submit progress every n seconds
  useEffect(() => {
    if (typeof duration === "undefined" || progress?.isCompleted) {
      return;
    }

    const interval = setInterval(() => {
      if (lastSubmitMs === null || Date.now() - lastSubmitMs > SUBMIT_INTERVAL_MS) {
        fetcher.submit({ userId: user.id, lessonId: lesson.id }, { method: "POST", action: "?index", navigate: false });
        setLastSubmitMs(Date.now());
      }
    }, SUBMIT_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownValue, fetcher, progress?.isCompleted]);

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
      {/* {process.env.NODE_ENV === "development"
        ? createPortal(
            <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border bg-background p-2 shadow-xl">
              <button className="rounded bg-secondary px-3 py-2 font-bold hover:bg-secondary/90" onClick={resume}>
                Resume
              </button>
              <button className="rounded bg-secondary px-3 py-2 font-bold hover:bg-secondary/90" onClick={pause}>
                Pause
              </button>
            </div>,
            document.body,
          )
        : null} */}
    </>
  );
}
