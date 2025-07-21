import { IconCircleCheckFilled } from "@tabler/icons-react";
import { useId } from "react";
import { Form, useActionData } from "react-router";

import { QuizQuestion } from "~/components/quiz/quiz-question";
import { Button } from "~/components/ui/button";
import { usePersistentCountdown } from "~/hooks/usePersistentCountdown";
import { cn, formatSeconds } from "~/lib/utils";
import { action, loader } from "~/routes/_course.quizzes.$quizId";

type Props = {
  progress: Awaited<ReturnType<typeof loader>>["progress"];
  quiz: Awaited<ReturnType<typeof loader>>["quiz"];
};

export function QuizQuestions({ progress, quiz }: Props) {
  const actionData = useActionData<typeof action>();
  const fallbackId = useId();

  const id = quiz.attributes.uuid ?? fallbackId;
  const duration = quiz.attributes.required_duration_in_seconds ?? 0;

  const { countdownValue, reachedRequiredTime } = usePersistentCountdown({ key: `quiz-time-${id}`, duration });

  const isPassed = Boolean(progress?.isCompleted ?? (actionData?.passed && actionData.score));
  const isQuizTimed = Boolean(duration);

  const questions = quiz.attributes.questions ?? [];

  return (
    <Form className="mt-8" method="post">
      {/* Questions */}
      <fieldset className={cn("flex flex-col gap-8", progress?.isCompleted && "opacity-50")} disabled={isPassed}>
        <legend className="sr-only">Quiz Questions</legend>
        {questions.map((question, q_index) => {
          if (!question.question) {
            return null;
          }

          return (
            <QuizQuestion
              key={`question-${q_index + 1}`}
              question={question.question}
              questionIndex={q_index}
              answers={question.answers}
            />
          );
        })}
      </fieldset>
      {isPassed ? null : (
        <div className="mt-8 flex flex-col gap-y-2">
          {isQuizTimed ? (
            <div className="flex items-center gap-x-2">
              <span
                aria-label="Time remaining on this quiz"
                className={cn(countdownValue === 0 && "text-success", "font-medium tabular-nums")}
              >
                {formatSeconds(countdownValue)} remaining
              </span>
              {reachedRequiredTime ? <IconCircleCheckFilled className="size-5 text-success" /> : null}
            </div>
          ) : null}
          <Button type="submit" className="sm:max-w-64" disabled={Boolean(isQuizTimed && !reachedRequiredTime)}>
            Submit
          </Button>
        </div>
      )}
    </Form>
  );
}
