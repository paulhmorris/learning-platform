import { UserQuizProgress } from "@prisma/client";
import React from "react";

import { IconDocument } from "~/components/icons";
import {
  SectionItemContainer,
  SectionItemDescription,
  SectionItemIconContainer,
  SectionItemTitle,
} from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { cn } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

interface SectionQuizProps extends React.HTMLAttributes<HTMLDivElement> {
  quiz: APIResponseData<"api::quiz.quiz">;
  userProgress: Omit<UserQuizProgress, "createdAt" | "updatedAt"> | null;
  locked?: boolean;
}
export function PreviewSectionQuiz(props: SectionQuizProps) {
  const { quiz, locked, userProgress } = props;

  // Locked state
  if (locked) {
    return (
      <li
        className={cn("-my-1 block rounded-lg py-1")}
        aria-label="This quiz is locked until all section lessons are completed."
      >
        <SectionItemContainer>
          <ProgressCircle
            aria-label="Quiz progress"
            percentage={0}
            className="border-gray-400 contrast-more:border-gray-500 dark:border-gray-600 contrast-more:dark:border-gray-400"
          />
          <SectionItemIconContainer>
            <IconDocument
              className={cn(
                "text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400",
              )}
            />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle className="text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400">
              Quiz
            </SectionItemTitle>
            <SectionItemDescription className="text-gray-400 contrast-more:text-gray-500 dark:text-gray-600 contrast-more:dark:text-gray-400">
              {/* @ts-expect-error see query in _course */}
              {quiz.attributes.questions?.count} question{quiz.attributes.questions?.count === 1 ? "" : "s"}
            </SectionItemDescription>
          </div>
        </SectionItemContainer>
      </li>
    );
  }

  // Unlocked state
  if (!userProgress || !userProgress.isCompleted) {
    return (
      <div className={cn("-my-1 block rounded-lg py-1")}>
        <SectionItemContainer>
          <ProgressCircle aria-label="Lesson progress" percentage={0} />
          <SectionItemIconContainer>
            <IconDocument className={cn("text-foreground")} />
          </SectionItemIconContainer>
          <div className="flex flex-col justify-center">
            <SectionItemTitle>Quiz</SectionItemTitle>
            <SectionItemDescription>
              {/* @ts-expect-error see query in _course */}
              {quiz.attributes.questions?.count} question{quiz.attributes.questions?.count === 1 ? "" : "s"}
            </SectionItemDescription>
          </div>
        </SectionItemContainer>
      </div>
    );
  }

  // Completed state
  return (
    <div className={cn("-my-1 block rounded-lg py-1")}>
      <SectionItemContainer>
        <ProgressCircle aria-label="Lesson progress" percentage={100} />
        <SectionItemIconContainer>
          <IconDocument className={cn("text-foreground")} />
        </SectionItemIconContainer>
        <div className="flex flex-col justify-center">
          <SectionItemTitle>Quiz</SectionItemTitle>
          <SectionItemDescription>Passed</SectionItemDescription>
        </div>
      </SectionItemContainer>
    </div>
  );
}
