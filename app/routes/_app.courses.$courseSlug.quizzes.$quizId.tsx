import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useParams } from "@remix-run/react";
import { useEffect } from "react";
import { typedjson, useTypedActionData, useTypedLoaderData, useTypedRouteLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { Button } from "~/components/ui/button";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, notFound } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { loader as courseLoader } from "~/routes/_app.courses.$courseSlug";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData, TypedMetaFunction } from "~/types/utils";

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

    return typedjson({ quiz: quiz.data, progress });
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
      .filter(Boolean);

    if (!correctQuizAnswers) {
      throw notFound("Quiz answers not found.");
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

    return typedjson({
      correctQuizAnswers,
      userAnswers,
      passed,
      score,
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

export const meta: TypedMetaFunction<typeof loader, { "routes/_app.courses.$courseSlug": typeof courseLoader }> = ({
  data,
  matches,
}) => {
  // @ts-expect-error typed meta funtion not supporting this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "routes/_app.courses.$courseSlug")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `${data?.quiz.attributes.title} | ${match?.attributes.title}` }];
};

export default function Quiz() {
  const courseData = useTypedRouteLoaderData<typeof courseLoader>("routes/_app.courses.$courseSlug");
  const { quiz, progress } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const params = useParams();

  // Scroll to top when quiz is submitted
  useEffect(() => {
    if (typeof actionData?.score !== "undefined" && typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [actionData?.score]);

  if (!courseData) {
    throw new Error("Course data not found");
  }

  const firstLessonInSectionSlug = courseData.course.attributes.sections.find(
    (section) => section.quiz?.data.id === quiz.id,
  )?.lessons?.data[0].attributes.slug;
  const isPassed = Boolean(progress?.isCompleted || (actionData?.passed && actionData.score));
  const isFailed = Boolean(!progress?.isCompleted && actionData && !actionData.passed);

  return (
    <>
      {/* Results */}
      <div role="alert" aria-live="polite">
        {isPassed ? (
          <div className="mb-8">
            <div className="rounded-md border-success bg-success/5 p-4 text-success dark:bg-success/15">
              <h2 className="text-2xl font-bold">You passed!</h2>
              <p>You passed with a score of {progress?.score || actionData?.score}%. Great job!</p>
            </div>
          </div>
        ) : !actionData?.passed && typeof actionData?.score !== "undefined" ? (
          <div className="mb-8">
            <div className="rounded-md border-destructive bg-destructive/5 p-4 text-destructive dark:bg-destructive/15">
              <h2 className="text-2xl font-bold">You didn't pass.</h2>
              <p>You failed with a score of {actionData.score}%. Please try again.</p>
            </div>
          </div>
        ) : null}
      </div>
      <PageTitle>{quiz.attributes.title}</PageTitle>
      <p className="text-sm text-secondary-foreground">
        Score {quiz.attributes.passing_score}% or higher on this quiz to proceed.
      </p>
      {/* TODO: Complete to unlock */}
      {isFailed ? (
        <div className="mt-8 flex flex-col gap-2 sm:max-w-96">
          <Button asChild>
            <Link to={`.`}>Retake Quiz</Link>
          </Button>
          <span className="text-center">or</span>
          <Button variant="link" className="text-foreground underline">
            <Link to={`/courses/${params.courseSlug}/${firstLessonInSectionSlug}`}>Restart Section</Link>
          </Button>
        </div>
      ) : (
        <Form className="mt-8" method="post">
          {/* Questions */}
          <fieldset className={cn("flex flex-col gap-8", progress?.isCompleted && "opacity-50")} disabled={isPassed}>
            {quiz.attributes.questions?.map((question, q_index) => {
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
