import { Link, useParams } from "@remix-run/react";

import { IconCameraFilled, IconDocument } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { valueIsNotNullishOrZero } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

type Props = {
  lesson: APIResponseData<"api::lesson.lesson"> | undefined;
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
          {/* {lesson.attributes.has_video ? (
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
            <h3
              className="text-pretty text-2xl"
              aria-describedby={lesson.attributes.has_video ? "video-duration" : undefined}
            >
              {lesson.attributes.title}
            </h3>
            {valueIsNotNullishOrZero(lesson.attributes.required_duration_in_seconds) ? (
              <div className="flex items-center gap-2">
                {lesson.attributes.has_video ? (
                  <IconCameraFilled className="size-7" />
                ) : (
                  <IconDocument className="size-5" />
                )}
                <p className="text-sm font-light" id="video-duration">
                  {lesson.attributes.required_duration_in_seconds / 60} min
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* CTA */}
        <Button className="sm:ml-auto sm:max-w-60" variant="primary" asChild>
          <Link to={`/courses/${params.courseSlug}/${lesson.attributes.slug}`}>Start</Link>
        </Button>
      </div>
    </div>
  );
}
