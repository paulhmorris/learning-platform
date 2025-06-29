import { UserLessonProgress } from "@prisma/client";
import { useParams } from "react-router";
import React from "react";

import { LessonLocked } from "~/components/preview/lesson-locked";
import { PreviewCompleted } from "~/components/preview/preview-completed";
import { PreviewInProgress } from "~/components/preview/preview-in-progress";
import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { ProgressTimer } from "~/components/sidebar/progress-timer";
import { cn, getLessonAttributes } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

interface SectionLessonProps extends React.HTMLAttributes<HTMLDivElement> {
  lesson: APIResponseData<"api::lesson.lesson">;
  userProgress: Omit<UserLessonProgress, "createdAt" | "updatedAt"> | null;
  locked?: boolean;
}

export function PreviewSectionLesson(props: SectionLessonProps) {
  const { lesson, locked, userProgress } = props;
  const { hasVideo, isTimed, durationInMinutes, Icon } = getLessonAttributes(lesson);

  const params = useParams();
  // Tracks the timer value from <ProgressTimer /> for a more reactive progress circle
  const [clientProgressPercentage, setClientProgressPercentage] = React.useState<number | null>(null);

  // Umtimed states
  if (!isTimed) {
    if (locked) {
      return <LessonLocked lesson={lesson} />;
    }

    return (
      <div className={cn("-my-1 block rounded-lg py-1")}>
        <SectionItemContainer>
          <ProgressCircle aria-label="Lesson progress" percentage={userProgress?.isCompleted ? 100 : 0} />
          <SectionItemIconContainer>
            <Icon className={cn("text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
          </SectionItemIconContainer>
          <SectionItemTitle>{lesson.attributes.title}</SectionItemTitle>
        </SectionItemContainer>
      </div>
    );
  }

  // Unstarted state
  if (!userProgress && !locked) {
    return (
      <div className={cn("-my-1 block rounded-lg py-1")}>
        <SectionItemContainer>
          <ProgressCircle aria-label="Lesson progress" percentage={clientProgressPercentage ?? 0} />
          <SectionItemIconContainer>
            <Icon className={cn("text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
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
      </div>
    );
  }

  // In progress state
  if (userProgress && !userProgress.isCompleted) {
    return (
      <PreviewInProgress
        lesson={lesson}
        userProgress={userProgress}
        clientProgressPercentage={clientProgressPercentage}
        setClientProgressPercentage={setClientProgressPercentage}
      />
    );
  }

  // Completed state
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (userProgress && userProgress.isCompleted) {
    return <PreviewCompleted lesson={lesson} />;
  }

  // Locked state
  if (locked) {
    return <LessonLocked lesson={lesson} />;
  }
}
