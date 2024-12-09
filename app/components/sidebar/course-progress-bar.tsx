import { ProgressBar } from "~/components/common/progress-bar";
import { IconClock } from "~/components/icons";
import { normalizeSeconds } from "~/lib/utils";

type Props = {
  progress: number;
  duration: number;
  isTimed: boolean;
};

export function CourseProgressBar(props: Props) {
  const percentage = Math.ceil((props.progress / props.duration) * 100);

  if (isNaN(percentage)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <ProgressBar id="course-progress" value={percentage} />
      <label htmlFor="course-progress" className="flex items-center gap-2">
        <IconClock className="size-4" />
        {props.isTimed ? (
          `${normalizeSeconds(props.progress)} of ${normalizeSeconds(props.duration)} course completed`
        ) : (
          <span>
            <span className="font-bold">{percentage}% </span>
            of course completed
          </span>
        )}
      </label>
    </div>
  );
}
