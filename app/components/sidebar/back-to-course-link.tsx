import { Link } from "@remix-run/react";
import { IconArrowLeft } from "@tabler/icons-react";

export function BackToCourseLink() {
  return (
    <Link
      to="/preview"
      className="group inline-flex items-center gap-2 rounded ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <IconArrowLeft className="size-[1.125rem] transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
      <span>Back to course</span>
    </Link>
  );
}
