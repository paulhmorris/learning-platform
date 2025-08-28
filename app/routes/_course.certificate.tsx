import { ActionFunctionArgs, Form, Link, LoaderFunctionArgs, useActionData, useLoaderData } from "react-router";

import { claimCertificateJob } from "jobs/claim-certificate";
import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { SubmitButton } from "~/components/ui/submit-button";
import { useCourseData } from "~/hooks/useCourseData";
import { useProgress } from "~/hooks/useProgress";
import { useUser } from "~/hooks/useUser";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { getLessonsInOrder } from "~/lib/utils";
import { SessionService } from "~/services/session.server";
import { APIResponseData } from "~/types/utils";

const logger = createLogger("Routes.CourseCertificate");

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const { host } = new URL(args.request.url);
  const linkedCourse = await db.course.findUnique({ where: { host } });

  if (!linkedCourse) {
    logger.error("Course not found", { host });
    return Toasts.redirectWithError("/preview", {
      message: "Error claiming certificate",
      description: "Please try again later.",
    });
  }

  const userCourse = await db.userCourses.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: linkedCourse.id } },
    select: {
      certificateClaimed: true,
      certificateS3Key: true,
      isCompleted: true,
      completedAt: true,
    },
  });

  if (!userCourse) {
    logger.warn("User does not have access to course", { userId: user.id, courseId: linkedCourse.id });
    Sentry.captureMessage("User tried to claim certificate without having access to course", {
      extra: {
        user: { id: user.id, email: user.email },
        course: { id: linkedCourse.id },
      },
      level: "warning",
    });
    return Toasts.redirectWithError("/preview", {
      message: "No access to course",
      description: "Please purchase the course to access it.",
    });
  }

  return { userCourse, course: linkedCourse };
}

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);

  try {
    // Verify user has access to the course
    const { host } = new URL(args.request.url);
    const linkedCourse = await db.course.findUnique({ where: { host } });

    if (!linkedCourse) {
      logger.error("Course not found", { host });
      return Toasts.redirectWithError("/preview", {
        message: "Error claiming certificate",
        description: "Please try again later.",
      });
    }

    const userHasAccess = user.courses.some((c) => c.courseId === linkedCourse.id);
    if (!userHasAccess) {
      logger.warn("User tried to claim certificate without access to course", {
        userId: user.id,
        courseId: linkedCourse.id,
      });
      return Toasts.redirectWithError("/preview", {
        message: "No access to course",
        description: "Please purchase the course to access it.",
      });
    }

    // Verify all lessons and quizzes are completed
    const [course, progress, quizProgress] = await Promise.all([
      cms.findOne<APIResponseData<"api::course.course">>("courses", linkedCourse.strapiId, {
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
      }),
      db.userLessonProgress.findMany({ where: { userId: user.id } }),
      db.userQuizProgress.findMany({ where: { userId: user.id } }),
    ]);

    const allLessonIds = course.data.attributes.sections
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      .flatMap((s) => s.lessons?.data?.map((l) => l.id))
      .filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const allQuizIds = course.data.attributes.sections.flatMap((s) => s.quiz?.data?.id).filter(Boolean);

    const allLessonProgress = progress.map((p) => p.lessonId);
    const allQuizProgress = quizProgress.map((p) => p.quizId);

    const allLessonsCompleted = allLessonIds.every((id) => allLessonProgress.includes(id));
    const allQuizzesCompleted = allQuizIds.every((id) => allQuizProgress.includes(id));

    if (!allLessonsCompleted || !allQuizzesCompleted) {
      logger.warn("User tried to claim certificate without completing all lessons and quizzes", {
        userId: user.id,
        courseId: linkedCourse.id,
      });
      Sentry.captureMessage("User tried to claim certificate without completing all lessons and quizzes", {
        extra: {
          user: { id: user.id, email: user.email },
          course: { id: linkedCourse.id, title: course.data.attributes.title },
        },
        level: "warning",
      });
      return Toasts.redirectWithError("/preview", {
        message: "Incomplete course",
        description: "Please complete all lessons and quizzes to claim your certificate.",
      });
    }

    const job = await claimCertificateJob.trigger({
      userId: user.id,
      courseId: linkedCourse.id,
      courseName: course.data.attributes.title,
    });

    if (!job.id) {
      logger.error("Failed to initiate certificate generation job", {
        userId: user.id,
        courseId: linkedCourse.id,
      });
      throw new Error("Failed to initiate certificate generation job.");
    }

    logger.info("Certificate claim job initiated", {
      userId: user.id,
      courseId: linkedCourse.id,
      jobId: job.id,
    });

    logger.info("Certificate successfully claimed", { userId: user.id, courseId: linkedCourse.id });
    return Toasts.dataWithSuccess(
      { success: true },
      {
        message: "Certificate claimed!",
        description: "Your certificate will be emailed to you shortly.",
        duration: 20_000,
      },
    );
  } catch (error) {
    logger.error("Error claiming certificate", { userId: user.id });
    Sentry.captureException(error);
    return Toasts.redirectWithError("/preview", {
      message: "Error claiming certificate",
      description: "Please try again later",
    });
  }
}

