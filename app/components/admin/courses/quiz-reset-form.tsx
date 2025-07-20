import { IconLoader } from "@tabler/icons-react";
import { useFetcher, useFetchers } from "react-router";

import { AdminButton } from "~/components/ui/admin-button";
import type { loader } from "~/routes/admin.users.$id.courses.$courseId";

export function QuizResetForm(props: { quiz: { id: number }; hasProgress: boolean }) {
  const fetcher = useFetcher<typeof loader>();
  const fetchers = useFetchers();

  const { quiz, hasProgress } = props;

  const currentActions = fetchers.map((f) => f.formData?.get("_action"));
  const isBeingUpdated =
    currentActions.includes("reset-quiz") && fetchers.some((f) => f.formData?.get("quizId") === quiz.id.toString());

  return (
    <fetcher.Form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="quizId" value={quiz.id} />

      <AdminButton
        variant="secondary"
        type="submit"
        name="_action"
        value="reset-quiz"
        disabled={!hasProgress || isBeingUpdated}
      >
        {isBeingUpdated ? <IconLoader className="size-4 animate-spin" /> : null}
        <span>Reset</span>
      </AdminButton>
    </fetcher.Form>
  );
}
