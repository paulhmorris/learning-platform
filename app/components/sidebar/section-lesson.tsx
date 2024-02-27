import { UserLessonProgress } from "@prisma/client";
import { NavLink } from "@remix-run/react";
import React from "react";

import { IconCameraFilled, IconClipboard } from "~/components/icons";
import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { cn } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

interface SectionLessonProps extends React.HTMLAttributes<HTMLDivElement> {
  lesson: APIResponseData<"api::lesson.lesson">;
  lessonTitle: string;
  courseSlug: string | undefined;
  hasVideo: boolean;
  userProgress: UserLessonProgress | null;
  locked?: boolean;
}
export function SectionLesson(props: SectionLessonProps) {
  const { lesson, locked, userProgress, courseSlug, hasVideo, lessonTitle } = props;
  const isTimed =
    typeof lesson.attributes.required_duration_in_seconds !== "undefined" &&
    lesson.attributes.required_duration_in_seconds > 0;
  const durationInMinutes = isTimed ? Math.ceil((lesson.attributes.required_duration_in_seconds || 1) / 60) : 0;
  const Icon = hasVideo ? IconCameraFilled : IconClipboard;

  // Locked state
  if (locked) {
    return (
      <div className={cn("block cursor-not-allowed rounded-lg py-1")}>
        <SectionItemContainer>
          <ProgressCircle aria-label="Lesson progress" percentage={0} className="border-gray-300" />
          <SectionItemIconContainer>
            <Icon className={cn("text-gray-300", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
          </SectionItemIconContainer>
          <SectionItemTitle className="text-gray-300">{props.lessonTitle}</SectionItemTitle>
        </SectionItemContainer>
      </div>
    );
  }

  // Umtimed states
  if (!isTimed) {
    const isCompleted = userProgress?.isCompleted;
    return (
      <NavLink
        to={`/courses/${courseSlug}/${lesson.attributes.slug}`}
        className={({ isActive }) =>
          cn(
            "block rounded-lg py-1 hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring motion-safe:transition-all",
            isActive ? "border border-[#e4e4e4] bg-muted p-2.5" : "-my-1",
          )
        }
      >
        {({ isActive }) => (
          <SectionItemContainer>
            <ProgressCircle
              className={cn(isActive && "border-success")}
              aria-label="Lesson progress"
              percentage={isCompleted ? 100 : 0}
            />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <SectionItemTitle>{props.lessonTitle}</SectionItemTitle>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // Unstarted state
  if (!userProgress) {
    return (
      <NavLink
        to={`/courses/${courseSlug}/${lesson.attributes.slug}`}
        className={({ isActive }) =>
          cn(
            "block rounded-lg py-1 hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring motion-safe:transition-all",
            isActive ? "border border-[#e4e4e4] bg-muted p-2.5" : "-my-1",
          )
        }
      >
        {({ isActive }) => (
          <SectionItemContainer>
            <ProgressCircle className={cn(isActive && "border-success")} aria-label="Lesson progress" percentage={0} />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <div className="flex flex-col justify-center">
              <SectionItemTitle>{lessonTitle}</SectionItemTitle>
              <SectionItemDescription>{durationInMinutes} min</SectionItemDescription>
            </div>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // In progress state
  if (!userProgress.isCompleted) {
    return (
      <NavLink
        to={`/components`}
        className={({ isActive }) =>
          cn(
            "block rounded-lg py-1 hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring motion-safe:transition-all",
            isActive ? "border border-[#e4e4e4] bg-muted p-2.5" : "-my-1",
          )
        }
      >
        {({ isActive }) => (
          <SectionItemContainer>
            <ProgressCircle
              className={cn(isActive && "border-success")}
              aria-label="Lesson progress"
              percentage={(userProgress.durationInSeconds ?? 1 / lesson.attributes.required_duration_in_seconds!) * 100}
            />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <div className="flex flex-col justify-center">
              <SectionItemTitle>{props.lessonTitle}</SectionItemTitle>
              <SectionItemDescription>{durationInMinutes} min</SectionItemDescription>
            </div>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // Completed state
  return (
    <NavLink
      to={`/courses/${courseSlug}/${lesson.attributes.slug}`}
      className={({ isActive }) =>
        cn(
          "block rounded-lg py-1 hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring motion-safe:transition-all",
          isActive ? "border border-[#e4e4e4] bg-muted p-2.5" : "-my-1",
        )
      }
    >
      {({ isActive }) => (
        <SectionItemContainer>
          <ProgressCircle className={cn(isActive && "border-success")} aria-label="Lesson progress" percentage={100} />
          <SectionItemIconContainer>
            <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle>{props.lessonTitle}</SectionItemTitle>
            <SectionItemDescription>
              {durationInMinutes} of {durationInMinutes} min completed{" "}
            </SectionItemDescription>
          </div>
        </SectionItemContainer>
      )}
    </NavLink>
  );
}
