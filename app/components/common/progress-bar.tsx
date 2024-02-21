import { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "max"> {
  id: string;
  value: number;
}

export function ProgressBar({ className, value, ...rest }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      className={cn("h-2 w-full rounded-full bg-muted", className)}
      aria-valuemax={100}
      aria-valuenow={Math.ceil(value)}
      {...rest}
    >
      <div role="presentation" className="h-2 rounded-full bg-success" style={{ width: `${value}%` }}></div>
    </div>
  );
}
