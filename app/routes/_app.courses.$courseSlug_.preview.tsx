import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useParams } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";

import { StrapiImage } from "~/components/common/strapi-image";
import { CourseHeader } from "~/components/course/course-header";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { IconClipboard, IconDocument } from "~/components/icons";
import { Section, SectionHeader } from "~/components/section";
import { CoursePreviewLink } from "~/components/sidebar/course-preview-link";
import { CourseProgressBar } from "~/components/sidebar/course-progress-bar";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { SectionQuiz } from "~/components/sidebar/section-quiz";
import { Separator } from "~/components/ui/separator";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, notFound, serverError } from "~/lib/responses.server";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseCollection, TypedMetaFunction } from "~/types/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  try {
    const courseResult = await cms.find<APIResponseCollection<"api::course.course">["data"]>("courses", {
      filters: {
        slug: courseSlug,
      },
      fields: ["title"],
      populate: {
        cover_image: {
          fields: ["alternativeText", "formats", "url"],
        },
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

    if (courseResult.data.length > 1) {
      throw serverError("Multiple courses with the same slug found.");
    }

    if (courseResult.data.length === 0) {
      throw notFound("Course not found.");
    }

    const course = courseResult.data[0];

    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const quizProgress = await db.userQuizProgress.findMany({ where: { userId: user.id } });

    const lessonsInOrder = course.attributes.sections.flatMap((section) => {
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

    return typedjson({ course, progress, lessonsInOrder, quizProgress });
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
  return [{ title: `Course Overview | ${data?.course.attributes.title}` }];
};

export default function CourseIndex() {
  const data = useTypedLoaderData<typeof loader>();
  const params = useParams();

  const { course, progress, lessonsInOrder, quizProgress } = data;

  // Calculate the lesson last completed lesson, defaulting to the first lesson
  const nextLessonIndex = lessonsInOrder.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = nextLessonIndex === -1 ? 0 : nextLessonIndex - 1;
  const nextLesson = lessonsInOrder.at(nextLessonIndex);

  // Check for a quiz
  const lasCompletedLessonSection = course.attributes.sections.find(
    (s) =>
      s.lessons?.data.some((l) => l.attributes.uuid === lessonsInOrder[lastCompletedLessonIndex].uuid) &&
      s.lessons.data.every((l) => lessonsInOrder.find((li) => li.uuid === l.attributes.uuid)?.isCompleted),
  );
  const lastCompletedLessonSectionHasIncompleteQuiz =
    lasCompletedLessonSection?.quiz?.data &&
    !quizProgress.find((p) => p.quizId === lasCompletedLessonSection.quiz?.data.id)?.isCompleted;
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
    <div className="flex gap-x-12 px-10">
      <nav className="sticky left-0 top-[88px] h-full shrink-0 basis-[448px] py-10 md:py-14">
        <StrapiImage
          asset={course.attributes.cover_image}
          height={240}
          width={448}
          fetchpriority="high"
          loading="eager"
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          alt={course.attributes.cover_image?.data?.attributes.alternativeText}
          className="overflow-hidden rounded-xl object-cover shadow-[0px_8px_32px_0px_#00000029]"
        />
        <div className="mt-7">
          <CoursePreviewLink to={`/courses/${params.courseSlug}`}>
            <IconClipboard className="text-current" />
            <span>Course Chapters</span>
          </CoursePreviewLink>

          <CoursePreviewLink to={`/courses/${params.courseSlug}/certificate`}>
            <IconDocument className="text-current" />
            <span>Certificate</span>
          </CoursePreviewLink>
        </div>
      </nav>

      <main className="max-w-screen-md py-10 md:py-14">
        <div className="space-y-8">
          <CourseHeader courseTitle={course.attributes.title} numLessons={lessonsInOrder.length || 0} />
          <CourseProgressBar progress={totalProgressInSeconds} duration={totalDurationInSeconds} />
          {nextQuiz ? (
            <CourseUpNext quiz={{ id: nextQuiz.id, numQuestions: nextQuiz.attributes.questions?.length ?? 1 }} />
          ) : nextLesson ? (
            <CourseUpNext lesson={lessonsInOrder[lastCompletedLessonIndex + 1]} />
          ) : null}
        </div>

        <ul className="mt-10 space-y-7">
          {course.attributes.sections.map((section, section_index) => {
            const durationInSeconds = section.lessons?.data.reduce(
              (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds || 0) + acc),
              0,
            );
            const isQuizLocked = lessonsInOrder.filter((l) => l.sectionId === section.id).some((l) => !l.isCompleted);

            return (
              <li key={`section-${section.id}`}>
                <Section>
                  <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds || 1) / 60} />
                  <Separator className="my-4" />
                  <ul className="flex flex-col gap-4">
                    {section.lessons?.data.map((l) => {
                      const lessonIndex = lessonsInOrder.findIndex((li) => li.uuid === l.attributes.uuid);

                      // Lock the lesson if the previous section's quiz is not completed
                      const previousSection = section_index > 0 ? course.attributes.sections[section_index - 1] : null;
                      const previousSectionQuiz = previousSection?.quiz;
                      const previousSectionQuizIsCompleted = quizProgress.find(
                        (p) => p.isCompleted && p.quizId === previousSectionQuiz?.data.id,
                      );
                      const isSectionLocked =
                        (previousSectionQuiz && !previousSectionQuizIsCompleted) ||
                        lessonIndex > lastCompletedLessonIndex + 1;

                      return (
                        <SectionLesson
                          key={l.attributes.uuid}
                          hasVideo={l.attributes.has_video}
                          userProgress={progress.find((lp) => lp.lessonId === l.id) ?? null}
                          lesson={l}
                          lessonTitle={l.attributes.title}
                          locked={isSectionLocked}
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
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
