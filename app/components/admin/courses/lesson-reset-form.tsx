import { useFetchers } from "@remix-run/react";
import { IconLoader } from "@tabler/icons-react";
import { useTypedFetcher } from "remix-typedjson";

import { AdminButton } from "~/components/ui/admin-button";
import { loader } from "~/routes/admin.users.$id.courses.$courseId";

export function LessonResetForm(props: {
  lesson: { id: number; attributes: { required_duration_in_seconds?: number } };
  progress: { durationInSeconds: number | null } | undefined;
}) {
  const fetcher = useTypedFetcher<typeof loader>();
  const fetchers = useFetchers();

  const { lesson } = props;
  const progress = props.progress;

  const currentActions = fetchers.map((f) => f.formData?.get("_action"));
  const isBeingUpdated =
    currentActions.includes("reset-lesson") &&
    fetchers.some((f) => f.formData?.get("lessonId") === lesson.id.toString());

  return (
    <fetcher.Form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="lessonId" value={lesson.id} />
      <input type="hidden" name="requiredDurationInSeconds" value={lesson.attributes.required_duration_in_seconds} />
      <AdminButton
        variant="secondary"
        type="submit"
        name="_action"
        value="reset-lesson"
        disabled={!progress || progress.durationInSeconds === 0 || isBeingUpdated}
      >
        {isBeingUpdated ? <IconLoader className="size-4 animate-spin" /> : null}
        <span>Reset</span>
      </AdminButton>
    </fetcher.Form>
  );
}
