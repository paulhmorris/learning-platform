import { UserLessonProgress } from "@prisma/client";
import { IconAlertCircleFilled, IconCircleCheckFilled, IconInfoCircleFilled } from "@tabler/icons-react";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useCountdown } from "react-timing-hooks";
import { toast } from "sonner";

import { cn, formatSeconds } from "~/lib/utils";
import { SUBMIT_INTERVAL_MS } from "~/routes/api.progress";
import { APIResponseData } from "~/types/utils";

interface Props {
  lesson: APIResponseData<"api::lesson.lesson">;
  progress: Pick<UserLessonProgress, "lessonId" | "isCompleted" | "durationInSeconds"> | null;
  setClientProgressPercentage: (percentage: number) => void;
}

export function ProgressTimer({ lesson, progress, setClientProgressPercentage }: Props) {
  // const progress = useLessonProgress(lesson.id);
  const duration = lesson.attributes.required_duration_in_seconds ?? 0;
  const fetcher = useFetcher();
  const countdownStart = duration - (progress?.durationInSeconds ?? 0);
  const [countdownValue, { stop, start }] = useCountdown(countdownStart, 0, {
    startOnMount: true,
  });

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
        { method: "POST", action: "/api/progress" },
      );
    }
  }, [shouldSubmit]);

  // Fire toast immediately when the action returns a toast in its response data
  useEffect(() => {
    const fetcherToast = (fetcher.data as { toast?: { type: string; message: string; description?: string } } | null)
      ?.toast;
    if (!fetcherToast) return;
    const { type, message, description } = fetcherToast;
    switch (type) {
      case "success":
        toast.success(message, { description, icon: <IconCircleCheckFilled className="size-5" /> });
        break;
      case "info":
        toast.info(message, { description, icon: <IconInfoCircleFilled className="size-5" /> });
        break;
      case "error":
        toast.error(message, { description, icon: <IconAlertCircleFilled className="size-5" />, duration: Infinity });
        break;
    }
  }, [fetcher.data]);

  // Pause the timer when the tab is not visible
  const handleVisibilityChange = () => (document.hidden ? stop() : start());
  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stop, start]);

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
    </>
  );
}
