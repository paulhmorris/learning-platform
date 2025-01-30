import { useFetcher } from "@remix-run/react";
import { IconLoader } from "@tabler/icons-react";

import { Button } from "~/components/ui/button";

type Props = {
  lessonId: number;
  isCompleted: boolean;
};

export function MarkCompleteButton({ lessonId, isCompleted }: Props) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";

  return (
    <fetcher.Form method="POST" action="/api/lesson-progress">
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
