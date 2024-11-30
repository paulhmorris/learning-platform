import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { cn, getLessonAttributes } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

type Props = {
  lesson: APIResponseData<"api::lesson.lesson">;
};

export function PreviewCompleted({ lesson }: Props) {
  const { hasVideo, title, durationInMinutes, Icon } = getLessonAttributes(lesson);

  return (
    <div className={cn("-my-1 block rounded-lg py-1")}>
      <SectionItemContainer>
        <ProgressCircle aria-label="Lesson progress" percentage={100} />
        <SectionItemIconContainer>
          <Icon className={cn("text-foreground", hasVideo ? "h-8 w-7" : "h-7 w-6")} />
        </SectionItemIconContainer>
        <div className="flex flex-col justify-center">
          <SectionItemTitle>{title}</SectionItemTitle>
          <SectionItemDescription>
            {durationInMinutes} of {durationInMinutes} min completed
          </SectionItemDescription>
        </div>
      </SectionItemContainer>
    </div>
  );
}
