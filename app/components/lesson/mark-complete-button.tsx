import { IconAlertCircleFilled, IconCircleCheckFilled, IconInfoCircleFilled, IconLoader } from "@tabler/icons-react";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";

type Props = {
  lessonId: number;
  isCompleted: boolean;
};

export function MarkCompleteButton({ lessonId, isCompleted }: Props) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";

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

  return (
    <fetcher.Form method="POST" action="/api/progress">
      <input type="hidden" name="lessonId" value={lessonId} />
      <Button
        disabled={isCompleted || isSubmitting}
        variant="primary-md"
        className="w-auto"
        name="intent"
        value="mark-complete"
        title={isCompleted ? "Lesson is already completed" : undefined}
      >
        {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
        <span>Mark Complete</span>
      </Button>
    </fetcher.Form>
  );
}
