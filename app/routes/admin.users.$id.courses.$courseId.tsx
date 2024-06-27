import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { MetaFunction, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { AdminButton } from "~/components/ui/admin-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { db } from "~/integrations/db.server";
import { toast } from "~/lib/toast.server";
import { cn, formatSeconds } from "~/lib/utils";
import { getLessons } from "~/models/lesson.server";
import { getQuizzes } from "~/models/quiz.server";
import { SessionService } from "~/services/SessionService.server";

const schema = z.object({
  _action: z.enum(["reset-all-progress", "reset-lesson", "complete-lesson", "update-lesson"]),
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
      { message: "Invalid form data.", errors: result.error.issues },
      { type: "error", title: "Error", description: `Invalid form data: ${fromZodError(result.error).toString()}` },
    );
  }

  const { _action, durationInSeconds, lessonId, requiredDurationInSeconds } = result.data;

  if (_action === "update-lesson" && !durationInSeconds) {
    return validationError({
      fieldErrors: {
        durationInSeconds: "Duration is required",
      },
    });
  }

  switch (_action) {
    case "reset-all-progress": {
      // Reset all progress for this user in this course
      await db.userLessonProgress.deleteMany({ where: { userId } });
      await db.userQuizProgress.deleteMany({ where: { userId } });
      return toast.json(
        request,
        { message: "All progress reset." },
        { type: "success", title: "Success", description: "All progress has been reset." },
      );
    }

    case "reset-lesson": {
      if (!lessonId) {
        return toast.json(
          request,
          { message: "Lesson ID is required." },
          { type: "error", title: "Error", description: "A lesson ID was not found with this request" },
        );
      }
      // Reset progress for this lesson
      await db.userLessonProgress.deleteMany({ where: { userId, lessonId } });
      return toast.json(
        request,
        { message: "Lesson progress reset." },
        { type: "success", title: "Success", description: "Lesson progress has been reset." },
      );
    }

    case "complete-lesson": {
      if (!lessonId || !requiredDurationInSeconds) {
        return toast.json(
          request,
          { message: "Lesson ID is required." },
          {
            type: "error",
            title: "Error",
            description: "A lesson ID or required duration was not found with this request",
          },
        );
      }
      // Complete this lesson
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
        { message: "Lesson completed." },
        { type: "success", title: "Success", description: "Lesson has been marked as completed." },
      );
    }

    case "update-lesson": {
      if (!lessonId || !durationInSeconds || !requiredDurationInSeconds) {
        return toast.json(
          request,
          { message: "Lesson ID is required." },
          { type: "error", title: "Error", description: "A lesson ID or duration was not found with this request" },
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
        },
      });
      return toast.json(
        request,
        { message: "Lesson progress updated." },
        { type: "success", title: "Success", description: "Lesson progress has been updated." },
      );
    }

    default:
      return toast.json(
        request,
        { message: "Invalid action." },
        { type: "error", title: "Error", description: "Invalid action requested." },
      );
  }
}

export const meta: MetaFunction = () => {
  return [{ title: "User Course Progress" }];
};

export default function AdminUserCourse() {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const { lessons, lessonProgress } = useLoaderData<typeof loader>();
  const [resetProgressModalOpen, setResetProgressModalOpen] = useState(false);

  return (
    <>
      <Dialog open={resetProgressModalOpen} onOpenChange={setResetProgressModalOpen}>
        <DialogTrigger asChild>
          <AdminButton variant="destructive">Reset All Progress</AdminButton>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will reset all progress for this user in this course. This action is not reversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="secondary" onClick={() => setResetProgressModalOpen(false)}>
              Cancel
            </AdminButton>
            <fetcher.Form id="reset-progress-form" method="post">
              <AdminButton
                onClick={() => setResetProgressModalOpen(false)}
                variant="destructive"
                type="submit"
                name="_action"
                value="reset-all-progress"
              >
                Reset Progress
              </AdminButton>
            </fetcher.Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <h2 className="mb-2 mt-4 text-xl">Lessons</h2>
      <div className="grid grid-cols-12 items-center text-left text-muted-foreground">
        <p className="col-span-2 text-sm">Title</p>
        <p className="col-span-2 text-sm">Duration</p>
        <p className="col-span-2 text-sm">Progress</p>
        <p className="col-span-6 text-sm">Actions</p>
      </div>
      <ul className="divide-y divide-border">
        {lessons.data.map((l) => {
          const progress = lessonProgress.find((lp) => lp.lessonId === l.id);

          return (
            <li key={l.attributes.uuid} className="grid grid-cols-12 items-center py-2">
              <h3 className="col-span-2 text-sm font-normal">{l.attributes.title}</h3>
              <p className={cn("col-span-2 text-sm", progress?.isCompleted ? "text-success" : "text-foreground")}>
                {formatSeconds(l.attributes.required_duration_in_seconds ?? 0)}
              </p>
              <p className={cn("col-span-2 text-sm", progress?.isCompleted ? "text-success" : "text-foreground")}>
                {formatSeconds(progress?.durationInSeconds ?? 0)}
              </p>
              <div className="col-span-6 flex items-center gap-1.5">
                <fetcher.Form method="post" className="flex items-center gap-1.5">
                  <input type="hidden" name="lessonId" value={l.id} />
                  <input
                    type="hidden"
                    name="requiredDurationInSeconds"
                    value={l.attributes.required_duration_in_seconds}
                  />
                  <AdminButton
                    variant="secondary"
                    type="submit"
                    name="_action"
                    value="reset-lesson"
                    disabled={progress?.durationInSeconds === 0 || isSubmitting}
                  >
                    Reset
                  </AdminButton>
                  <AdminButton
                    variant="secondary"
                    type="submit"
                    name="_action"
                    value="complete-lesson"
                    disabled={progress?.isCompleted || isSubmitting}
                    className="hover:bg-primary hover:text-white dark:hover:text-black"
                  >
                    Complete
                  </AdminButton>
                </fetcher.Form>
                <fetcher.Form method="post" className="flex items-center gap-1.5">
                  <input type="hidden" name="lessonId" value={l.id} />
                  <input
                    type="hidden"
                    name="requiredDurationInSeconds"
                    value={l.attributes.required_duration_in_seconds}
                  />
                  <Input name="durationInSeconds" placeholder="Seconds" pattern="[0-9]*" />
                  <AdminButton
                    variant="secondary"
                    type="submit"
                    name="_action"
                    value="update-lesson"
                    disabled={isSubmitting}
                  >
                    Set Progress
                  </AdminButton>
                </fetcher.Form>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
