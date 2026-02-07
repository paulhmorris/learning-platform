import { parseFormData, validationError } from "@rvf/react-router";
import { useEffect, useRef } from "react";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, useActionData, useLoaderData } from "react-router";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import {
  HiphopDrivingPreCertificateForm,
  hipHopDrivingCertificationSchema,
} from "~/components/pre-certificate-forms/hiphopdriving";
import { SubmitButton } from "~/components/ui/submit-button";
import { useCourseData } from "~/hooks/useCourseData";
import { useProgress } from "~/hooks/useProgress";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Analytics } from "~/integrations/mixpanel.client";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getLessonsInOrder } from "~/lib/utils";
import { CourseService } from "~/services/course.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";
import { UserCourseService } from "~/services/user-course.server";
import { APIResponseData } from "~/types/utils";

import { claimCertificateJob } from "../../jobs/claim-certificate";

// BUSINESS LOGIC
type UserProfileData = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

const courseSpecificForms = [
  {
    // Hiphop Driving
    courseId: 1,
    render: (userProfile: UserProfileData) => <HiphopDrivingPreCertificateForm userProfile={userProfile} />,
    schema: hipHopDrivingCertificationSchema,
  },
];
// END BUSINESS LOGIC

const logger = createLogger("Routes.CourseCertificate");

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const { host } = new URL(args.request.url);

  try {
    const linkedCourse = await CourseService.getByHost(host);

    if (!linkedCourse) {
      logger.error(`Course not found for host ${host}`);
      throw await Toasts.redirectWithError("/preview", {
        message: "Error claiming certificate",
        description: "Please try again later.",
      });
    }

    const userCourse = await UserCourseService.getByUserIdAndCourseIdWithCertificate(user.id, linkedCourse.id);

    if (!userCourse) {
      logger.warn(`User ${user.id} does not have access to course ${linkedCourse.id}`);
      Sentry.captureMessage("User tried to claim certificate without having access to course", {
        extra: {
          user: { id: user.id, email: user.email },
          course: { id: linkedCourse.id },
        },
        level: "warning",
      });
      throw await Toasts.redirectWithError("/preview", {
        message: "No access to course",
        description: "Please purchase the course to access it.",
      });
    }

    return {
      userCourse,
      course: linkedCourse,
      userProfile: {
        isIdentityVerified: user.isIdentityVerified,
        firstName: (user.firstName as string | null) ?? null,
        lastName: (user.lastName as string | null) ?? null,
        email: user.email,
        phone: user.phoneNumber ?? null,
      },
    };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw Responses.serverError();
  }
}

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);

  try {
    // Verify user has access to the course
    const { host } = new URL(args.request.url);
    const linkedCourse = await CourseService.getByHost(host);

    if (!linkedCourse) {
      logger.error(`Course not found for host ${host}`);
      return Toasts.redirectWithError("/preview", {
        message: "Error claiming certificate",
        description: "Please try again later.",
      });
    }

    // TODO: Clerk migration
    const userCourses = await UserCourseService.getAllByUserId(user.id);
    const userHasAccess = userCourses.some((c) => c.courseId === linkedCourse.id);
    if (!userHasAccess) {
      logger.warn(`User ${user.id} tried to claim certificate without access to course ${linkedCourse.id}`);
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
      // TODO: Clerk migration
      ProgressService.getAllLesson(user.id),
      ProgressService.getAllQuiz(user.id),
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
      logger.warn(
        `User ${user.id} tried to claim certificate for course ${linkedCourse.id} without completing all lessons and quizzes`,
      );
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

    const courseSpecificForm = courseSpecificForms.find((f) => f.courseId === course.data.id);
    if (courseSpecificForm) {
      const formData = await parseFormData(args.request, courseSpecificForm.schema);
      if (formData.error) {
        throw validationError(formData.error);
      }
      // TODO: Clerk migration
      const userCourses = await UserCourseService.getAllByUserId(user.id);
      await db.preCertificationFormSubmission.create({
        data: {
          userCourseId: userCourses.find((c) => c.courseId === linkedCourse.id)!.id,
          formData: formData.data,
        },
      });
    }

    const job = await claimCertificateJob.trigger({
      userId: user.id,
      courseId: linkedCourse.id,
      courseName: course.data.attributes.title,
    });

    if (!job.id) {
      logger.error(`Failed to initiate certificate generation job for user ${user.id} and course ${linkedCourse.id}`);
      throw new Error("Failed to initiate certificate generation job.");
    }

    logger.info(`Certificate claim job ${job.id} initiated for user ${user.id} and course ${linkedCourse.id}`);

    logger.info(`Certificate successfully claimed for user ${user.id} and course ${linkedCourse.id}`);
    return Toasts.dataWithSuccess(
      { success: true },
      {
        message: "Certificate claimed!",
        description: "Your certificate will be emailed to you shortly.",
        duration: 20_000,
      },
    );
  } catch (error) {
    logger.error(`Error claiming certificate for user ${user.id}`, { error });
    Sentry.captureException(error);
    return Toasts.dataWithError(null, {
      message: "Error claiming certificate",
      description: "Please try again later",
    });
  }
}

