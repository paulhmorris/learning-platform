import { User, UserLessonProgress, UserQuizProgress } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";
import { Params, useMatches, useRouteLoaderData } from "@remix-run/react";
import type { Attribute } from "@strapi/strapi";
import { IconClipboard } from "@tabler/icons-react";
import clsx, { ClassValue } from "clsx";
import { useMemo } from "react";
import { StrapiResponse } from "strapi-sdk-js";
import { twMerge } from "tailwind-merge";

import { IconCameraFilled } from "~/components/icons";
import { loader } from "~/root";
import { LessonInOrder } from "~/routes/preview";
import { APIResponseData } from "~/types/utils";

const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT,
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(id: string): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(() => matchingRoutes.find((route) => route.id === id), [matchingRoutes, id]);
  return route?.data as Record<string, unknown>;
}

function isUser(user: unknown): user is User {
  return user != null && typeof user === "object" && "email" in user && typeof user.email === "string";
}

export function useOptionalUser() {
  const data = useRouteLoaderData<typeof loader>("root");
  if (!data || !isUser(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): NonNullable<SerializeFrom<typeof loader>["user"]> {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.",
    );
  }
  return maybeUser;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

export function getSearchParam(param: string, request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get(param);
}

export function getAllSearchParams(param: string, request: Request) {
  const url = new URL(request.url);
  return url.searchParams.getAll(param);
}

export function getStrapiImgSrcSetAndSizes(formats: Attribute.JsonValue | undefined) {
  if (!formats) {
    return {
      srcSet: "",
      sizes: "",
    };
  }

  return {
    srcSet: Object.entries(formats)
      .map(([_key, value]) => {
        if ("url" in value && "width" in value) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return `${value.url} ${value.width}w`;
        }
      })
      .join(", "),
    sizes: Object.entries(formats)
      .map(([_key, value]) => {
        if ("url" in value && "width" in value) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return `(max-width: ${value.width}px) ${value.width}px`;
        }
      })
      .join(", "),
  };
}

export function valueIsNotNullishOrZero<T>(value: T | null | undefined): value is T {
  return value !== null && value !== 0;
}

