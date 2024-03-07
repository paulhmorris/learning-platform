import { Link, useParams } from "@remix-run/react";
import { IconArrowLeft } from "@tabler/icons-react";

export function BackToCourseLink() {
  const params = useParams();
  return (
    <Link to={`/courses/${params.courseSlug}/preview`} className="inline-flex items-center gap-2">
      <IconArrowLeft className="size-[1.125rem]" />
      <span>Back to course</span>
    </Link>
  );
}
