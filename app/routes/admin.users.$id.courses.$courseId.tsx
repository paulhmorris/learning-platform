import { parseFormData } from "@rvf/react-router";
import { IconCircleCheckFilled, IconCircleDashed, IconCircleDashedCheck, IconCircleXFilled } from "@tabler/icons-react";
import { ActionFunctionArgs, LoaderFunctionArgs, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";

import { LessonCompleteForm } from "~/components/admin/courses/lesson-complete-form";
import { LessonProgressHeader } from "~/components/admin/courses/lesson-progress-header";
import { LessonResetForm } from "~/components/admin/courses/lesson-reset-form";
import { LessonUpdateForm } from "~/components/admin/courses/lesson-update-form";
import { QuizProgressHeader } from "~/components/admin/courses/quiz-progress-header";
import { QuizResetForm } from "~/components/admin/courses/quiz-reset-form";
import { QuizUpdateForm } from "~/components/admin/courses/quiz-update-form";
import { ResetAllProgressDialog } from "~/components/admin/courses/reset-all-progress-dialog";
import { ErrorComponent } from "~/components/error-component";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { formatSeconds } from "~/lib/utils";
import { optionalNumber } from "~/schemas/fields";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { QuizService } from "~/services/quiz.server";
import { SessionService } from "~/services/session.server";

const schema = z.object({
  _action: z.enum([
    "reset-all-progress",
    "reset-lesson",
    "complete-lesson",
    "update-lesson",
    "reset-quiz",
    "update-quiz",
  ]),
  quizId: optionalNumber,
  score: optionalNumber,
  passingScore: optionalNumber,
  lessonId: optionalNumber,
  durationInSeconds: optionalNumber,
  requiredDurationInSeconds: optionalNumber,
});

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const userId = args.params.id;
  const courseId = args.params.courseId;
  invariant(userId, "User not found.");
  invariant(courseId, "Course not found.");

  // Load user and course data
  const [lessons, quizzes, lessonProgress, quizProgress] = await Promise.all([
    LessonService.getAllFromCMS(),
    QuizService.getAll(),
    ProgressService.getAll(userId),
    QuizService.getAllQuizProgress(userId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!lessons || !quizzes) {
    throw Responses.notFound();
  }

  return { lessons, quizzes, lessonProgress, quizProgress };
}

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const userId = args.params.id;
  invariant(userId, "User ID not found.");
  const result = await parseFormData(args.request, schema);

  if (result.error) {
    return Toasts.dataWithError(null, { message: "Error", description: "Error completing course." });
  }

  const { _action, durationInSeconds, lessonId, requiredDurationInSeconds, quizId, score, passingScore } = result.data;

  switch (_action) {
    case "reset-all-progress": {
      // Reset all progress for this user in this course
      await ProgressService.resetAll(userId);
      await QuizService.resetAllQuizProgress(userId);
      return Toasts.dataWithSuccess(null, { message: "Success", description: "All progress has been reset." });
    }

    case "reset-lesson": {
      if (!lessonId) {
        return Toasts.dataWithError(null, {
          message: "Error",
          description: "A lesson ID was not found with this request.",
        });
      }
      // Reset progress for this lesson
      await ProgressService.resetLesson(lessonId, userId);
      return Toasts.dataWithSuccess(null, { message: "Success", description: "Lesson progress has been reset." });
    }

    case "complete-lesson": {
      if (!lessonId || !requiredDurationInSeconds) {
        return Toasts.dataWithError(null, {
          message: "Error",
          description: "A lesson ID or required duration was not found with this request.",
        });
      }
      await ProgressService.markComplete({ userId, lessonId, requiredDurationInSeconds });
      return Toasts.dataWithSuccess(null, { message: "Success", description: "Lesson has been marked complete." });
    }

    case "update-lesson": {
      if (!lessonId || !durationInSeconds || !requiredDurationInSeconds) {
        return Toasts.dataWithError(null, {
          message: "Error",
          description: "A lesson ID or duration was not found with this request.",
        });
      }
      // Update progress for this lesson
      await ProgressService.updateProgress({ lessonId, userId, durationInSeconds, requiredDurationInSeconds });
      return Toasts.dataWithSuccess(null, { message: "Success", description: "Lesson progress has been updated." });
    }

    case "reset-quiz": {
      if (!quizId) {
        return Toasts.dataWithError(null, {
          message: "Error",
          description: "A quiz ID was not found with this request.",
        });
      }
      await QuizService.resetQuizProgress(quizId, userId);
      return Toasts.dataWithSuccess(null, { message: "Success", description: "Quiz progress has been reset." });
    }

    case "update-quiz": {
      if (!quizId || typeof score === "undefined" || typeof passingScore === "undefined") {
        return Toasts.dataWithError(null, {
          message: "Error",
          description: "A quiz ID or score was not found with this request.",
        });
      }
      await QuizService.updateQuizProgress({ quizId, userId, score: score, passingScore: passingScore });
      return Toasts.dataWithSuccess(null, { message: "Success", description: "Quiz has been marked complete." });
    }

    default:
      return Toasts.dataWithError(null, { message: "Error", description: "Invalid action requested." });
  }
}

export default function AdminUserCourse() {
  const { lessons, lessonProgress, quizzes, quizProgress } = useLoaderData<typeof loader>();
  const isTimed = lessons.data.some((l) => l.attributes.required_duration_in_seconds);

  return (
    <>
      <title>User Course Progress</title>
      <div className="mb-4 flex gap-1.5">
        <ResetAllProgressDialog />
        {/* <CompleteCourseDialog /> */}
      </div>

      <p className="mb-4 max-w-screen-lg text-sm font-normal">
        Because of the complexity of locking and unlocking lessons as the course progresses, it is highly recommended to
        adjust entire sections. If that doesn&apos;t satisfy your use case, avoid having out of order lessons completed.
      </p>

      <LessonProgressHeader />
      <ul className="mb-8 divide-y divide-border/75">
        {lessons.data.map((l) => {
          const progress = lessonProgress.find((lp) => lp.lessonId === l.id);

          return (
            <li key={l.attributes.uuid} className="items-center py-3 md:grid md:grid-cols-12 md:py-2">
              {/* Mobile */}
              <div className="mb-2 flex items-center gap-4 md:hidden">
                <div className="col-span-1">
                  {!progress ? (
                    <IconCircleDashed className="size-6 text-muted-foreground" />
                  ) : !progress.isCompleted ? (
                    <IconCircleDashedCheck className="size-6 text-muted-foreground" />
                  ) : (
                    <IconCircleCheckFilled className="size-6 text-success" />
                  )}
                </div>
                <h3 className="col-span-2 text-sm font-normal">{l.attributes.title}</h3>
                {isTimed ? (
                  <p className="col-span-3 text-sm">
                    {formatSeconds(progress?.durationInSeconds ?? 0)} /{" "}
                    {formatSeconds(l.attributes.required_duration_in_seconds ?? 0)}
                  </p>
                ) : (
                  <p className="col-span-3 text-sm">Untimed</p>
                )}
              </div>

              {/* Desktop */}
              <div className="col-span-1 hidden md:block">
                {!progress ? (
                  <IconCircleDashed className="size-6 text-muted-foreground" />
                ) : !progress.isCompleted ? (
                  <IconCircleDashedCheck className="size-6 text-muted-foreground" />
                ) : (
                  <IconCircleCheckFilled className="size-6 text-success" />
                )}
              </div>
              <h3 className="col-span-2 hidden text-sm font-normal md:block">{l.attributes.title}</h3>
              {isTimed ? (
                <p className="col-span-3 hidden text-sm md:block">
                  {formatSeconds(progress?.durationInSeconds ?? 0)} /{" "}
                  {formatSeconds(l.attributes.required_duration_in_seconds ?? 0)}
                </p>
              ) : (
                <p className="col-span-3 text-sm">Untimed</p>
              )}
              <div className="col-span-6 flex flex-wrap items-center gap-1.5 md:flex-nowrap">
                <LessonResetForm lesson={l} progress={progress} />
                <LessonCompleteForm lesson={l} progress={progress} />
                {isTimed ? <LessonUpdateForm lesson={l} /> : null}
              </div>
            </li>
          );
        })}
      </ul>

      <QuizProgressHeader />
      <ul className="divide-y divide-border">
        {quizzes.data.map((q) => {
          const progress = quizProgress.find((qp) => qp.quizId === q.id);
          const passingScore = q.attributes.passing_score;

          return (
            <li key={q.attributes.uuid} className="items-center py-3 md:grid md:grid-cols-12 md:py-2">
              {/* Mobile */}
              <div className="mb-2 flex items-center gap-4 md:hidden">
                <div className="col-span-1">
                  {!progress ? (
                    <IconCircleDashed className="size-6 text-muted-foreground" />
                  ) : progress.score && progress.score < passingScore ? (
                    <IconCircleXFilled className="size-6 text-destructive" />
                  ) : (
                    <IconCircleCheckFilled className="size-6 text-success" />
                  )}
                </div>
                <h3 className="col-span-2 text-sm font-normal">{q.attributes.title}</h3>
                <p className="col-span-3 text-sm">
                  {progress?.score ? `${progress.score}%` : "-"} / {q.attributes.passing_score}%
                </p>
              </div>

              {/* Desktop */}
              <div className="col-span-1 hidden md:block">
                {!progress ? (
                  <IconCircleDashed className="size-6 text-muted-foreground" />
                ) : progress.score && progress.score < passingScore ? (
                  <IconCircleXFilled className="size-6 text-destructive" />
                ) : (
                  <IconCircleCheckFilled className="size-6 text-success" />
                )}
              </div>
              <h3 className="col-span-2 hidden text-sm font-normal md:block">{q.attributes.title}</h3>
              <p className="col-span-3 hidden text-sm md:block">
                {progress?.score ? `${progress.score}%` : "-"} / {q.attributes.passing_score}%
              </p>
              <div className="col-span-6 flex items-center gap-1.5">
                <QuizResetForm quiz={q} hasProgress={Boolean(progress)} />
                <QuizUpdateForm quiz={q} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
