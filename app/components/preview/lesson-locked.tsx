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

export function LessonLocked({ lesson }: Props) {
  const { hasVideo, title, durationInMinutes, Icon } = getLessonAttributes(lesson);

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
            {title}
          </SectionItemTitle>
          {durationInMinutes ? (
            <SectionItemDescription className="text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400">
              {durationInMinutes} min
            </SectionItemDescription>
          ) : null}
        </div>
      </SectionItemContainer>
    </div>
  );
}
