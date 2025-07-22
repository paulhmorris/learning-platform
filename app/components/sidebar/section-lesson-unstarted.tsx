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
import { cn, getLessonAttributes } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

type Props = {
  lesson: APIResponseData<"api::lesson.lesson">;
  clientProgressPercentage: number | null;
  setClientProgressPercentage: (value: number | null) => void;
};

export function SectionLessonUnstarted({ lesson, clientProgressPercentage, setClientProgressPercentage }: Props) {
  const params = useParams();
  const { hasVideo, durationInMinutes, title, slug, Icon } = getLessonAttributes(lesson);

  return (
    <SectionItemLink to={`/${slug}`}>
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
            <SectionItemTitle>{title}</SectionItemTitle>
            {params.lessonSlug === slug ? (
              <SectionItemDescription>
                <ProgressTimer
                  lesson={lesson}
                  progress={null}
                  setClientProgressPercentage={setClientProgressPercentage}
                />
              </SectionItemDescription>
            ) : (
              <SectionItemDescription>{durationInMinutes} min</SectionItemDescription>
            )}
          </div>
        </SectionItemContainer>
      )}
    </SectionItemLink>
  );
}
