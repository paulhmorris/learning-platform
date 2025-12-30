import { IconArrowsDiagonal } from "@tabler/icons-react";
import { useState } from "react";

import { useUser } from "~/hooks/useUser";
import { cn } from "~/lib/utils";

export function UserDebugTools() {
  const user = useUser();
  const [userObjectExpanded, setUserObjectExpanded] = useState(false);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-12 left-12 isolate rounded-lg border bg-background shadow-lg",
        userObjectExpanded ? "size-auto p-4" : "grid size-10 place-items-center",
      )}
      onMouseEnter={() => setUserObjectExpanded(true)}
      onMouseLeave={() => setUserObjectExpanded(false)}
    >
      <div className={cn("relative", userObjectExpanded ? "p-4" : "p-2")}>
        {userObjectExpanded ? (
          <>
            <pre className="text-xs">{JSON.stringify(user, null, 2)}</pre>
            <button className="absolute right-2 top-2 rounded border p-2">
              <IconArrowsDiagonal className="size-4" />
            </button>
          </>
        ) : (
          <IconArrowsDiagonal className="size-4 cursor-pointer" />
        )}
      </div>
    </div>
  );
}
