import { IconArrowLeft } from "@tabler/icons-react";
import { Link, LinkProps } from "react-router";

import { cn } from "~/lib/utils";

export function BackLink({ className, children, ...rest }: LinkProps) {
  return (
    <Link
      {...rest}
      className={cn(
        "group inline-flex items-center gap-2 rounded text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <IconArrowLeft className="size-[1.125rem] transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
      <span>{children}</span>
    </Link>
  );
}
