import { ComponentProps } from "react";

import { cn } from "~/lib/utils";

export function PageTitle({ className, children, ...props }: ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-3xl font-bold", className)} {...props}>
      {children}
    </h1>
  );
}
