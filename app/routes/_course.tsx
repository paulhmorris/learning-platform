import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { Header } from "~/components/header";
import { Section, SectionHeader } from "~/components/section";
import { BackToCourseLink } from "~/components/sidebar/back-to-course-link";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { SectionQuiz } from "~/components/sidebar/section-quiz";
import { Separator } from "~/components/ui/separator";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData } from "~/types/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);

  try {
    const { host } = new URL(request.url);
    const { strapiId } = await db.course.findUniqueOrThrow({ where: { host } });
    const course = await cms.findOne<APIResponseData<"api::course.course">>("courses", strapiId, {
      fields: ["title"],
      populate: {
        sections: {
          fields: ["title"],
          populate: {
            quiz: {
              fields: ["title", "uuid"],
              populate: {
                questions: {
                  count: true,
                },
              },
            },
            lessons: {
              fields: ["title", "slug", "has_video", "uuid", "required_duration_in_seconds"],
            },
          },
        },
      },
    });

    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const quizProgress = await db.userQuizProgress.findMany({ where: { userId: user.id } });

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

    return typedjson({ course: course.data, progress, lessonsInOrder, quizProgress });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.redirect(request, "/", {
      type: "error",
      title: "Failed to load course",
      description: "Please try again later",
      position: "bottom-center",
    });
  }
}

export default function CourseLayout() {
  const { course, lessonsInOrder, progress, quizProgress } = useTypedLoaderData<typeof loader>();
  // Calculate the lesson last completed lesson, defaulting to the first lesson
  const nextLessonIndex = lessonsInOrder.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = nextLessonIndex === -1 ? 0 : nextLessonIndex - 1;

  // Sum the user progress to get the total progress
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);

  const totalDurationInSeconds = lessonsInOrder.reduce((acc, curr) => {
    return acc + (curr.requiredDurationInSeconds ?? 0);
  }, 0);

  return (
    <>
      <Header />
      <div>
        <nav className="fixed bottom-0 left-0 top-20 w-[448px] overflow-auto py-10 pl-4 md:py-12">
          <BackToCourseLink />

          {/* TODO: Adjust for non timed courses */}
          <div className="my-7">
            <CourseProgressBar progress={totalProgressInSeconds} duration={totalDurationInSeconds} />
          </div>

          <ul className="space-y-7">
            {course.attributes.sections.map((section, section_index) => {
              const durationInSeconds = section.lessons?.data.reduce(
                (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds || 0) + acc),
                0,
              );
              const isQuizLocked = lessonsInOrder.filter((l) => l.sectionId === section.id).some((l) => !l.isCompleted);

              return (
                <li key={`section-${section.id}`} data-sectionid={section.id}>
                  <Section>
                    <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds || 1) / 60} />
                    <Separator className="my-4" />
                    <ul className="flex flex-col gap-4">
                      {section.lessons?.data.map((l) => {
                        const lessonIndex = lessonsInOrder.findIndex((li) => li.uuid === l.attributes.uuid);

                        // Lock the lesson if the previous section's quiz is not completed
                        const previousSection =
                          section_index > 0 ? course.attributes.sections[section_index - 1] : null;
                        const previousSectionQuiz = previousSection?.quiz;
                        const previousSectionQuizIsCompleted = quizProgress.find(
                          (p) => p.isCompleted && p.quizId === previousSectionQuiz?.data.id,
                        );
                        const isLessonLocked =
                          (previousSectionQuiz && !previousSectionQuizIsCompleted) ||
                          lessonIndex > lastCompletedLessonIndex + 1;

                        return (
                          <SectionLesson
                            key={l.attributes.uuid}
                            hasVideo={l.attributes.has_video}
                            userProgress={progress.find((lp) => lp.lessonId === l.id) ?? null}
                            lesson={l}
                            lessonTitle={l.attributes.title}
                            locked={isLessonLocked}
                          />
                        );
                      })}
                      {section.quiz?.data ? (
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
          </ul>
        </nav>
        <main className="ml-[480px] max-w-screen-md py-10 pr-4 md:py-12">
          <Outlet />
        </main>
      </div>
    </>
  );
}
