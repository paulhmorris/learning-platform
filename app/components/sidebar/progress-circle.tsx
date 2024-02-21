import React from "react";

import { IconCheck } from "~/components/icons";
import { cn } from "~/lib/utils";

type Attributes = Omit<React.HTMLAttributes<HTMLDivElement>, "role" | "aria-valuenow">;
type Props =
  | (Attributes & {
      percentage: number | `${number}`;
      "aria-labelledby": string;
    })
  | (Attributes & {
      percentage: number | `${number}`;
      "aria-label": string;
    });

export function ProgressCircle({ percentage, ...props }: Props) {
  const isComplete = percentage === 100;
  // const isClient = useIsClient();

  return (
    <div
      {...props}
      aria-labelledby=""
      role="progressbar"
      aria-valuenow={Number(percentage)}
      className={cn(
        "relative size-10 rounded-full border",
        isComplete ? "border-2 border-success" : "border border-foreground",
        props.className,
      )}
    >
      <div
        style={{
          background: isComplete ? "" : `conic-gradient(hsl(var(--success)) calc(${percentage} * 1%), #0000 0)`,
        }}
        className={cn(`absolute inset-0 left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full`)}
      >
        {isComplete ? <IconCheck aria-hidden="true" className="size-6 text-success" /> : null}
      </div>
    </div>
  );
}