export default function CourseCertificate() {
  const { lessonProgress, quizProgress, isLoading } = useProgress();
  const { course: cmsCourse } = useCourseData();
  const { userCourse, course, userProfile } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const data = useCourseData();
  const trackedBlockedRef = useRef(false);
  const trackedClaimedRef = useRef(false);

  const lessons = getLessonsInOrder({ course: cmsCourse, progress: lessonProgress });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <>
      <title>{`Certificate | ${cmsCourse.attributes.title}`}</title>
      <PageTitle>Certificate</PageTitle>
      <div className="mt-8">{children}</div>
    </>
  );

  const userHasVerifiedIdentity = course.requiresIdentityVerification ? userProfile.isIdentityVerified : true;

  const isCourseComplete =
    lessons.every((l) => l.isCompleted) &&
    cmsCourse.attributes.sections.every((s) => {
      return !s.quiz?.data || quizProgress.find((p) => p.quizId === s.quiz?.data.id)?.isCompleted;
    });

  useEffect(() => {
    if (trackedBlockedRef.current) return;
    if (!isCourseComplete) {
      trackedBlockedRef.current = true;
      void Analytics.trackEvent("certificate_claim_blocked", {
        course_id: course.id,
        course_title: cmsCourse.attributes.title,
        reason: "incomplete_course",
      });
      return;
    }

    if (!userHasVerifiedIdentity) {
      trackedBlockedRef.current = true;
      void Analytics.trackEvent("certificate_claim_blocked", {
        course_id: course.id,
        course_title: cmsCourse.attributes.title,
        reason: "identity_verification_required",
      });
    }
  }, [course.id, cmsCourse.attributes.title, isCourseComplete, userHasVerifiedIdentity]);

  useEffect(() => {
    if (trackedClaimedRef.current) return;
    if (userCourse.certificate || actionData?.success) {
      trackedClaimedRef.current = true;
      void Analytics.trackEvent("certificate_claim_success", {
        course_id: course.id,
        course_title: cmsCourse.attributes.title,
      });
    }
  }, [actionData?.success, course.id, cmsCourse.attributes.title, userCourse.certificate]);

  if (isLoading) {
    return null;
  }

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

  if (userCourse.certificate) {
    return (
      <Wrapper>
        <SuccessText>
          You have claimed your certificate.{" "}
          <a
            className="mt-2 block text-lg font-bold underline decoration-2"
            target="_blank"
            rel="noreferrer"
            href={`https://assets.hiphopdriving.com/${userCourse.certificate.s3Key}`}
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
          Thank you! Your certificate will be emailed to <span className="font-bold">{userProfile.email}</span> shortly.
        </SuccessText>
      </Wrapper>
    );
  }

  const CourseSpecificForm = courseSpecificForms.find((f) => f.courseId === data.course.id)?.render(userProfile);

  return (
    <Wrapper>
      <SuccessText>
        Congratulations on successfully completing <span className="font-bold">{data.course.attributes.title}</span>!
      </SuccessText>
      <div className="mt-8">
        {CourseSpecificForm ?? (
          <form
            method="post"
            onSubmit={() =>
              void Analytics.trackEvent("certificate_claim_started", {
                course_id: course.id,
                course_title: cmsCourse.attributes.title,
              })
            }
          >
            <SubmitButton className="sm:w-auto">Claim Certificate</SubmitButton>
          </form>
        )}
      </div>
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
