import { UserLessonProgress } from "@prisma/client";
import { useParams } from "@remix-run/react";

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

type Props = {
  lesson: APIResponseData<"api::lesson.lesson">;
  userProgress: Omit<UserLessonProgress, "createdAt" | "updatedAt">;
  clientProgressPercentage: number | null;
  setClientProgressPercentage: (value: number | null) => void;
};

export function PreviewUnstarted({
  lesson,
  userProgress,
  clientProgressPercentage,
  setClientProgressPercentage,
}: Props) {
  const params = useParams();
  const { hasVideo, durationInMinutes, title, slug, Icon } = getLessonAttributes(lesson);

  return (
    <div className={cn("-my-1 block rounded-lg py-1")}>
      <SectionItemContainer>
        <ProgressCircle aria-label="Lesson progress" percentage={clientProgressPercentage ?? 0} />
        <SectionItemIconContainer>
          <Icon className={cn("text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
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
            <SectionItemDescription>{durationInMinutes} min</SectionItemDescription>
          )}
        </div>
      </SectionItemContainer>
    </div>
  );
}
