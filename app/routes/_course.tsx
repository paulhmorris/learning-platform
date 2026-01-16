/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/react-router";
import { useEffect, useState } from "react";
import { LoaderFunctionArgs, Outlet, useLoaderData, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useIsClient, useMediaQuery } from "usehooks-ts";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { Section, SectionHeader } from "~/components/section";
import { SectionCertificate } from "~/components/section/section-certificate";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { SectionQuiz } from "~/components/sidebar/section-quiz";
import { Separator } from "~/components/ui/separator";
import { useProgress } from "~/hooks/useProgress";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { HttpHeaders } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cn, getCourseLayoutValues, getLessonsInOrder } from "~/lib/utils";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(args);

  try {
    const { host } = new URL(args.request.url);
    const linkedCourse = await CourseService.getByHost(host);

    if (!linkedCourse) {
      return Toasts.redirectWithError("/preview", {
        message: "Course not found",
        description: "Please try again later",
      });
    }

    const [course, userCourses] = await Promise.all([
      CourseService.getFromCMSForCourseLayout(linkedCourse.strapiId),
      db.userCourse.findMany({ where: { userId }, select: { courseId: true } }),
    ]);

    if (!course) {
      return Toasts.redirectWithError("/preview", {
        message: "Failed to load course",
        description: "Please try again later",
      });
    }

    const userCourseIds = userCourses.map((c) => c.courseId);
    return { course: course.data, linkedCourse, userCourseIds };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.redirectWithError("/preview", {
      message: "Failed to load course",
      description: "Please try again later",
    });
  }
}

export function headers() {
  return {
    [HttpHeaders.CacheControl]: "public, s-maxage=60, max-age=60, stale-while-revalidate=300",
  };
}

export default function CourseLayout() {
  const navigate = useNavigate();
  const params = useParams();
  const isClient = useIsClient();
  const [isShowingMore, setIsShowingMore] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const { course, linkedCourse, userCourseIds } = useLoaderData<typeof loader>();
  const { lessonProgress, quizProgress } = useProgress();
  const isCollapsed = !isShowingMore && !isLargeScreen;
  const hasAccess = userCourseIds.includes(linkedCourse.id);

  useEffect(() => {
    if (!hasAccess) {
      toast.error("You do not have access to this course. Please purchase it to continue.");
      void navigate("/preview");
    }
  }, [hasAccess, linkedCourse.id]);

  function toggleShowMore() {
    setIsShowingMore((prev) => !prev);
  }

  const lessons = getLessonsInOrder({ course, progress: lessonProgress });
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
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
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

                              const previousLessonIsCompleted = lessons[lessonIndex - 1]?.isCompleted;
                              const isLessonLocked =
                                (!hasAccess || // user doesn't have access
                                  (lessonIndex > 0 && !previousLessonIsCompleted)) ?? // Previous lesson is not completed
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
      </SignedIn>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
