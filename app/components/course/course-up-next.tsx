import { Link, useParams } from "@remix-run/react";

import { IconCameraFilled, IconDocument } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { valueIsNotNullishOrZero } from "~/lib/utils";

type Props = {
  lesson: {
    uuid: string | undefined;
    slug: string;
    title: string;
    sectionId: number;
    sectionTitle: string;
    isCompleted: boolean;
    isTimed: boolean | 0 | undefined;
    hasVideo: boolean;
    requiredDurationInSeconds: number | undefined;
    progressDuration: number | null | undefined;
  } | null;
};

export function CourseUpNext({ lesson }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const params = useParams();

  if (!lesson) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3.5xl">Up next:</h2>
      <div className="flex flex-col gap-x-12 gap-y-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          {/* {lesson.attributes.hasVideo ? (
            <div className="rounded-2xl">
              <img
                src={`https://image.mux.com/${content.video.data?.attributes.playback_id}/thumbnail.webp?width=150&height=85&fit_mode=smartcrop`}
                width={150}
                height={85}
                className="rounded-2xl object-cover"
                alt="A thumbnail of the lesson video"
              />
            </div>
          ) : null} */}

          {/* Title and duration */}
          <div className="flex flex-col justify-between gap-1">
            <h3 className="text-pretty text-2xl" aria-describedby={lesson.hasVideo ? "video-duration" : undefined}>
              {lesson.title}
            </h3>
            {valueIsNotNullishOrZero(lesson.requiredDurationInSeconds) ? (
              <div className="flex items-center gap-2">
                {lesson.hasVideo ? <IconCameraFilled className="size-7" /> : <IconDocument className="size-5" />}
                <p className="text-sm font-light" id="video-duration">
                  {lesson.requiredDurationInSeconds / 60} min
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* CTA */}
        <Button className="sm:ml-auto sm:max-w-60" variant="primary" asChild>
          <Link to={`/courses/${params.courseSlug}/${lesson.slug}`}>Start</Link>
        </Button>
      </div>
    </div>
  );
}
