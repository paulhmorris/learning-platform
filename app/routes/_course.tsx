import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useParams } from "@remix-run/react";
import { useState } from "react";
import { typedjson } from "remix-typedjson";
import { useIsClient, useMediaQuery } from "usehooks-ts";

import { BackLink } from "~/components/common/back-link";
import { Header } from "~/components/header";
import { Section, SectionHeader } from "~/components/section";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { SectionQuiz } from "~/components/sidebar/section-quiz";
import { Separator } from "~/components/ui/separator";
import { useCourseData } from "~/hooks/useCourseData";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { getCoursefromCMSForCourseLayout, getLinkedCourse } from "~/models/course.server";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);

  try {
    const { host } = new URL(request.url);
    const linkedCourse = await getLinkedCourse(host);

    if (!linkedCourse) {
      Sentry.captureMessage("Received request from unknown host", {
        extra: { host },
        level: "warning",
        user: { username: user.email, id: user.id, email: user.email },
      });
      return toast.redirect(request, "/preview", {
        type: "error",
        title: "Course not found",
        description: "Please try again later",
        position: "bottom-center",
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const userHasAccess = user.courses && user.courses.some((c) => c.courseId === linkedCourse.id);
    if (!userHasAccess) {
      return toast.redirect(request, "/preview", {
        type: "error",
        title: "No access to course",
        description: "Please purchase the course to access it.",
        position: "bottom-center",
      });
    }

    const course = await getCoursefromCMSForCourseLayout(linkedCourse.strapiId);

    if (!course) {
      return toast.redirect(request, "/preview", {
        type: "error",
        title: "Failed to load course",
        description: "Please try again later",
        position: "bottom-center",
      });
    }

    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const quizProgress = await db.userQuizProgress.findMany({ where: { userId: user.id } });

    const lessonsInOrder = course.data.attributes.sections.flatMap((section) => {
      return (
        section.lessons?.data.map((l) => {
          const lessonProgress = progress.find((p) => p.lessonId === l.id);
          return {
            id: l.id,
            uuid: l.attributes.uuid,
            slug: l.attributes.slug.toLowerCase(),
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

    return typedjson({ course: course.data, progress, lessonsInOrder, quizProgress });
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

export default function CourseLayout() {
  const { course, lessonsInOrder, progress, quizProgress } = useCourseData();
  const params = useParams();
  const [isShowingMore, setIsShowingMore] = useState(false);
  const isClient = useIsClient();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const isCollapsed = !isShowingMore && !isLargeScreen;

  function toggleShowMore() {
    setIsShowingMore((prev) => !prev);
  }

  const { sections } = course.attributes;

  // Calculate the lesson last completed lesson, defaulting to the first lesson
  const nextLessonIndex = lessonsInOrder.findIndex((l) => !l.isCompleted);
  const nextLesson = lessonsInOrder.at(nextLessonIndex);
  const lastCompletedLessonIndex = nextLessonIndex === -1 ? 0 : nextLessonIndex - 1;

  const isQuizActive = Boolean(params.quizId);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const activeQuiz = sections.find((s) => s.quiz?.data?.id === Number(params.quizId))?.quiz ?? null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const activeQuizProgress = quizProgress.find((p) => p.quizId === activeQuiz?.data?.id);

  const activeLesson = lessonsInOrder.filter((l) => l.slug === params.lessonSlug).at(0) ?? null;
  const activeLessonProgress = progress.find((p) => p.lessonId === activeLesson?.id);
  const activeSection = activeQuiz
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      sections.find((s) => s.quiz?.data?.attributes.uuid === activeQuiz.data?.attributes.uuid)
    : sections.find((s) => s.id === activeLesson?.sectionId) ?? sections.at(0);

  // Sum the user progress to get the total progress
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);

  // The total duration of the course
  const totalDurationInSeconds = lessonsInOrder.reduce((acc, curr) => {
    return acc + (curr.requiredDurationInSeconds ?? 0);
  }, 0);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="max-w-screen-xl">
        <nav className="overflow-visible px-4 py-4 lg:fixed lg:bottom-0 lg:left-0 lg:top-20 lg:w-[448px] lg:overflow-auto lg:py-12">
          <BackLink to="/preview">Back to course</BackLink>
          {/* TODO: Adjust for non timed courses */}
          <div className="my-7">
            <CourseProgressBar progress={totalProgressInSeconds} duration={totalDurationInSeconds} />
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
                  (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds || 0) + acc),
                  0,
                );

                const isQuizLocked = lessonsInOrder
                  .filter((l) => l.sectionId === section.id)
                  .some((l) => !l.isCompleted);
                const shouldShowQuizInSection = isCollapsed ? isQuizActive || !isQuizLocked : true;

                return (
                  <li key={`section-${section.id}`} data-sectionid={section.id}>
                    <Section className={cn(isCollapsed && "pb-16")}>
                      <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds || 1) / 60} />
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
                            const lessonIndex = lessonsInOrder.findIndex((li) => li.uuid === l.attributes.uuid);

                            // Lock the lesson if the previous section's quiz is not completed
                            const previousSection = section_index > 0 ? sections.at(section_index - 1) : null;
                            const previousSectionQuiz = previousSection?.quiz;
                            const previousSectionQuizIsCompleted = quizProgress.find(
                              (p) => p.isCompleted && p.quizId === previousSectionQuiz?.data.id,
                            );
                            const isLessonLocked =
                              (previousSectionQuiz?.data && !previousSectionQuizIsCompleted) ||
                              lessonIndex > lastCompletedLessonIndex + 1;

                            return (
                              <SectionLesson
                                key={l.attributes.uuid}
                                lesson={l}
                                userProgress={progress.find((lp) => lp.lessonId === l.id) ?? null}
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