export function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function normalizeSeconds(seconds: number) {
  if (seconds <= 3600) {
    return `${Math.floor(seconds / 60)} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
  }
}

export function hexToPartialHSL(H: string | undefined) {
  if (!H) {
    return null;
  }
  // Convert hex to RGB first
  let r: string | number = 0,
    g: string | number = 0,
    b: string | number = 0;
  if (H.length == 4) {
    r = parseInt("0x" + H[1] + H[1]);
    g = parseInt("0x" + H[2] + H[2]);
    b = parseInt("0x" + H[3] + H[3]);
  } else if (H.length == 7) {
    r = parseInt("0x" + H[1] + H[2]);
    g = parseInt("0x" + H[3] + H[4]);
    b = parseInt("0x" + H[5] + H[6]);
  }

  // Then to HSL
  r /= 255;
  g /= 255;
  b /= 255;
  const cmin = Math.min(r, g, b),
    cmax = Math.max(r, g, b),
    delta = cmax - cmin;

  let h = 0,
    s = 0,
    l = 0;

  if (delta == 0) h = 0;
  else if (cmax == r) h = ((g - b) / delta) % 6;
  else if (cmax == g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);

  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return `${h} ${s}% ${l}%`;
}

export function cacheHeader(seconds: number) {
  return {
    "Cache-Control": `private, max-age=${seconds}`,
  };
}

export function getLessonAttributes(lesson: APIResponseData<"api::lesson.lesson">) {
  const { has_video: hasVideo } = lesson.attributes;
  const isTimed =
    typeof lesson.attributes.required_duration_in_seconds !== "undefined" &&
    lesson.attributes.required_duration_in_seconds > 0;
  const durationInMinutes = isTimed ? Math.ceil((lesson.attributes.required_duration_in_seconds || 0) / 60) : 0;
  const Icon = hasVideo ? IconCameraFilled : IconClipboard;

  return { hasVideo, isTimed, durationInMinutes, Icon, title: lesson.attributes.title, slug: lesson.attributes.slug };
}

interface GetPreviewValueArgs {
  lessons: Array<LessonInOrder>;
  course: APIResponseData<"api::course.course">;
  quizProgress: SerializeFrom<Array<UserQuizProgress>>;
  lessonProgress: SerializeFrom<Array<UserLessonProgress>>;
}

export function getPreviewValues({ lessons, course, quizProgress, lessonProgress }: GetPreviewValueArgs) {
  const isCourseCompleted =
    lessons.every((l) => l.isCompleted) &&
    course.attributes.sections.every(
      (s) => !s.quiz?.data || quizProgress.some((p) => p.quizId === s.quiz?.data.id && p.isCompleted),
    );

  // Find the index of the next lesson to be completed, or use the first lesson if all are completed
  const nextLessonIndex = lessons.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = Math.max(0, nextLessonIndex - 1);

  // Determine if the next content is a quiz and if it's incomplete
  const lastCompletedLessonSection = course.attributes.sections.find(
    (s) =>
      s.lessons?.data.some((l) => l.attributes.uuid === lessons[lastCompletedLessonIndex]?.uuid) &&
      s.lessons.data.every((l) => lessons.find((li) => li.uuid === l.attributes.uuid)?.isCompleted),
  );
  const nextQuiz =
    lastCompletedLessonSection?.quiz?.data &&
    !quizProgress.some((p) => p.quizId === lastCompletedLessonSection.quiz?.data.id && p.isCompleted)
      ? lastCompletedLessonSection.quiz.data
      : null;

  // Calculate total progress and duration in seconds, or number of lessons and quizzes
  const numberOfLessons = lessons.length;
  const numberOfQuizzes = course.attributes.sections.filter((s) => s.quiz?.data).length;
  const completedLessonCount = lessons.filter((l) => l.isCompleted).length;
  const completedQuizCount = quizProgress.filter((p) => p.isCompleted).length;

  const courseIsTimed = lessons.some((l) => l.isTimed);
  const totalProgressInSeconds = courseIsTimed
    ? lessonProgress.reduce((acc, curr) => acc + (curr.durationInSeconds ?? 0), 0)
    : completedLessonCount + completedQuizCount;
  const totalDurationInSeconds = courseIsTimed
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      lessons.reduce((acc, curr) => acc + (curr.requiredDurationInSeconds ?? 0), 0)
    : numberOfLessons + numberOfQuizzes;

  return {
    nextQuiz,
    courseIsTimed,
    nextLessonIndex,
    isCourseCompleted,
    totalProgressInSeconds,
    totalDurationInSeconds,
    lastCompletedLessonIndex,
  };
}

interface GetCourseLayoutValueArgs extends GetPreviewValueArgs {
  params: Readonly<Params<string>>;
}

export function getCourseLayoutValues({
  lessons,
  course,
  quizProgress,
  lessonProgress,
  params,
}: GetCourseLayoutValueArgs) {
  const { sections } = course.attributes;
  const isCourseCompleted =
    lessons.every((l) => l.isCompleted) &&
    sections.every((s) => !s.quiz?.data || quizProgress.some((p) => p.quizId === s.quiz?.data.id && p.isCompleted));

  const nextLessonIndex = lessons.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = Math.max(0, nextLessonIndex - 1);
  const nextLesson = lessons[nextLessonIndex] ?? lessons[0];

  const isQuizActive = Boolean(params.quizId);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const activeQuiz = sections.find((s) => s.quiz?.data?.id === Number(params.quizId))?.quiz ?? null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const activeQuizProgress = quizProgress.find((p) => p.quizId === activeQuiz?.data?.id);

  const activeLesson = lessons.find((l) => l.slug === params.lessonSlug) ?? null;
  const activeLessonProgress = lessonProgress.find((p) => p.lessonId === activeLesson?.id);
  const activeSection = activeQuiz
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      sections.find((s) => s.quiz?.data?.attributes.uuid === activeQuiz.data?.attributes.uuid)
    : sections.find((s) => s.id === activeLesson?.sectionId) ?? sections[0];

  const numberOfLessons = lessons.length;
  const numberOfQuizzes = course.attributes.sections.filter((s) => s.quiz?.data).length;
  const completedLessonCount = lessons.filter((l) => l.isCompleted).length;
  const completedQuizCount = quizProgress.filter((p) => p.isCompleted).length;

  const courseIsTimed = lessons.some((l) => l.isTimed);

  const totalProgressInSeconds = courseIsTimed
    ? lessonProgress.reduce((acc, curr) => acc + (curr.durationInSeconds ?? 0), 0)
    : completedLessonCount + completedQuizCount;
  const totalDurationInSeconds = courseIsTimed
    ? lessons.reduce((acc, curr) => acc + (curr.requiredDurationInSeconds ?? 0), 0)
    : numberOfLessons + numberOfQuizzes;

  return {
    nextLesson,
    activeQuiz,
    activeLesson,
    isQuizActive,
    activeSection,
    courseIsTimed,
    nextLessonIndex,
    isCourseCompleted,
    activeQuizProgress,
    activeLessonProgress,
    totalProgressInSeconds,
    totalDurationInSeconds,
    lastCompletedLessonIndex,
  };
}

export function getLessonsInOrder({
  course,
  progress,
}: {
  course: StrapiResponse<APIResponseData<"api::course.course">>;
  progress: Array<UserLessonProgress>;
}) {
  return course.data.attributes.sections.flatMap((section) => {
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
}
