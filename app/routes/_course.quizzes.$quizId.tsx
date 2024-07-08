import { Prisma } from "@prisma/client";
import { Form, Link, MetaFunction, useActionData, useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@vercel/remix";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { QuizFailed } from "~/components/quiz/quiz-failed";
import { QuizLocked } from "~/components/quiz/quiz-locked";
import { QuizPassed } from "~/components/quiz/quiz-passed";
import { Button } from "~/components/ui/button";
import { useCourseData } from "~/hooks/useCourseData";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, notFound } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { loader as courseLoader } from "~/routes/_course";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData } from "~/types/utils";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const quizId = params.quizId;
  invariant(quizId, "Quiz ID is required");

  try {
    const quiz = await cms.findOne<APIResponseData<"api::quiz.quiz">>("quizzes", quizId, {
      populate: {
        questions: {
          fields: "*",
          populate: {
            answers: {
              fields: ["answer", "id"],
            },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!quiz) {
      throw notFound("Quiz not found.");
    }

    const progress = await db.userQuizProgress.findUnique({
      where: {
        userId_quizId: {
          quizId: quiz.data.id,
          userId,
        },
      },
    });

    return json({ quiz: quiz.data, progress });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw error;
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const quizId = params.quizId;
  invariant(quizId, "Quiz ID is required");

  // {
  //   "question-0": "4",
  //   "question-1": "5"
  // }
  const formData = Object.fromEntries(await request.formData());

  try {
    const quiz = await cms.findOne<APIResponseData<"api::quiz.quiz">>("quizzes", quizId, {
      populate: {
        questions: {
          fields: ["question_type"],
          populate: {
            answers: {
              fields: ["is_correct"],
            },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!quiz) {
      throw notFound("Quiz not found.");
    }

    // [2, 1]
    const correctQuizAnswers = quiz.data.attributes.questions
      ?.map((question) => {
        if (!question.answers) {
          return;
        }
        return question.answers.findIndex((answer) => answer.is_correct);
      })
      .filter((a) => typeof a !== "undefined");

    if (!correctQuizAnswers || !correctQuizAnswers.length) {
      return toast.json(
        request,
        { score: 0, passed: false, userAnswers: [], passingScore: quiz.data.attributes.passing_score },
        {
          title: "Error",
          description: "There was an error processing your quiz. Please try again later.",
          type: "error",
        },
      );
    }

    // [2, 1]
    const userAnswers = Object.entries(formData).map(([_question, answer]) => {
      if (typeof answer !== "string") {
        return;
      }
      return parseInt(answer);
    });

    // Calculate score
    let score = 0;
    correctQuizAnswers.forEach((correctAnswer, index) => {
      if (correctAnswer === userAnswers[index]) {
        score++;
      }
    });

    score = Math.ceil((score / correctQuizAnswers.length) * 100);
    const passed = score >= quiz.data.attributes.passing_score;

    if (passed) {
      await db.userQuizProgress.upsert({
        where: {
          userId_quizId: {
            quizId: quiz.data.id,
            userId,
          },
        },
        create: {
          userId,
          quizId: quiz.data.id,
          isCompleted: true,
          score,
        },
        update: {
          isCompleted: true,
          score,
        },
      });
    }

    return json({
      score,
      passed,
      userAnswers,
      passingScore: quiz.data.attributes.passing_score,
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw error;
  }
}

export const meta: MetaFunction<typeof loader, { "routes/_course": typeof courseLoader }> = ({ data, matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "routes/_course")?.data.course;
  return [{ title: `${data?.quiz.attributes.title} | ${match?.attributes.title}` }];
};

export default function Quiz() {
  const { course, lessonsInOrder } = useCourseData();
  const { quiz, progress } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll to results quiz is submitted
  useEffect(() => {
    if (typeof actionData?.score !== "undefined" && typeof window !== "undefined") {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [actionData?.score]);

  if (!quiz.attributes.questions?.length) {
    return (
      <>
        <PageTitle>{quiz.attributes.title}</PageTitle>
        <div className="mt-4">
          <p>Oops! This quiz is empty.</p>
        </div>
      </>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const quizSection = course.attributes.sections.find((s) => s.quiz?.data?.id === quiz.id);
  const firstLessonInSectionSlug = quizSection?.lessons?.data[0].attributes.slug;

  // Quiz is locked if any lesson in the quiz section is not completed
  const isQuizLocked = lessonsInOrder.filter((l) => l.sectionId === quizSection?.id).some((l) => !l.isCompleted);

  const isPassed = Boolean(progress?.isCompleted || (actionData?.passed && actionData.score));
  const isFailed = Boolean(!progress?.isCompleted && actionData && !actionData.passed);

  if (isQuizLocked) {
    return <QuizLocked title={quiz.attributes.title ?? `Quiz ${quiz.id}`} />;
  }

  return (
    <>
      {/* Results */}
      <div role="alert" aria-live="polite" ref={resultsRef}>
        {isPassed ? (
          <QuizPassed score={progress?.score ?? actionData?.score ?? 100} />
        ) : !actionData?.passed && typeof actionData?.score !== "undefined" ? (
          <QuizFailed score={actionData.score} />
        ) : null}
      </div>
      <PageTitle>{quiz.attributes.title}</PageTitle>
      <p className="mt-1 text-sm text-secondary-foreground">
        Score <strong>{quiz.attributes.passing_score}% or higher</strong> on this quiz to proceed.
      </p>
      {/* TODO: Complete to unlock/up next */}
      {/* <CourseUpNext lesson={} /> */}
      {isFailed ? (
        <div className="mt-8 flex flex-col gap-2 sm:max-w-96">
          <Button asChild>
            <Link to={`.`}>Retake Quiz</Link>
          </Button>
          <span className="text-center">or</span>
          <Button variant="link" className="text-foreground underline">
            <Link to={`/${firstLessonInSectionSlug}`}>Restart Section</Link>
          </Button>
        </div>
      ) : (
        <Form className="mt-8" method="post">
          {/* Questions */}
          <fieldset className={cn("flex flex-col gap-8", progress?.isCompleted && "opacity-50")} disabled={isPassed}>
            {quiz.attributes.questions.map((question, q_index) => {
              if (!question.question) {
                return null;
              }

              return (
                <div key={`question-${q_index + 1}`}>
                  <h2 className="mb-4 text-[32px] font-bold leading-tight">{question.question}</h2>
                  <ul className="flex flex-col gap-2">
                    {question.answers?.map(({ answer }, a_index) => {
                      if (!answer) {
                        return null;
                      }

                      return (
                        <li key={`question-${q_index}-answer-${a_index}`} className="flex items-center gap-2">
                          <input
                            required
                            id={`question-${q_index}-answer-${a_index}`}
                            type="radio"
                            name={`question-${q_index}`}
                            value={a_index}
                            className="size-6 cursor-pointer border-2 !border-foreground text-foreground focus:ring-offset-background disabled:cursor-not-allowed dark:text-black"
                          />
                          <label
                            htmlFor={`question-${q_index}-answer-${a_index}`}
                            className="cursor-pointer text-lg font-medium"
                          >
                            {answer}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </fieldset>
          {isPassed ? null : (
            <Button type="submit" className="mt-8 sm:max-w-64">
              Submit
            </Button>
          )}
        </Form>
      )}
    </>
  );
}
