import type { ComponentPropsWithoutRef } from "react";

import { cn } from "~/lib/utils";

export function ButtonGroup({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row", className)} {...props}>
      {children}
    </div>
  );
}
