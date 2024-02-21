import { Lesson, UserLessonProgress } from "@prisma/client";
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

interface SectionLessonProps extends React.HTMLAttributes<HTMLDivElement> {
  lesson: Lesson;
  lessonTitle: string;
  courseSlug: string | undefined;
  hasVideo: boolean;
  userProgress: UserLessonProgress | null;
}
export function SectionLesson(props: SectionLessonProps) {
  const { lesson, userProgress, courseSlug, hasVideo, lessonTitle } = props;
  const isTimed = lesson.requiredDurationInSeconds !== null && lesson.requiredDurationInSeconds > 0;
  const durationInMinutes = isTimed ? Math.ceil(lesson.requiredDurationInSeconds! / 60) : 0;
  const Icon = hasVideo ? IconCameraFilled : IconClipboard;

  // Umtimed states
  if (!isTimed) {
    const isCompleted = userProgress?.isCompleted;
    return (
      <NavLink
        to={`/courses/${courseSlug}/${lesson.slug}`}
        className={({ isActive }) =>
          cn(
            "block rounded-lg py-1 transition hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring",
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
        to={`/courses/${courseSlug}/${lesson.slug}`}
        className={({ isActive }) =>
          cn(
            "block rounded-lg py-1 transition hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring",
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
            "block rounded-lg py-1 transition hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring",
            isActive ? "border border-[#e4e4e4] bg-muted p-2.5" : "-my-1",
          )
        }
      >
        {({ isActive }) => (
          <SectionItemContainer>
            <ProgressCircle
              className={cn(isActive && "border-success")}
              aria-label="Lesson progress"
              percentage={(userProgress.durationInSeconds / lesson.requiredDurationInSeconds!) * 100}
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
      to={`/courses/${courseSlug}/${lesson.slug}`}
      className={({ isActive }) =>
        cn(
          "block rounded-lg py-1 transition hover:ring hover:ring-[#e4e4e4] focus:outline-none focus:ring focus:ring-ring",
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
