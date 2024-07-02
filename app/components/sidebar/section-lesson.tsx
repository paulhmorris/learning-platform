import { UserLessonProgress } from "@prisma/client";
import { NavLink, useParams } from "@remix-run/react";
import React from "react";

import { IconCameraFilled, IconClipboard } from "~/components/icons";
import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { ProgressTimer } from "~/components/sidebar/progress-timer";
import { cn, formatSeconds } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

interface SectionLessonProps extends React.HTMLAttributes<HTMLDivElement> {
  lesson: APIResponseData<"api::lesson.lesson">;
  userProgress: Omit<UserLessonProgress, "createdAt" | "updatedAt"> | null;
  locked?: boolean;
}

export function SectionLesson(props: SectionLessonProps) {
  const { lesson, locked, userProgress } = props;
  const { has_video: hasVideo } = lesson.attributes;
  const isTimed =
    typeof lesson.attributes.required_duration_in_seconds !== "undefined" &&
    lesson.attributes.required_duration_in_seconds > 0;
  const durationInMinutes = isTimed ? Math.ceil((lesson.attributes.required_duration_in_seconds || 0) / 60) : 0;
  const Icon = hasVideo ? IconCameraFilled : IconClipboard;

  const params = useParams();
  // Tracks the timer value from <ProgressTimer /> for a more reactive progress circle
  const [clientProgressPercentage, setClientProgressPercentage] = React.useState<number | null>(null);

  // Umtimed states
  if (!isTimed) {
    return (
      <NavLink
        end
        to={`/${lesson.attributes.slug}`}
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
              percentage={userProgress?.isCompleted ? 100 : 0}
            />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <SectionItemTitle>{lesson.attributes.title}</SectionItemTitle>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // Unstarted state
  if (!userProgress) {
    return (
      <NavLink
        end
        to={`/${lesson.attributes.slug}`}
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
              percentage={clientProgressPercentage ?? 0}
            />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <div className="flex flex-col justify-center">
              <SectionItemTitle>{lesson.attributes.title}</SectionItemTitle>
              {params.lessonSlug === lesson.attributes.slug ? (
                <SectionItemDescription>
                  <ProgressTimer
                    lesson={lesson}
                    progress={userProgress}
                    setClientProgressPercentage={setClientProgressPercentage}
                  />
                </SectionItemDescription>
              ) : (
                <SectionItemDescription>{durationInMinutes} min</SectionItemDescription>
              )}
            </div>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // In progress state
  if (!userProgress.isCompleted) {
    let percentage = 0;
    if (userProgress.durationInSeconds && lesson.attributes.required_duration_in_seconds) {
      percentage = (userProgress.durationInSeconds / lesson.attributes.required_duration_in_seconds) * 100;
    }

    return (
      <NavLink
        end
        to={`/${lesson.attributes.slug}`}
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
              percentage={clientProgressPercentage || percentage}
            />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <div className="flex flex-col justify-center">
              <SectionItemTitle>{lesson.attributes.title}</SectionItemTitle>
              {params.lessonSlug === lesson.attributes.slug ? (
                <SectionItemDescription>
                  <ProgressTimer
                    lesson={lesson}
                    progress={userProgress}
                    setClientProgressPercentage={setClientProgressPercentage}
                  />
                </SectionItemDescription>
              ) : (
                <SectionItemDescription>
                  {formatSeconds(userProgress.durationInSeconds ?? 0)} of {durationInMinutes} min completed
                </SectionItemDescription>
              )}
            </div>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // Completed state
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (userProgress.isCompleted) {
    return (
      <NavLink
        to={`/${lesson.attributes.slug}`}
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
              percentage={100}
            />
            <SectionItemIconContainer>
              <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
            </SectionItemIconContainer>
            <div className="flex flex-col justify-center">
              <SectionItemTitle>{lesson.attributes.title}</SectionItemTitle>
              <SectionItemDescription>
                {durationInMinutes} of {durationInMinutes} min completed
              </SectionItemDescription>
            </div>
          </SectionItemContainer>
        )}
      </NavLink>
    );
  }

  // Locked state
  if (locked) {
    return (
      <div
        className={cn("-my-1 block rounded-lg py-1")}
        aria-label="This lesson is locked until previous lessons are completed."
      >
        <SectionItemContainer>
          <ProgressCircle
            aria-label="Lesson progress"
            percentage={0}
            className="border-gray-400 contrast-more:border-gray-500 dark:border-gray-600 contrast-more:dark:border-gray-400"
          />
          <SectionItemIconContainer>
            <Icon
              className={cn(
                "text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400",
                hasVideo ? "h-8 w-7" : "h-7 w-6",
              )}
            />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle className="text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400">
              {lesson.attributes.title}
            </SectionItemTitle>
            <SectionItemDescription className="text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400">
              {durationInMinutes} min
            </SectionItemDescription>
          </div>
        </SectionItemContainer>
      </div>
    );
  }
}
