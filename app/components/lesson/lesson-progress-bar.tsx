import { ProgressBar } from "~/components/common/progress-bar";
import { IconClock } from "~/components/icons";
import { normalizeSeconds } from "~/lib/utils";

type Props = {
  progress: number;
  duration: number;
};

export function LessonProgressBar(props: Props) {
  return (
    <div className="space-y-2">
      <ProgressBar id="course-progress" value={(props.progress / props.duration) * 100} />
      <label htmlFor="course-progress" className="flex items-center gap-2">
        <IconClock className="size-4" />
        {normalizeSeconds(props.progress)} of {normalizeSeconds(props.duration)} completed
      </label>
    </div>
  );
}
