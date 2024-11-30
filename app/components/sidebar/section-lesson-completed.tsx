import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemLink,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { cn, getLessonAttributes } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

type Props = {
  lesson: APIResponseData<"api::lesson.lesson">;
};

export function SectionLessonCompleted({ lesson }: Props) {
  const { hasVideo, title, slug, durationInMinutes, Icon } = getLessonAttributes(lesson);

  return (
    <SectionItemLink to={`/${slug}`}>
      {({ isActive }) => (
        <SectionItemContainer>
          <ProgressCircle className={cn(isActive && "border-success")} aria-label="Lesson progress" percentage={100} />
          <SectionItemIconContainer>
            <Icon className={cn(isActive ? "text-success" : "text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle>{title}</SectionItemTitle>
            <SectionItemDescription>
              {durationInMinutes} of {durationInMinutes} min completed
            </SectionItemDescription>
          </div>
        </SectionItemContainer>
      )}
    </SectionItemLink>
  );
}
