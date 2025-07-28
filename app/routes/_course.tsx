/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { useState } from "react";
import { LoaderFunctionArgs, Outlet, useLoaderData, useParams } from "react-router";
import { useIsClient, useMediaQuery } from "usehooks-ts";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { Section, SectionHeader } from "~/components/section";
import { SectionCertificate } from "~/components/section/section-certificate";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { SectionQuiz } from "~/components/sidebar/section-quiz";
import { Separator } from "~/components/ui/separator";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { cn, getCourseLayoutValues, getLessonsInOrder } from "~/lib/utils";
import { CourseService } from "~/services/course.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);

  try {
    const { host } = new URL(args.request.url);
    const linkedCourse = await CourseService.getByHost(host);

    if (!linkedCourse) {
      return Toasts.redirectWithError("/preview", {
        message: "Course not found",
        description: "Please try again later",
      });
    }

    const userHasAccess = user?.courses.some((c) => c.courseId === linkedCourse.id);
    if (!userHasAccess) {
      return Toasts.redirectWithError("/preview", {
        message: "No access to course",
        description: "Please purchase the course to access it.",
      });
    }

    const course = await CourseService.getFromCMSForCourseLayout(linkedCourse.strapiId);

    if (!course) {
      return Toasts.redirectWithError("/preview", {
        message: "Failed to load course",
        description: "Please try again later",
      });
    }

    const [lessonProgress, quizProgress] = await Promise.all([
      ProgressService.getAll(user.id),
      ProgressService.getAllQuiz(user.id),
    ]);

    const lessons = getLessonsInOrder({ course, progress: lessonProgress });

    return { course: course.data, lessonProgress, lessons, quizProgress };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.redirectWithError("/preview", {
      message: "Failed to load course",
      description: "Please try again later",
    });
  }
}

export default function CourseLayout() {
  const params = useParams();
  const isClient = useIsClient();
  const [isShowingMore, setIsShowingMore] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const { course, lessons, lessonProgress, quizProgress } = useLoaderData<typeof loader>();
  const isCollapsed = !isShowingMore && !isLargeScreen;

  function toggleShowMore() {
    setIsShowingMore((prev) => !prev);
  }

  const { sections } = course.attributes;

  const {
    nextLesson,
    activeLesson,
    isQuizActive,
    activeSection,
    courseIsTimed,
    isCourseCompleted,
    activeQuizProgress,
    activeLessonProgress,
    totalProgressInSeconds,
    totalDurationInSeconds,
    lastCompletedLessonIndex,
  } = getCourseLayoutValues({
    lessons,
    params,
    lessonProgress,
    quizProgress,
    course,
  });

  if (!isClient) {
    return null;
  }

  return (
    <>
      <div className="max-w-screen-xl">
        <nav className="overflow-visible px-4 py-4 lg:fixed lg:bottom-0 lg:left-0 lg:top-20 lg:w-[448px] lg:overflow-auto lg:py-12">
          <BackLink to="/preview">Back to overview</BackLink>
          <div className="my-7">
            <CourseProgressBar
              progress={totalProgressInSeconds}
              duration={totalDurationInSeconds}
              isTimed={courseIsTimed}
            />
          </div>

          <ul className="relative space-y-7">
            {sections
              .filter((s) => {
                if (isCollapsed) {
                  if (activeLessonProgress?.isCompleted || activeQuizProgress?.isCompleted) {
                    return s.id === activeSection?.id || s.id === nextLesson?.sectionId;
                  }
                  return s.id === activeSection?.id;
                }
                return true;
              })
              .map((section, section_index) => {
                const durationInSeconds = section.lessons?.data.reduce(
                  (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds ?? 0) + acc),
                  0,
                );

                const isQuizLocked = lessons.filter((l) => l.sectionId === section.id).some((l) => !l.isCompleted);
                const shouldShowQuizInSection = isCollapsed ? isQuizActive || !isQuizLocked : true;

                return (
                  <li key={`section-${section.id}`} data-sectionid={section.id}>
                    <Section className={cn(isCollapsed && "pb-16")}>
                      <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds ?? 0) / 60} />
                      <Separator className={cn(isCollapsed ? "my-2 bg-transparent" : "my-4")} />
                      <ul className="flex flex-col gap-6">
                        {section.lessons?.data
                          .filter((l) => {
                            if (isCollapsed) {
                              // If lesson is completed, show the next lesson too
                              if (activeLessonProgress?.isCompleted || activeQuizProgress?.isCompleted) {
                                return (
                                  l.attributes.uuid === activeLesson?.uuid ||
                                  (nextLesson && l.attributes.uuid === nextLesson.uuid)
                                );
                              }
                              // Or just show active lesson when collapsed
                              return l.attributes.uuid === activeLesson?.uuid;
                            }
                            return true;
                          })
                          .map((l) => {
                            const lessonIndex = lessons.findIndex((li) => li.uuid === l.attributes.uuid);

                            // Lock the lesson if the previous section's quiz is not completed
                            const previousSection =
                              section_index > 0 ? course.attributes.sections[section_index - 1] : null;
                            const previousSectionQuiz = previousSection?.quiz;
                            const previousSectionQuizIsCompleted = quizProgress.find(
                              (p) => p.isCompleted && p.quizId === previousSectionQuiz?.data?.id,
                            );

                            const previousLessonIsCompleted = lessons[lastCompletedLessonIndex]?.isCompleted;
                            const isLessonLocked =
                              (lessonIndex > 0 && !previousLessonIsCompleted) ?? // Previous lesson is not completed
                              (previousSectionQuiz?.data && !previousSectionQuizIsCompleted) ?? // Previous section quiz is not completed
                              (!isCourseCompleted && lessonIndex > lastCompletedLessonIndex + 1); // Course is not completed and lesson index is greater than last completed lesson index + 1

                            return (
                              <SectionLesson
                                key={l.attributes.uuid}
                                lesson={l}
                                userProgress={lessonProgress.find((lp) => lp.lessonId === l.id) ?? null}
                                locked={isLessonLocked}
                              />
                            );
                          })}
                        {section.quiz?.data && shouldShowQuizInSection ? (
                          <SectionQuiz
                            quiz={section.quiz.data}
                            userProgress={quizProgress.find((qp) => qp.quizId === section.quiz?.data.id) ?? null}
                            locked={isQuizLocked}
                          />
                        ) : null}
                      </ul>
                    </Section>
                  </li>
                );
              })}
            <li key="section-certificate">
              <SectionCertificate isCourseCompleted={isCourseCompleted} />
            </li>
            {!isLargeScreen ? (
              <button
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 self-center rounded text-center text-base font-light ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  !isCollapsed ? "-bottom-12" : "bottom-6",
                )}
                onClick={toggleShowMore}
              >
                {!isCollapsed ? "Show less" : "Show more"}
              </button>
            ) : null}
          </ul>
        </nav>
        <main className="px-4 py-12 lg:ml-[480px] lg:max-w-screen-lg lg:pl-0 lg:pr-4">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
