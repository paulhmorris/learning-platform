import { NavLink } from "@remix-run/react";

import { cn } from "~/lib/utils";

type Props = {
  to: string;
  children: React.ReactNode;
};

export function CoursePreviewLink(props: Props) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        cn(
          isActive ? "border-l-4 border-primary text-primary underline" : "text-foreground",
          "flex items-center gap-2 border-b border-b-gray-200 px-4 py-7 text-lg font-medium",
        )
      }
    >
      {props.children}
    </NavLink>
  );
}
