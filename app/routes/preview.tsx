import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { StrapiImage } from "~/components/common/strapi-image";
import { CourseHeader } from "~/components/course/course-header";
import { CoursePurchaseCTA } from "~/components/course/course-purchase-cta";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { IconClipboard, IconDocument } from "~/components/icons";
import { Section, SectionHeader } from "~/components/section";
import { CoursePreviewLink } from "~/components/sidebar/course-preview-link";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { PreviewSectionLesson } from "~/components/sidebar/preview-section-lesson";
import { PreviewSectionQuiz } from "~/components/sidebar/preview-section-quiz";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getCourse } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);

  try {
    const { host } = new URL(request.url);
    const linkedCourse = await db.course.findUnique({ where: { host } });
    if (!linkedCourse) {
      return toast.redirect(request, "/", {
        type: "error",
        title: "Course not found.",
        description: "Please try again later",
      });
    }

    const course = await getCourse(linkedCourse.strapiId);
    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const quizProgress = await db.userQuizProgress.findMany({ where: { userId: user.id } });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const userHasAccess = user.courses && user.courses.some((c) => c.courseId === linkedCourse.id);

    const lessonsInOrder = course.data.attributes.sections.flatMap((section) => {
      return (
        section.lessons?.data.map((l) => {
          const lessonProgress = progress.find((p) => p.lessonId === l.id);
          return {
            uuid: l.attributes.uuid,
            slug: l.attributes.slug,
            title: l.attributes.title,
            sectionId: section.id,
            sectionTitle: section.title,
            isCompleted: lessonProgress?.isCompleted ?? false,
            isTimed: l.attributes.required_duration_in_seconds && l.attributes.required_duration_in_seconds > 0,
            hasVideo: l.attributes.has_video,
            requiredDurationInSeconds: l.attributes.required_duration_in_seconds,
            progressDuration: lessonProgress?.durationInSeconds,
          };
        }) ?? []
      );
    });

    return typedjson({ course: course.data, progress, lessonsInOrder, quizProgress, userHasAccess });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw serverError("An error occurred while loading the course. Please try again.");
  }
}

export const meta: TypedMetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Preview | ${data?.course.attributes.title}` }];
};

export default function CoursePreview() {
  const { course, progress, lessonsInOrder, quizProgress, userHasAccess } = useTypedLoaderData<typeof loader>();

  const isCourseCompleted =
    lessonsInOrder.every((l) => l.isCompleted) &&
    course.attributes.sections.every((s) => {
      return !s.quiz?.data || quizProgress.find((p) => p.quizId === s.quiz?.data.id)?.isCompleted;
    });

  // Calculate the lesson last completed lesson, defaulting to the first lesson
  const nextLessonIndex = lessonsInOrder.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = nextLessonIndex === -1 ? 0 : nextLessonIndex - 1;
  const nextLesson = lessonsInOrder.at(nextLessonIndex);

  // Check if a quiz is next
  const lasCompletedLessonSection = course.attributes.sections.find(
    (s) =>
      s.lessons?.data.some((l) => l.attributes.uuid === lessonsInOrder[lastCompletedLessonIndex]?.uuid) &&
      s.lessons.data.every((l) => lessonsInOrder.find((li) => li.uuid === l.attributes.uuid)?.isCompleted),
  );
  const lastCompletedLessonSectionHasIncompleteQuiz =
    lasCompletedLessonSection?.quiz?.data &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !quizProgress.find((p) => p.quizId === lasCompletedLessonSection.quiz?.data?.id)?.isCompleted;
  const nextQuiz = lastCompletedLessonSectionHasIncompleteQuiz ? lasCompletedLessonSection.quiz?.data : null;

  // Sum the user progress to get the total progress
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);

  const totalDurationInSeconds = lessonsInOrder.reduce((acc, curr) => {
    return acc + (curr.requiredDurationInSeconds ?? 0);
  }, 0);

  // Timed Courses
  return (
    <>
      <div className="flex flex-col gap-x-12 px-4 py-4 lg:flex-row lg:py-4">
        <nav className="left-0 top-[88px] h-full shrink-0 basis-[448px] py-4 sm:py-10 lg:sticky lg:py-14">
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
            <CoursePreviewLink to={`.`}>
              <IconClipboard className="text-current" />
              <span>Course Chapters</span>
            </CoursePreviewLink>

            <CoursePreviewLink to={`/certificate`}>
              <IconDocument className="text-current" />
              <span>Certificate</span>
            </CoursePreviewLink>
          </div>
        </nav>

        <main className="max-w-screen-md lg:py-14">
          <div className="space-y-8">
            <CourseHeader courseTitle={course.attributes.title} numLessons={lessonsInOrder.length || 0} />
            <CourseProgressBar progress={totalProgressInSeconds} duration={totalDurationInSeconds} />
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
            ) : nextLesson ? (
              <CourseUpNext lesson={lessonsInOrder[lastCompletedLessonIndex + 1]} />
            ) : null}
          </div>

          <ul className="relative mt-10 space-y-7">
            {course.attributes.sections.map((section, section_index) => {
              const durationInSeconds = section.lessons?.data.reduce(
                (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds || 0) + acc),
                0,
              );
              const isQuizLocked = lessonsInOrder.filter((l) => l.sectionId === section.id).some((l) => !l.isCompleted);
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              const userQuizProgress = quizProgress.find((qp) => qp.quizId === section.quiz?.data?.id) ?? null;

              return (
                <li key={`section-${section.id}`}>
                  <Section>
                    <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds || 1) / 60} />
                    <Separator className="my-4" />
                    <ul className="flex flex-col gap-6">
                      {section.lessons?.data.map((l) => {
                        const lessonIndex = lessonsInOrder.findIndex((li) => li.uuid === l.attributes.uuid);

                        // Lock the lesson if the previous section's quiz is not completed
                        const previousSection =
                          section_index > 0 ? course.attributes.sections[section_index - 1] : null;
                        const previousSectionQuiz = previousSection?.quiz;
                        const previousSectionQuizIsCompleted = quizProgress.find(
                          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                          (p) => p.isCompleted && p.quizId === previousSectionQuiz?.data?.id,
                        );
                        const isLessonLocked =
                          !userHasAccess ||
                          (previousSectionQuiz?.data && !previousSectionQuizIsCompleted) ||
                          lessonIndex > lastCompletedLessonIndex + 1;

                        const userLessonProgress = progress.find((lp) => lp.lessonId === l.id) ?? null;
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
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
