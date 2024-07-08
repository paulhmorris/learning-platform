import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, MetaFunction, useActionData, useLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm } from "remix-validated-form";
import { z } from "zod";

import { PageTitle } from "~/components/common/page-title";
import { SubmitButton } from "~/components/ui/submit-button";
import { useCourseData } from "~/hooks/useCourseData";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { claimCertificateJob } from "~/jobs/claim-certificate";
import { toast } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { loader as courseLoader } from "~/routes/_course";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData } from "~/types/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const { host } = new URL(request.url);
  const linkedCourse = await db.course.findUnique({ where: { host } });

  if (!linkedCourse) {
    return toast.redirect(request, "/preview", {
      type: "error",
      title: "Error claiming certificate",
      description: "Please try again later.",
      position: "bottom-center",
    });
  }

  const userCourse = await db.userCourses.findUniqueOrThrow({
    where: { userId_courseId: { userId: user.id, courseId: linkedCourse.id } },
    select: {
      certificateClaimed: true,
      certificateS3Key: true,
      isCompleted: true,
      completedAt: true,
    },
  });
  return json({ userCourse, course: linkedCourse });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  try {
    // Verify user has access to the course
    const { host } = new URL(request.url);
    const linkedCourse = await db.course.findUnique({ where: { host } });

    if (!linkedCourse) {
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      .flatMap((s) => s.lessons?.data?.map((l) => l.id))
      .filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const allQuizIds = course.data.attributes.sections.flatMap((s) => s.quiz?.data?.id).filter(Boolean);

    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const quizProgress = await db.userQuizProgress.findMany({ where: { userId: user.id } });

    const allLessonProgress = progress.map((p) => p.lessonId);
    const allQuizProgress = quizProgress.map((p) => p.quizId);

    const allLessonsCompleted = allLessonIds.every((id) => allLessonProgress.includes(id));
    const allQuizzesCompleted = allQuizIds.every((id) => allQuizProgress.includes(id));

    if (!allLessonsCompleted || !allQuizzesCompleted) {
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

    const job = await claimCertificateJob.trigger({
      userId: user.id,
      courseId: linkedCourse.id,
      courseName: course.data.attributes.title,
    });

    if (!job.id) {
      throw new Error("Failed to initiate certificate generation job.");
    }

    return toast.json(
      request,
      { success: true },
      {
        type: "success",
        title: "Certificate claimed!",
        description: "Your certificate will be emailed to you shortly.",
        duration: 20_000,
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.redirect(request, "/preview", {
      type: "error",
      title: "Error claiming certificate",
      description: "Please try again later",
      position: "bottom-center",
    });
  }
}

export const meta: MetaFunction<typeof loader, { "routes/_course": typeof courseLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "routes/_course")?.data.course;
  return [{ title: `Certificate | ${match?.attributes.title}` }];
};

export default function CourseCertificate() {
  const { userCourse, course } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const data = useCourseData();
  const user = useUser();

  const userHasVerifiedIdentity = course.requiresIdentityVerification ? user.isIdentityVerified : true;

  const isCourseComplete =
    data.lessonsInOrder.every((l) => l.isCompleted) &&
    data.course.attributes.sections.every((s) => {
      return !s.quiz?.data || data.quizProgress.find((p) => p.quizId === s.quiz?.data.id)?.isCompleted;
    });

  if (!isCourseComplete) {
    return (
      <>
        <PageTitle>Certificate</PageTitle>
        <p className="mt-8 rounded-md border border-destructive bg-destructive/5 p-4 text-destructive">
          You must complete all lessons and quizzes before you can claim your certificate.
        </p>
      </>
    );
  }

  if (!userHasVerifiedIdentity) {
    return (
      <>
        <PageTitle>Certificate</PageTitle>
        <div className="mt-8 rounded-md border border-destructive bg-destructive/5 p-4 text-destructive">
          <p>You must verify your identity before you can claim your certificate for this course. </p>
          <Link to="/profile" className="mt-2 block text-lg font-bold underline decoration-2">
            Verify Now
          </Link>
        </div>
      </>
    );
  }

  if (userCourse.certificateClaimed && userCourse.certificateS3Key) {
    return (
      <>
        <PageTitle>Certificate</PageTitle>
        <p className="mt-8 rounded-md border border-success bg-success/5 p-4 text-success">
          You have claimed your certificate.{" "}
          <a
            className="mt-2 block text-lg font-bold underline decoration-2"
            target="_blank"
            rel="noreferrer"
            href={`https://assets.hiphopdriving.com/${userCourse.certificateS3Key}`}
          >
            Access it here.
          </a>
        </p>
      </>
    );
  }

  if (actionData?.success) {
    return (
      <>
        <PageTitle>Certificate</PageTitle>
        <p className="mt-8 rounded-md border border-success bg-success/5 p-4 text-success">
          Thank you! Your certificate will be emailed to <span className="font-bold">{user.email}</span> shortly.
        </p>
      </>
    );
  }

  return (
    <>
      <PageTitle>Certificate</PageTitle>
      <p className="mt-8 rounded-md border border-success bg-success/5 p-4 text-success">
        Congratulations on successfully completing <span className="font-bold">{data.course.attributes.title}</span>!
        <br />
        <br />
        Click the button below to claim your certificate. It will be emailed to{" "}
        <span className="font-bold">{user.email}</span>.
      </p>
      <ValidatedForm validator={withZod(z.object({}))} className="mt-8" method="post">
        <SubmitButton className="sm:w-auto">Claim Certificate</SubmitButton>
      </ValidatedForm>
    </>
  );
}