export default function CourseCertificate() {
  const { lessonProgress, quizProgress } = useProgress();
  const { course: cmsCourse } = useCourseData();
  const { userCourse, course } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const data = useCourseData();
  const user = useUser();

  const lessons = getLessonsInOrder({ course: cmsCourse, progress: lessonProgress });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <>
      <title>{`Certificate | ${cmsCourse.attributes.title}`}</title>
      <PageTitle>Certificate</PageTitle>
      <div className="mt-8">{children}</div>
    </>
  );

  const userHasVerifiedIdentity = course.requiresIdentityVerification ? user.isIdentityVerified : true;

  const isCourseComplete =
    lessons.every((l) => l.isCompleted) &&
    cmsCourse.attributes.sections.every((s) => {
      return !s.quiz?.data || quizProgress.find((p) => p.quizId === s.quiz?.data.id)?.isCompleted;
    });

  if (!isCourseComplete) {
    return (
      <Wrapper>
        <ErrorText>You must complete all lessons and quizzes before you can claim your certificate.</ErrorText>
      </Wrapper>
    );
  }

  if (!userHasVerifiedIdentity) {
    return (
      <Wrapper>
        <ErrorText>
          <span>You must verify your identity before you can claim your certificate for this course. </span>
          <Link to="/account/identity" className="mt-2 block text-lg font-bold underline decoration-2">
            Verify Now
          </Link>
        </ErrorText>
      </Wrapper>
    );
  }

  if (userCourse.certificateClaimed && userCourse.certificateS3Key) {
    return (
      <Wrapper>
        <SuccessText>
          You have claimed your certificate.{" "}
          <a
            className="mt-2 block text-lg font-bold underline decoration-2"
            target="_blank"
            rel="noreferrer"
            href={`https://assets.hiphopdriving.com/${userCourse.certificateS3Key}`}
          >
            Access it here.
          </a>
        </SuccessText>
      </Wrapper>
    );
  }

  if (actionData?.success) {
    return (
      <Wrapper>
        <SuccessText>
          Thank you! Your certificate will be emailed to <span className="font-bold">{user.email}</span> shortly.
        </SuccessText>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <SuccessText>
        Congratulations on successfully completing <span className="font-bold">{data.course.attributes.title}</span>!
        <br />
        <br />
        Click the button below to claim your certificate. It will be emailed to{" "}
        <span className="font-bold">{user.email}</span>.
      </SuccessText>
      <Form className="mt-8" method="post">
        <SubmitButton className="sm:w-auto">Claim Certificate</SubmitButton>
      </Form>
    </Wrapper>
  );
}

function SuccessText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-success bg-success/5 p-4 text-success">{children}</p>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-destructive bg-destructive/5 p-4 text-destructive">{children}</p>;
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
