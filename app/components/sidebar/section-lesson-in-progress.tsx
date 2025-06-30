import { UserLessonProgress } from "@prisma/client";
import { useParams } from "react-router";

import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemLink,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { ProgressTimer } from "~/components/sidebar/progress-timer";
import { cn, formatSeconds, getLessonAttributes } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

type Props = {
  lesson: APIResponseData<"api::lesson.lesson">;
  userProgress: Omit<UserLessonProgress, "createdAt" | "updatedAt">;
  clientProgressPercentage: number | null;
  setClientProgressPercentage: (value: number | null) => void;
};

export function SectionLessonInProgress({
  lesson,
  userProgress,
  clientProgressPercentage,
  setClientProgressPercentage,
}: Props) {
  const params = useParams();
  const { hasVideo, durationInMinutes, title, slug, Icon } = getLessonAttributes(lesson);

  let percentage = 0;
  if (userProgress.durationInSeconds && lesson.attributes.required_duration_in_seconds) {
    percentage = (userProgress.durationInSeconds / lesson.attributes.required_duration_in_seconds) * 100;
  }

  return (
    <SectionItemLink to={`/${slug}`}>
      {({ isActive }) => (
        <SectionItemContainer>
          <ProgressCircle
            className={cn(isActive && "border-success")}
            aria-label="Lesson progress"
            percentage={clientProgressPercentage ?? percentage}
          />
          <SectionItemIconContainer>
            <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle>{title}</SectionItemTitle>
            {params.lessonSlug === slug ? (
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
    </SectionItemLink>
  );
}
