import { useLoaderData } from "@remix-run/react";
import { IconCircle, IconCircleCheckFilled, IconCircleDashedCheck, IconCircleXFilled } from "@tabler/icons-react";
import { LessonCompleteForm } from "~/components/admin/courses/lesson-complete-form";
import { LessonResetForm } from "~/components/admin/courses/lesson-reset-form";
import { LessonUpdateForm } from "~/components/admin/courses/lesson-update-form";
import { QuizResetForm } from "~/components/admin/courses/quiz-reset-form";
import { QuizUpdateForm } from "~/components/admin/courses/quiz-update-form";
import { ResetAllProgressDialog } from "~/components/admin/courses/reset-all-progress-dialog";
import { formatSeconds } from "~/lib/utils";
import { loader } from "./admin.users.$id.courses.$courseId";

export default function AdminUserCourse() {
  const { lessons, lessonProgress, quizzes, quizProgress } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="flex gap-1.5">
        <ResetAllProgressDialog />
        {/* <CompleteCourseDialog /> */}
      </div>

      <h2 className="mb-2 mt-4 text-xl">Lessons</h2>
      <div className="grid grid-cols-12 items-center justify-between text-left text-muted-foreground">
        <p className="col-span-1 text-sm">Status</p>
        <p className="col-span-2 text-sm">Title</p>
        <p className="col-span-3 text-sm">Progress / Required Duration</p>
        <p className="col-span-6 text-sm">Actions</p>
      </div>
      <ul className="divide-y divide-border">
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

      <h2 className="mb-2 mt-8 text-xl">Quizzes</h2>
      <div className="grid grid-cols-12 items-center justify-between text-left text-muted-foreground">
        <p className="col-span-1 text-sm">Status</p>
        <p className="col-span-2 text-sm">Title</p>
        <p className="col-span-3 text-sm">Score / Passing Score</p>
        <p className="col-span-6 text-sm">Actions</p>
      </div>
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
