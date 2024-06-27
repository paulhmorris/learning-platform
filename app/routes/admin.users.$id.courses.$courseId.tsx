import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { MetaFunction, useLoaderData } from "@remix-run/react";
import { IconCircle, IconCircleCheckFilled, IconCircleDashedCheck, IconCircleXFilled } from "@tabler/icons-react";
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
import { db } from "~/integrations/db.server";
import { toast } from "~/lib/toast.server";
import { formatSeconds } from "~/lib/utils";
import { getLessons } from "~/models/lesson.server";
import { getQuizzes } from "~/models/quiz.server";
import { SessionService } from "~/services/SessionService.server";

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
  quizScore: z.coerce.number().optional(),
  quizPassingScore: z.coerce.number().optional(),
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
    getQuizzes(),
    db.userLessonProgress.findMany({ where: { userId } }),
    db.userQuizProgress.findMany({ where: { userId } }),
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
    return toast.json(
      request,
      { ok: false, message: "Invalid form data.", errors: result.error.issues },
      { type: "error", title: "Error", description: `Invalid form data: ${fromZodError(result.error).toString()}` },
    );
  }

  const { _action, durationInSeconds, lessonId, requiredDurationInSeconds, quizId, quizScore, quizPassingScore } =
    result.data;

  switch (_action) {
    case "reset-all-progress": {
      // Reset all progress for this user in this course
      await db.userLessonProgress.deleteMany({ where: { userId } });
      await db.userQuizProgress.deleteMany({ where: { userId } });
      return toast.json(
        request,
        { ok: true, message: "All progress reset." },
        { type: "success", title: "Success", description: "All progress has been reset." },
      );
    }

    case "reset-lesson": {
      if (!lessonId) {
        return toast.json(
          request,
          { ok: false, message: "Lesson ID is required." },
          { type: "error", title: "Error", description: "A lesson ID was not found with this request." },
        );
      }
      // Reset progress for this lesson
      await db.userLessonProgress.deleteMany({ where: { userId, lessonId } });
      return toast.json(
        request,
        { ok: true, message: "Lesson progress reset." },
        { type: "success", title: "Success", description: "Lesson progress has been reset." },
      );
    }

    case "complete-lesson": {
      if (!lessonId || !requiredDurationInSeconds) {
        return toast.json(
          request,
          { ok: false, message: "Lesson ID is required." },
          {
            type: "error",
            title: "Error",
            description: "A lesson ID or required duration was not found with this request.",
          },
        );
      }
      await db.userLessonProgress.upsert({
        where: {
          userId_lessonId: { userId, lessonId },
        },
        create: {
          userId,
          lessonId,
          isCompleted: true,
          durationInSeconds: requiredDurationInSeconds,
        },
        update: {
          isCompleted: true,
          durationInSeconds: requiredDurationInSeconds,
        },
      });
      return toast.json(
        request,
        { ok: true, message: "Lesson completed." },
        { type: "success", title: "Success", description: "Lesson has been marked complete." },
      );
    }

    case "update-lesson": {
      if (!lessonId || !durationInSeconds || !requiredDurationInSeconds) {
        return toast.json(
          request,
          { ok: false, message: "Lesson ID is required." },
          { type: "error", title: "Error", description: "A lesson ID or duration was not found with this request." },
        );
      }
      // Update progress for this lesson
      await db.userLessonProgress.upsert({
        where: {
          userId_lessonId: { userId, lessonId },
        },
        create: {
          userId,
          lessonId,
          isCompleted: durationInSeconds >= requiredDurationInSeconds,
          durationInSeconds,
        },
        update: {
          durationInSeconds,
          isCompleted: durationInSeconds >= requiredDurationInSeconds,
        },
      });
      return toast.json(
        request,
        { ok: true, message: "Lesson progress updated." },
        { type: "success", title: "Success", description: "Lesson progress has been updated." },
      );
    }

    case "reset-quiz": {
      if (!quizId) {
        return toast.json(
          request,
          { ok: false, message: "Quiz ID is required." },
          { type: "error", title: "Error", description: "A quiz ID was not found with this request." },
        );
      }
      await db.userQuizProgress.deleteMany({ where: { userId, quizId } });
      return toast.json(
        request,
        { ok: true, message: "Quiz progress reset." },
        { type: "success", title: "Success", description: "Quiz progress has been reset." },
      );
    }

    case "update-quiz": {
      if (!quizId || typeof quizScore === "undefined" || typeof quizPassingScore === "undefined") {
        return toast.json(
          request,
          { ok: false, message: "Quiz ID and Score are required." },
          { type: "error", title: "Error", description: "A quiz ID or score was not found with this request." },
        );
      }
      await db.userQuizProgress.upsert({
        where: {
          userId_quizId: { userId, quizId },
        },
        create: {
          userId,
          quizId,
          isCompleted: quizScore >= quizPassingScore,
          score: quizScore,
        },
        update: {
          isCompleted: quizScore >= quizPassingScore,
          score: quizScore,
        },
      });
      return toast.json(
        request,
        { ok: true, message: "Quiz completed." },
        { type: "success", title: "Success", description: "Quiz has been marked complete." },
      );
    }

    default:
      return toast.json(
        request,
        { ok: false, message: "Invalid action." },
        { type: "error", title: "Error", description: "Invalid action requested." },
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

      <LessonProgressHeader />
      <ul className="mb-8 divide-y divide-border">
        {lessons.data.map((l) => {
          const progress = lessonProgress.find((lp) => lp.lessonId === l.id);

          return (
            <li key={l.attributes.uuid} className="grid grid-cols-12 items-center py-2">
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
              <div className="col-span-6 flex items-center gap-1.5">
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
            <li key={q.attributes.uuid} className="grid grid-cols-12 items-center py-2">
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
