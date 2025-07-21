import { useEffect, useState } from "react";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, redirect, useLoaderData, useSearchParams } from "react-router";

import { StrapiImage } from "~/components/common/strapi-image";
import { CourseHeader } from "~/components/course/course-header";
import { CoursePurchaseCTA } from "~/components/course/course-purchase-cta";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { IconClipboard, IconDocument } from "~/components/icons";
import { CoursePreviewLink } from "~/components/preview/course-preview-link";
import { PreviewSectionLesson } from "~/components/preview/preview-section-lesson";
import { PreviewSectionQuiz } from "~/components/preview/preview-section-quiz";
import { PurchaseCanceledModal } from "~/components/purchase-canceled-modal";
import { PurchaseSuccessModal } from "~/components/purchase-success-modal";
import { Section, SectionHeader } from "~/components/section";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getCourse } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getLessonsInOrder, getPreviewValues } from "~/lib/utils";
import { PaymentService } from "~/services/payment.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);

  const url = new URL(args.request.url);
  const linkedCourse = await db.course.findUnique({ where: { host: url.host } });
  if (!linkedCourse) {
    throw Responses.notFound();
  }

  const [course, lessonProgress, quizProgress] = await Promise.all([
    getCourse(linkedCourse.strapiId),
    ProgressService.getAll(user.id),
    ProgressService.getAllQuiz(user.id),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const userHasAccess = user?.courses.some((c) => c.courseId === linkedCourse.id);
  const lessons = getLessonsInOrder({ course, progress: lessonProgress });

  return { course: course.data, lessonProgress, lessons, quizProgress, userHasAccess };
}
export type LessonInOrder = Awaited<ReturnType<typeof loader>>["lessons"][number];

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const url = new URL(args.request.url);
  const course = await db.course.findUnique({ where: { host: url.host } });

  if (!course) {
    return Toasts.redirectWithError("/", {
      message: "Course not found.",
      description: "Please try again later",
    });
  }

  if (!user.stripeId) {
    await PaymentService.createCustomer(user.id);
  }

  const session = await PaymentService.createCourseCheckoutSession(user.id, course.stripePriceId);
  return redirect(session.url ?? "/", { status: 303 });
}

