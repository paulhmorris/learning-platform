import { HTMLAttributes } from "react";

import { IconCamera, IconCertificate, IconDevices } from "~/components/icons";
import { cn } from "~/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  courseTitle: string;
  numLessons?: number;
}

export function CourseHeader({ className, courseTitle, numLessons }: Props) {
  return (
    <header className={cn(className)}>
      <h1 className="text-pretty text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{courseTitle}</h1>
      <h2 className="mt-8 text-lg font-bold uppercase tracking-wider">Overview</h2>
      <ul className="mt-1 space-y-1 text-sm">
        {numLessons ? (
          <li className="flex items-center gap-1">
            <div className="basis-7">
              <IconCamera className="size-5" />
            </div>
            <span>
              {numLessons} {numLessons === 1 ? "Lesson" : "Lessons"}
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
