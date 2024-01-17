import { Lesson, UserLessonProgress } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { useTimer } from "react-timing-hooks";

import { cn, useUser } from "~/lib/utils";
import { SUBMIT_INTERVAL_MS } from "~/routes/_app.courses.$courseSlug.$lessonSlug._index";

interface Props {
  lesson: Lesson;
  progress: UserLessonProgress | null;
}

export function ProgressTimer({ lesson, progress }: Props) {
  const user = useUser();
  const fetcher = useFetcher();
  const [timerValue, { start, stop }] = useTimer(progress?.durationInSeconds ?? 0, { startOnMount: true });

  // Submit progress every 10 seconds
  useEffect(() => {
    if (lesson.requiredDurationInSeconds === null || progress?.isCompleted) return;

    const timer = setTimeout(() => {
      if (lesson.requiredDurationInSeconds === null || progress?.isCompleted) return;

      fetcher.submit({ userId: user.id, lessonId: lesson.id }, { method: "POST", navigate: false });
    }, SUBMIT_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [fetcher, lesson.id, lesson.requiredDurationInSeconds, progress?.isCompleted, progress?.updatedAt, user.id]);

  // Stop the timer when the time is up
  useEffect(() => {
    if (lesson.requiredDurationInSeconds === null) return;

    if (progress?.isCompleted || timerValue >= lesson.requiredDurationInSeconds) {
      stop();
      return;
    }

    start();
  }, [timerValue, lesson.requiredDurationInSeconds, stop, start, progress?.isCompleted]);

  if (!lesson.requiredDurationInSeconds) return null;
  return (
    <div>
      <p className={cn(timerValue >= lesson.requiredDurationInSeconds && "text-green-700")}>
        {formatSeconds(timerValue)}
      </p>
      <p>
        Server: {progress?.durationInSeconds} / {lesson.requiredDurationInSeconds}
      </p>
    </div>
  );
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
