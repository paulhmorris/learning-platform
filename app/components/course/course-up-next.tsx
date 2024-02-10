import { Lesson } from "@prisma/client";

import { IconCameraFilled, IconDocument } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { Lesson as CMSLesson } from "~/integrations/cms.server";
import { valueIsNotNullOrZero } from "~/lib/utils";

type Props = {
  content: CMSLesson["attributes"];
  lesson: Lesson;
};

export function CourseUpNext({ content, lesson }: Props) {
  const hasVideo = !!content.video.data;

  return (
    <main className="space-y-4">
      <h2 className="text-3.5xl">Up next:</h2>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        {/* Thumbnail */}
        {hasVideo ? (
          <div className="rounded-2xl">
            <img
              src={`https://image.mux.com/${content.video.data?.attributes.playback_id}/thumbnail.webp?width=150&height=85&fit_mode=smartcrop`}
              width={150}
              height={85}
              className="rounded-2xl object-cover"
              alt="A thumbnail of the lesson video"
            />
          </div>
        ) : null}
        {/* Title and duration */}
        <div className="space-y-1">
          <h3 className="text-pretty text-2xl" aria-describedby={hasVideo ? "video-duration" : undefined}>
            {content.title}
          </h3>
          {valueIsNotNullOrZero(lesson.requiredDurationInSeconds) ? (
            <div className="flex items-center gap-2">
              {hasVideo ? <IconCameraFilled className="size-7" /> : <IconDocument className="size-5" />}
              <p className="text-sm font-light" id="video-duration">
                {lesson.requiredDurationInSeconds / 60} min
              </p>
            </div>
          ) : null}
        </div>
        {/* CTA */}
        <Button className="min-w-60 sm:ml-auto" variant="primary">
          Start
        </Button>
      </div>
    </main>
  );
}
