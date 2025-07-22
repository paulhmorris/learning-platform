import { IconLoader } from "@tabler/icons-react";
import { useFetcher, useFetchers } from "react-router";

import { AdminButton } from "~/components/ui/admin-button";
import { Input } from "~/components/ui/input";
import type { loader } from "~/routes/admin.users.$id.courses.$courseId";

export function QuizUpdateForm(props: { quiz: { id: number; attributes: { passing_score: number } } }) {
  const fetcher = useFetcher<typeof loader>();
  const fetchers = useFetchers();

  const { quiz } = props;

  const currentActions = fetchers.map((f) => f.formData?.get("_action"));
  const isBeingUpdated =
    currentActions.includes("update-quiz") && fetchers.some((f) => f.formData?.get("quizId") === quiz.id.toString());

  return (
    <fetcher.Form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="quizId" value={quiz.id} />
      <input type="hidden" name="passingScore" value={quiz.attributes.passing_score} />
      <Input
        name="score"
        placeholder="Percect"
        pattern="[0-9]*"
        defaultValue={100}
        disabled={isBeingUpdated}
        required
      />
      <AdminButton
        variant="secondary"
        type="submit"
        name="_action"
        value="update-quiz"
        disabled={isBeingUpdated}
        className="hover:bg-primary hover:text-white dark:hover:text-black"
      >
        {isBeingUpdated ? <IconLoader className="size-4 animate-spin" /> : null}
        <span>Set Score</span>
      </AdminButton>
    </fetcher.Form>
  );
}
