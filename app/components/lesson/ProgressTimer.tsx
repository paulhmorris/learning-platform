import { Lesson, UserLessonProgress } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { useTimer } from "react-timing-hooks";

import { useUser } from "~/lib/utils";
import { SUBMIT_INTERVAL_MS } from "~/routes/_app.courses.$courseSlug.$lessonSlug._index";

interface Props {
  lesson: Lesson;
  progress: UserLessonProgress | null;
}

export function ProgressTimer({ lesson, progress }: Props) {
  const userId = useUser();
  const [timerValue] = useTimer(progress?.durationInSeconds ?? 0, { startOnMount: true });
  const fetcher = useFetcher();

  useEffect(() => {
    // This is only for lessons with required durations
    if (!lesson.requiredDurationInSeconds) return;

    const timer = setTimeout(() => {
      fetcher.submit({ userId: userId.id, lessonId: lesson.id }, { method: "POST", navigate: false });
    }, SUBMIT_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [fetcher, lesson.id, lesson.requiredDurationInSeconds, progress?.updatedAt, userId.id]);

  return (
    <div>
      <p>Client: {timerValue}</p>
      <p>
        Server: {progress?.durationInSeconds ?? 0} seconds saved / {lesson.requiredDurationInSeconds} required
      </p>
    </div>
  );
}
