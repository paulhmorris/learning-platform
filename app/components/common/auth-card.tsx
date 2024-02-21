import { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function AuthCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md px-6 dark:bg-card sm:rounded-xl sm:border sm:bg-background sm:px-12 sm:py-12 sm:shadow-[0px_8px_32px_0px_rgba(0,0,0,0.08)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
