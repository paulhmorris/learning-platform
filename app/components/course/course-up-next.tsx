import { Link } from "react-router";

import { IconCameraFilled, IconClipboard, IconDocument } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { valueIsNotNullishOrZero } from "~/lib/utils";
import { LessonInOrder } from "~/routes/preview";

type Props = {
  lesson?: LessonInOrder;
  quiz?: {
    id: number;
    numQuestions: number;
  };
};

export function CourseUpNext({ lesson, quiz }: Props) {
  if (!lesson && !quiz) {
    return null;
  }

  const isTimed = typeof lesson?.requiredDurationInSeconds !== "undefined" && lesson.requiredDurationInSeconds > 0;
  const durationInMinutes = isTimed ? Math.ceil((lesson.requiredDurationInSeconds || 0) / 60) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-3.5xl">Up next:</h2>
      <div className="flex flex-col gap-x-12 gap-y-6 sm:flex-row sm:items-center">
        {/* Title and duration */}
        {quiz ? (
          <>
            <div className="flex flex-col justify-between gap-1">
              <h3 className="text-pretty text-2xl">Quiz</h3>
              <div className="flex items-center gap-2">
                <IconDocument />
                <p className="text-sm font-light">
                  {quiz.numQuestions} question{quiz.numQuestions === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Button className="sm:ml-auto sm:max-w-60" variant="primary" asChild>
              <Link to={`/quizzes/${quiz.id}`}>Start</Link>
            </Button>
          </>
        ) : lesson ? (
          <>
            <div className="flex flex-col justify-between gap-1">
              <h3 className="text-pretty text-2xl" aria-describedby={lesson.hasVideo ? "video-duration" : undefined}>
                {lesson.title}
              </h3>
              {valueIsNotNullishOrZero(lesson.requiredDurationInSeconds) ? (
                <div className="flex items-center gap-2">
                  {lesson.hasVideo ? <IconCameraFilled className="size-7" /> : <IconClipboard className="size-5" />}
                  <p className="text-sm font-light" id="video-duration">
                    {durationInMinutes} min
                  </p>
                </div>
              ) : null}
            </div>
            <Button className="sm:ml-auto sm:max-w-60" variant="primary" asChild>
              <Link to={`/${lesson.slug}`}>{lesson.progressDuration ? "Continue" : "Start"}</Link>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