export default function CoursePreview() {
  const [searchParams] = useSearchParams();
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [canceledModalOpen, setCanceledModalOpen] = useState(false);
  const { course, lessonProgress, lessons, quizProgress, userHasAccess } = useLoaderData<typeof loader>();

  const isSuccessful = searchParams.get("purchase_success") === "true";
  const isCanceled = searchParams.get("purchase_canceled") === "true";

  // handle success or cancel
  useEffect(() => {
    if (isSuccessful) {
      setSuccessModalOpen(true);
    } else if (isCanceled) {
      setCanceledModalOpen(true);
    }
  }, [isSuccessful, isCanceled]);

  const {
    nextQuiz,
    courseIsTimed,
    nextLessonIndex,
    isCourseCompleted,
    totalProgressInSeconds,
    totalDurationInSeconds,
    lastCompletedLessonIndex,
  } = getPreviewValues({ lessons, course, quizProgress, lessonProgress });

  // Timed Courses
  return (
    <>
      <title>{`Preview | ${course.attributes.title}`}</title>
      <div className="flex flex-col gap-x-12 px-4 py-4 lg:flex-row lg:py-4">
        <nav className="left-0 top-[88px] h-full shrink-0 basis-[320px] py-4 sm:py-10 lg:sticky lg:py-14">
          <StrapiImage
            asset={course.attributes.cover_image}
            height={240}
            width={448}
            fetchpriority="high"
            loading="eager"
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            alt={course.attributes.cover_image?.data?.attributes.alternativeText}
            className="w-full overflow-hidden rounded-xl object-cover shadow-[0px_8px_32px_0px_#00000029]"
          />
          <div className="mt-7">
            <CoursePreviewLink to=".">
              <IconClipboard className="text-current" />
              <span>Course Chapters</span>
            </CoursePreviewLink>

            <CoursePreviewLink to="/certificate">
              <IconDocument className="text-current" />
              <span>Certificate</span>
            </CoursePreviewLink>
          </div>
        </nav>

        <main className="max-w-screen-md lg:py-14">
          <div className="space-y-8">
            <CourseHeader courseTitle={course.attributes.title} numLessons={lessons.length || 0} />
            <CourseProgressBar
              progress={totalProgressInSeconds}
              duration={totalDurationInSeconds}
              isTimed={courseIsTimed}
            />
            {!userHasAccess ? (
              <CoursePurchaseCTA />
            ) : isCourseCompleted ? (
              <div className="text-center">
                <p className="rounded-md border border-success bg-success/5 p-4 text-lg text-success">
                  You have completed this course.
                </p>
              </div>
            ) : nextQuiz ? (
              <CourseUpNext quiz={{ id: nextQuiz.id, numQuestions: nextQuiz.attributes.questions?.length ?? 1 }} />
            ) : (
              <CourseUpNext lesson={lessons[nextLessonIndex]} />
            )}
          </div>

          <ul className="relative mt-10 space-y-7">
            {course.attributes.sections.map((section, section_index) => {
              if (!section.lessons?.data.length && !section.quiz?.data) {
                return null;
              }

              const durationInSeconds = section.lessons?.data.reduce(
                (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds ?? 0) + acc),
                0,
              );

              // This breaks with just a single quiz on it's own in a section, but that should never happen
              const isQuizLocked =
                !userHasAccess || lessons.filter((l) => l.sectionId === section.id).some((l) => !l.isCompleted);
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              const userQuizProgress = quizProgress.find((qp) => qp.quizId === section.quiz?.data?.id) ?? null;

              return (
                <li key={`section-${section.id}`}>
                  <Section>
                    <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds ?? 0) / 60} />
                    <Separator className="my-4" />
                    <ul className="flex flex-col gap-6">
                      {section.lessons?.data.map((l) => {
                        const lessonIndex = lessons.findIndex((li) => li.uuid === l.attributes.uuid);

                        // Lock the lesson if the previous section's quiz is not completed
                        const previousSection =
                          section_index > 0 ? course.attributes.sections[section_index - 1] : null;
                        const previousSectionQuiz = previousSection?.quiz;
                        const previousSectionQuizIsCompleted = quizProgress.find(
                          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                          (p) => p.isCompleted && p.quizId === previousSectionQuiz?.data?.id,
                        );

                        const previousLessonIsCompleted = lessons[lessonIndex - 1]?.isCompleted;

                        const isLessonLocked =
                          !userHasAccess || // User does not have access
                          (lessonIndex > 0 && !previousLessonIsCompleted) || // Previous lesson is not completed
                          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                          (previousSectionQuiz?.data && !previousSectionQuizIsCompleted) || // Previous section quiz is not completed
                          (!isCourseCompleted && lessonIndex > lastCompletedLessonIndex + 1); // Course is not completed and lesson index is greater than last completed lesson index + 1

                        const userLessonProgress = lessonProgress.find((lp) => lp.lessonId === l.id) ?? null;
                        return (
                          <div key={l.attributes.uuid} className="flex flex-wrap items-center justify-between gap-2">
                            <div className="shrink-0 grow">
                              <PreviewSectionLesson
                                lesson={l}
                                userProgress={userLessonProgress}
                                locked={isLessonLocked}
                              />
                            </div>
                            {!isLessonLocked ? (
                              <Button asChild className="ml-12 grow-0 sm:ml-0 sm:w-auto" variant="secondary">
                                <Link to={`/${l.attributes.slug}`}>
                                  {!userLessonProgress
                                    ? "Start"
                                    : userLessonProgress.isCompleted
                                      ? "Revisit"
                                      : "Continue"}
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                      {section.quiz?.data ? (
                        <div
                          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                          key={`quiz-${section.quiz.data?.id}`}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <PreviewSectionQuiz
                            quiz={section.quiz.data}
                            userProgress={userQuizProgress}
                            locked={isQuizLocked}
                          />
                          {!isQuizLocked ? (
                            <Button asChild className="ml-12 grow-0 sm:ml-0 sm:w-auto" variant="secondary">
                              {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                              <Link to={`/quizzes/${section.quiz.data?.id}`}>
                                {!userQuizProgress ? "Start" : userQuizProgress.isCompleted ? "View results" : "Start"}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </ul>
                  </Section>
                </li>
              );
            })}
          </ul>
        </main>
      </div>
      <PurchaseSuccessModal open={successModalOpen} onOpenChange={setSuccessModalOpen} />
      <PurchaseCanceledModal open={canceledModalOpen} onOpenChange={setCanceledModalOpen} />
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
