import { useFetchers } from "@remix-run/react";
import { IconLoader } from "@tabler/icons-react";
import { useTypedFetcher } from "remix-typedjson";

import { AdminButton } from "~/components/ui/admin-button";
import { Input } from "~/components/ui/input";
import { loader } from "~/routes/admin.users.$id.courses.$courseId";

export function LessonUpdateForm(props: {
  lesson: { id: number; attributes: { required_duration_in_seconds?: number } };
}) {
  const fetcher = useTypedFetcher<typeof loader>();
  const fetchers = useFetchers();

  const { lesson } = props;

  const currentActions = fetchers.map((f) => f.formData?.get("_action"));
  const isBeingUpdated =
    currentActions.includes("update-lesson") &&
    fetchers.some((f) => f.formData?.get("lessonId") === lesson.id.toString());

  return (
    <fetcher.Form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="lessonId" value={lesson.id} />
      <input type="hidden" name="requiredDurationInSeconds" value={lesson.attributes.required_duration_in_seconds} />
      <Input name="durationInSeconds" placeholder="Seconds" pattern="[0-9]*" disabled={isBeingUpdated} required />
      <AdminButton variant="secondary" type="submit" name="_action" value="update-lesson" disabled={isBeingUpdated}>
        {isBeingUpdated ? <IconLoader className="size-4 animate-spin" /> : null}
        <span>Set Progress</span>
      </AdminButton>
    </fetcher.Form>
  );
}
