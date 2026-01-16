import { useEffect, useRef } from "react";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, useActionData, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { QuizLocked } from "~/components/quiz/quiz-locked";
import { QuizQuestions } from "~/components/quiz/quiz-questions";
import { QuizResults } from "~/components/quiz/quiz-results";
import { Button } from "~/components/ui/button";
import { useCourseData } from "~/hooks/useCourseData";
import { useProgress } from "~/hooks/useProgress";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { formatSeconds, getLessonsInOrder } from "~/lib/utils";
import { ProgressService } from "~/services/progress.server";
import { QuizService } from "~/services/quiz.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Routes.Quiz");

export async function loader(args: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(args);

  const quizId = args.params.quizId;
  invariant(quizId, "Quiz ID is required");

  try {
    const quiz = await QuizService.getById(quizId);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!quiz) {
      logger.error(`Quiz ${quizId} not found`);
      throw Responses.notFound();
    }

    const progress = await ProgressService.getByQuizId(userId, parseInt(quizId));
    return { quiz: quiz.data, progress };
  } catch (error) {
    Sentry.captureException(error, { extra: { userId, quizId } });
    logger.error(`Error loading quiz ${quizId}`, { error });
    if (error instanceof Response) {
      throw error;
    }
    throw Responses.serverError();
  }
}

export async function action(args: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(args);

  const quizId = args.params.quizId;
  invariant(quizId, "Quiz ID is required");

  /**
   * Form data structure:
   * {
   *   "question-0": "4",
   *   "question-1": "5"
   * }
   */
  const formData = Object.fromEntries(await args.request.formData());

  const quiz = await QuizService.getCorrectAnswers(quizId);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!quiz) {
    logger.error(`Quiz ${quizId} not found`);
    throw Responses.notFound();
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

  if (!correctQuizAnswers?.length) {
    logger.error(`Quiz ${quizId} has no correct answers`);
    return Toasts.dataWithError(
      { score: 0, passed: false, userAnswers: [], passingScore: quiz.data.attributes.passing_score },
      {
        message: "Error",
        description: "There was an error processing your quiz. Please try again later.",
      },
    );
  }

  // [2, 1]
  const userAnswers = Object.entries(formData).map(([_, answer]) => {
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

  logger.info(`Quiz ${quizId} submitted by user ${userId} (score: ${score}, passed: ${passed})`);

  if (passed) {
    await QuizService.markAsPassed(parseInt(quizId), userId, score);
  }

  return {
    score,
    passed,
    userAnswers,
    passingScore: quiz.data.attributes.passing_score,
  };
}

export default function Quiz() {
  const { course } = useCourseData();
  const { quiz, progress } = useLoaderData<typeof loader>();
  const { lessonProgress } = useProgress();
  const actionData = useActionData<typeof action>();
  const resultsRef = useRef<HTMLDivElement>(null);

  const lessons = getLessonsInOrder({ course, progress: lessonProgress });

  const duration = quiz.attributes.required_duration_in_seconds ?? 0;

  // Scroll to results if quiz is submitted
  useEffect(() => {
    if (typeof actionData?.score !== "undefined" && typeof window !== "undefined") {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [actionData?.score]);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <>
      <title>{`${quiz.attributes.title} | ${course.attributes.title}`}</title>
      <PageTitle>{quiz.attributes.title}</PageTitle>
      <div className="mt-4">{children}</div>
    </>
  );

  if (!quiz.attributes.questions?.length) {
    return (
      <Wrapper>
        <p>Oops! This quiz is empty.</p>
      </Wrapper>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const quizSection = course.attributes.sections.find((s) => s.quiz?.data?.id === quiz.id);
  // Quiz is locked if any lesson in the quiz section is not completed
  const isQuizLocked = lessons.filter((l) => l.sectionId === quizSection?.id).some((l) => !l.isCompleted);
  if (isQuizLocked) {
    return (
      <Wrapper>
        <QuizLocked />
      </Wrapper>
    );
  }

  const isPassed = Boolean(progress?.isCompleted ?? (actionData?.passed && actionData.score));

  const PassingInfo = () => (
    <p className="mt-1 text-sm text-secondary-foreground">
      You must score <strong>{quiz.attributes.passing_score}% or higher</strong> to pass this quiz.
    </p>
  );

  const TimeInfo = () =>
    duration ? (
      <p className="mt-1 text-sm text-secondary-foreground">
        You must spend <strong>{formatSeconds(duration)}</strong> on this quiz before submitting.
      </p>
    ) : null;

  const isFailed = Boolean(!progress?.isCompleted && actionData && !actionData.passed);
  const firstLessonInSectionSlug = quizSection?.lessons?.data[0].attributes.slug;
  const FailedView = () => (
    <div className="mt-8 flex flex-col gap-2 sm:max-w-96">
      <Button asChild variant="primary-md">
        <Link to={"."}>Retake Quiz</Link>
      </Button>
      <span className="text-center">or</span>
      <Button variant="link" className="text-foreground underline">
        <Link to={`/${firstLessonInSectionSlug}`}>Restart Section</Link>
      </Button>
    </div>
  );

  return (
    <Wrapper>
      <QuizResults isPassed={isPassed} score={progress?.score ?? actionData?.score ?? 100} />
      <PassingInfo />
      <TimeInfo />
      {isFailed ? <FailedView /> : <QuizQuestions progress={progress} quiz={quiz} />}
    </Wrapper>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
