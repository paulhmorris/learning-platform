import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import { PageTitle } from "~/components/common/page-title";
import { Button } from "~/components/ui/button";
import { useCourseData } from "~/hooks/useCourseData";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData } from "~/types/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUser(request);
  return typedjson({});
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  try {
    // Verify user has access to the course
    const { host } = new URL(request.url);
    const linkedCourse = await db.course.findUnique({ where: { host } });

    if (!linkedCourse) {
      Sentry.captureMessage("Received request from unknown host", {
        extra: { host },
        level: "warning",
        user: { username: user.email, id: user.id, email: user.email },
      });
      return toast.redirect(request, "/preview", {
        type: "error",
        title: "Error claiming certificate",
        description: "Please try again later.",
        position: "bottom-center",
      });
    }

    const userHasAccess = user.courses.some((c) => c.courseId === linkedCourse.id);
    if (!userHasAccess) {
      return toast.redirect(request, "/preview", {
        type: "error",
        title: "No access to course",
        description: "Please purchase the course to access it.",
        position: "bottom-center",
      });
    }

    // Verify all lessons and quizzes are completed
    const course = await cms.findOne<APIResponseData<"api::course.course">>("courses", linkedCourse.strapiId, {
      fields: ["title"],
      populate: {
        sections: {
          fields: ["title"],
          populate: {
            quiz: {
              fields: ["title"],
            },
            lessons: {
              fields: ["title"],
            },
          },
        },
      },
    });

    const allLessonIds = course.data.attributes.sections
      .flatMap((s) => s.lessons?.data?.map((l) => l.id))
      .filter(Boolean);
    const allQuizIds = course.data.attributes.sections.flatMap((s) => s.quiz?.data?.id).filter(Boolean);

    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const quizProgress = await db.userQuizProgress.findMany({ where: { userId: user.id } });

    const allLessonProgress = progress.map((p) => p.lessonId);
    const allQuizProgress = quizProgress.map((p) => p.quizId);

    const allLessonsCompleted = allLessonIds.every((id) => allLessonProgress.includes(id));
    const allQuizzesCompleted = allQuizIds.every((id) => allQuizProgress.includes(id));

    if (allLessonsCompleted || allQuizzesCompleted) {
      Sentry.captureMessage("User tried to claim certificate without completing all lessons and quizzes", {
        extra: {
          user: { id: user.id, email: user.email },
          course: { id: linkedCourse.id, title: course.data.attributes.title },
        },
        level: "warning",
      });
      return toast.redirect(request, "/preview", {
        type: "error",
        title: "Incomplete course",
        description: "Please complete all lessons and quizzes to claim your certificate.",
        position: "bottom-center",
      });
    }

    return toast.redirect(request, "/preview", {
      type: "success",
      title: "Certificate claimed!",
      description: "Your certificate will be emailed to you shortly.",
      duration: 20_000,
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.redirect(request, "/preview", {
      type: "error",
      title: "Failed to load course",
      description: "Please try again later",
      position: "bottom-center",
    });
  }
}

export default function CourseCertificate() {
  const data = useCourseData();
  const user = useUser();

  const isCourseComplete =
    data.lessonsInOrder.every((l) => l.isCompleted) &&
    data.course.attributes.sections.every((s) => {
      return !s.quiz?.data || data.quizProgress.find((p) => p.quizId === s.quiz?.data.id)?.isCompleted;
    });

  if (isCourseComplete) {
    return (
      <>
        <PageTitle>Certificate</PageTitle>
        <p className="mt-8 rounded-md border-destructive bg-destructive/5 p-4 text-destructive dark:bg-destructive/15">
          You must complete all lessons and quizzes before you can claim your certificate.
        </p>
      </>
    );
  }

  return (
    <>
      <PageTitle>Certificate</PageTitle>
      <p className="mt-8 rounded-md border-success bg-success/5 p-4 text-success dark:bg-success/15">
        Congratulations on successfully completing <span className="font-bold">{data.course.attributes.title}</span>!
        <br />
        <br />
        Click the button below to claim your certificate. It will be emailed to{" "}
        <span className="font-bold">{user.email}</span> shortly.
      </p>
      <Form className="mt-8" method="post">
        <Button className="sm:w-auto">Claim Certificate</Button>
      </Form>
    </>
  );
}
