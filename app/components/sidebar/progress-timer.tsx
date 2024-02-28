import { UserLessonProgress } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
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
  const [countdownValue, { stop, resume }] = useCountdown(duration - (progress?.durationInSeconds ?? 0), 0, {
    startOnMount: true,
  });

  // Submit progress every n seconds
  useEffect(() => {
    if (typeof duration === "undefined" || progress?.isCompleted) {
      return;
    }

    const timer = setTimeout(() => {
      if (typeof duration === "undefined" || progress?.isCompleted) {
        return;
      }

      fetcher.submit({ userId: user.id, lessonId: lesson.id }, { method: "POST", action: "?index", navigate: false });
    }, SUBMIT_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [fetcher, lesson.id, duration, progress?.isCompleted, progress?.updatedAt, user.id]);

  // Stop the timer when the time is up
  useEffect(() => {
    if (typeof duration === "undefined" || progress?.isCompleted) {
      stop();
      return;
    }

    resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownValue, duration, progress?.isCompleted]);

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
