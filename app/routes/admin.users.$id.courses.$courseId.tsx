import { MetaFunction, useLoaderData } from "@remix-run/react";
import { IconCircle, IconCircleCheckFilled, IconCircleDashedCheck, IconCircleXFilled } from "@tabler/icons-react";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@vercel/remix";
import invariant from "tiny-invariant";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { LessonCompleteForm } from "~/components/admin/courses/lesson-complete-form";
import { LessonProgressHeader } from "~/components/admin/courses/lesson-progress-header";
import { LessonResetForm } from "~/components/admin/courses/lesson-reset-form";
import { LessonUpdateForm } from "~/components/admin/courses/lesson-update-form";
import { QuizProgressHeader } from "~/components/admin/courses/quiz-progress-header";
import { QuizResetForm } from "~/components/admin/courses/quiz-reset-form";
import { QuizUpdateForm } from "~/components/admin/courses/quiz-update-form";
import { ResetAllProgressDialog } from "~/components/admin/courses/reset-all-progress-dialog";
import { Toasts } from "~/lib/toast.server";
import { formatSeconds } from "~/lib/utils";
import {
  getAllLessonProgress,
  getLessons,
  markLessonComplete,
  resetAllLessonProgress,
  resetLessonProgress,
  updateLessonProgress,
} from "~/models/lesson.server";
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
  quizId: z.coerce.number().optional(),
  score: z.coerce.number().optional(),
  passingScore: z.coerce.number().optional(),
  lessonId: z.coerce.number().optional(),
  durationInSeconds: z.coerce.number().optional(),
  requiredDurationInSeconds: z.coerce.number().optional(),
});

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const userId = params.id;
  const courseId = params.courseId;
  invariant(userId, "User not found.");
  invariant(courseId, "Course not found.");

  // Load user and course data
  const [lessons, quizzes, lessonProgress, quizProgress] = await Promise.all([
    getLessons(),
    QuizService.getAll(),
    getAllLessonProgress(userId),
    QuizService.getAllQuizProgress(userId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!lessons || !quizzes) {
    throw new Error("Failed to load cms data.");
  }

  return json({ lessons, quizzes, lessonProgress, quizProgress });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const userId = params.id;
  invariant(userId, "User ID not found.");
  const result = schema.safeParse(Object.fromEntries(await request.formData()));

  if (!result.success) {
    return Toasts.jsonWithError(
      { ok: false, message: "Invalid form data.", errors: result.error.issues },
      { title: "Error", description: `Invalid form data: ${fromZodError(result.error).toString()}` },
    );
  }

  const { _action, durationInSeconds, lessonId, requiredDurationInSeconds, quizId, score, passingScore } = result.data;

  switch (_action) {
    case "reset-all-progress": {
      // Reset all progress for this user in this course
      await resetAllLessonProgress(userId);
      await QuizService.resetAllQuizProgress(userId);
      return Toasts.jsonWithSuccess(
        { ok: true, message: "All progress reset." },
        { title: "Success", description: "All progress has been reset." },
      );
    }

    case "reset-lesson": {
      if (!lessonId) {
        return Toasts.jsonWithError(
          { ok: false, message: "Lesson ID is required." },
          { title: "Error", description: "A lesson ID was not found with this request." },
        );
      }
      // Reset progress for this lesson
      await resetLessonProgress(lessonId, userId);
      return Toasts.jsonWithSuccess(
        { ok: true, message: "Lesson progress reset." },
        { title: "Success", description: "Lesson progress has been reset." },
      );
    }

    case "complete-lesson": {
      if (!lessonId || !requiredDurationInSeconds) {
        return Toasts.jsonWithError(
          { ok: false, message: "Lesson ID is required." },
          { title: "Error", description: "A lesson ID or required duration was not found with this request." },
        );
      }
      await markLessonComplete({ userId, lessonId, requiredDurationInSeconds });
      return Toasts.jsonWithSuccess(
        { ok: true, message: "Lesson completed." },
        { title: "Success", description: "Lesson has been marked complete." },
      );
    }

    case "update-lesson": {
      if (!lessonId || !durationInSeconds || !requiredDurationInSeconds) {
        return Toasts.jsonWithError(
          { ok: false, message: "Lesson ID is required." },
          { title: "Error", description: "A lesson ID or duration was not found with this request." },
        );
      }
      // Update progress for this lesson
      await updateLessonProgress({ lessonId, userId, durationInSeconds, requiredDurationInSeconds });
      return Toasts.jsonWithSuccess(
        { ok: true, message: "Lesson progress updated." },
        { title: "Success", description: "Lesson progress has been updated." },
      );
    }

    case "reset-quiz": {
      if (!quizId) {
        return Toasts.jsonWithError(
          { ok: false, message: "Quiz ID is required." },
          { title: "Error", description: "A quiz ID was not found with this request." },
        );
      }
      await QuizService.resetQuizProgress(quizId, userId);
      return Toasts.jsonWithSuccess(
        { ok: true, message: "Quiz progress reset." },
        { title: "Success", description: "Quiz progress has been reset." },
      );
    }

    case "update-quiz": {
      if (!quizId || typeof score === "undefined" || typeof passingScore === "undefined") {
        return Toasts.jsonWithError(
          { ok: false, message: "Quiz ID and Score are required." },
          { title: "Error", description: "A quiz ID or score was not found with this request." },
        );
      }
      await QuizService.updateQuizProgress({ quizId, userId, score: score, passingScore: passingScore });
      return Toasts.jsonWithSuccess(
        { ok: true, message: "Quiz completed." },
        { title: "Success", description: "Quiz has been marked complete." },
      );
    }

    default:
      return Toasts.jsonWithError(
        { ok: false, message: "Invalid action." },
        { title: "Error", description: "Invalid action requested." },
      );
  }
}

export const meta: MetaFunction = () => {
  return [{ title: "User Course Progress" }];
};

export default function AdminUserCourse() {
  const { lessons, lessonProgress, quizzes, quizProgress } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="mb-4 flex gap-1.5">
        <ResetAllProgressDialog />
        {/* <CompleteCourseDialog /> */}
      </div>

      <p className="mb-4 max-w-screen-lg text-sm text-muted-foreground">
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
                    <IconCircle className="size-6 text-foreground" />
                  ) : !progress.isCompleted ? (
                    <IconCircleDashedCheck className="size-6 text-foreground" />
                  ) : (
                    <IconCircleCheckFilled className="size-6 text-success" />
                  )}
                </div>
                <h3 className="col-span-2 text-sm font-normal">{l.attributes.title}</h3>
                <p className="col-span-3 text-sm">
                  {formatSeconds(progress?.durationInSeconds ?? 0)} /{" "}
                  {formatSeconds(l.attributes.required_duration_in_seconds ?? 0)}
                </p>
              </div>

              {/* Desktop */}
              <div className="col-span-1 hidden md:block">
                {!progress ? (
                  <IconCircle className="size-6 text-foreground" />
                ) : !progress.isCompleted ? (
                  <IconCircleDashedCheck className="size-6 text-foreground" />
                ) : (
                  <IconCircleCheckFilled className="size-6 text-success" />
                )}
              </div>
              <h3 className="col-span-2 hidden text-sm font-normal md:block">{l.attributes.title}</h3>
              <p className="col-span-3 hidden text-sm md:block">
                {formatSeconds(progress?.durationInSeconds ?? 0)} /{" "}
                {formatSeconds(l.attributes.required_duration_in_seconds ?? 0)}
              </p>
              <div className="col-span-6 flex flex-wrap items-center gap-1.5 md:flex-nowrap">
                <LessonResetForm lesson={l} progress={progress} />
                <LessonCompleteForm lesson={l} progress={progress} />
                <LessonUpdateForm lesson={l} />
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
                    <IconCircle className="size-6 text-foreground" />
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
                  <IconCircle className="size-6 text-foreground" />
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
