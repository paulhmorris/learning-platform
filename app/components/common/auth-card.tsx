import { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function AuthCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md px-6 dark:bg-card sm:rounded-xl sm:border sm:bg-background sm:px-12 sm:py-12 sm:shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
