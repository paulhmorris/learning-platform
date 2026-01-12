import { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "max"> {
  id: string;
  value: number;
}

export function ProgressBar({ className, value, ...rest }: ProgressBarProps) {
  const normalizedValue = Math.max(Math.min(Math.ceil(value), 100), 0);
  return (
    <div
      role="progressbar"
      className={cn("h-2 w-full rounded-full bg-muted", className)}
      aria-valuemax={100}
      aria-valuenow={normalizedValue}
      {...rest}
    >
      <div role="presentation" className="h-2 rounded-full bg-success" style={{ width: `${normalizedValue}%` }}></div>
    </div>
  );
}
