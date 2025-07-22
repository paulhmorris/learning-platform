import { UserLessonProgress } from "@prisma/client";
import React from "react";

import { LessonLocked } from "~/components/preview/lesson-locked";
import {
  SectionItemContainer,
  SectionItemIconContainer,
  SectionItemLink,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { SectionLessonCompleted } from "~/components/sidebar/section-lesson-completed";
import { SectionLessonInProgress } from "~/components/sidebar/section-lesson-in-progress";
import { SectionLessonUnstarted } from "~/components/sidebar/section-lesson-unstarted";
import { cn, getLessonAttributes } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

interface SectionLessonProps extends React.HTMLAttributes<HTMLDivElement> {
  lesson: APIResponseData<"api::lesson.lesson">;
  userProgress: Omit<UserLessonProgress, "createdAt" | "updatedAt"> | null;
  locked?: boolean;
}

export function SectionLesson(props: SectionLessonProps) {
  const { lesson, locked, userProgress } = props;
  const { hasVideo, isTimed, Icon } = getLessonAttributes(lesson);

  // Tracks the timer value from <ProgressTimer /> for a more reactive progress circle
  const [clientProgressPercentage, setClientProgressPercentage] = React.useState<number | null>(null);

  // Umtimed states
  if (!isTimed) {
    if (locked) {
      return <LessonLocked lesson={lesson} />;
    }

    return (
      <SectionItemLink to={`/${lesson.attributes.slug}`}>
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
      </SectionItemLink>
    );
  }

  // Unstarted state
  if (!userProgress && !locked) {
    return (
      <SectionLessonUnstarted
        lesson={lesson}
        clientProgressPercentage={clientProgressPercentage}
        setClientProgressPercentage={setClientProgressPercentage}
      />
    );
  }

  // In progress state
  if (userProgress && !userProgress.isCompleted) {
    return (
      <SectionLessonInProgress
        lesson={lesson}
        userProgress={userProgress}
        clientProgressPercentage={clientProgressPercentage}
        setClientProgressPercentage={setClientProgressPercentage}
      />
    );
  }

  // Completed state
  if (userProgress?.isCompleted) {
    return <SectionLessonCompleted lesson={lesson} />;
  }

  // Locked state
  if (locked) {
    return <LessonLocked lesson={lesson} />;
  }
}
