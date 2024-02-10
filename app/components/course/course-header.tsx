import { HTMLAttributes } from "react";

import { IconCamera, IconCertificate, IconDevices } from "~/components/icons";
import { cn } from "~/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  courseTitle: string;
  numVideos?: number;
}

export function CourseHeader({ className, courseTitle, numVideos }: Props) {
  return (
    <header className={cn("space-y-8", className)}>
      <h1 className="text-pretty text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{courseTitle}</h1>
      <ul className="space-y-1 text-sm">
        {numVideos ? (
          <li className="flex items-center gap-1">
            <div className="basis-7">
              <IconCamera className="size-5" />
            </div>
            <span>
              {numVideos} {numVideos === 1 ? "Video" : "Videos"}
            </span>
          </li>
        ) : null}
        <li className="flex items-center gap-1">
          <div className="basis-7">
            <IconDevices className="size-5" />
          </div>
          <span>Accessible on tablet and phone</span>
        </li>
        <li className="flex items-center gap-1">
          <div className="basis-7">
            <IconCertificate className="size-5" />
          </div>
          <span>Certification upon completion</span>
        </li>
      </ul>
    </header>
  );
}
