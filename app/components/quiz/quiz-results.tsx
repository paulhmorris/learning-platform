import { ComponentPropsWithRef } from "react";
import { useActionData } from "react-router";

import { QuizFailed } from "~/components/quiz/quiz-failed";
import { QuizPassed } from "~/components/quiz/quiz-passed";
import { action } from "~/routes/_course.quizzes.$quizId";

type Props = {
  isPassed: boolean;
  score: number;
} & ComponentPropsWithRef<"div">;

export function QuizResults({ isPassed, score, ref }: Props) {
  const actionData = useActionData<typeof action>();

  return (
    <div role="alert" aria-live="polite" ref={ref}>
      {isPassed ? (
        <QuizPassed score={score} />
      ) : !actionData?.passed && typeof actionData?.score !== "undefined" ? (
        <QuizFailed score={score} />
      ) : null}
    </div>
  );
}
