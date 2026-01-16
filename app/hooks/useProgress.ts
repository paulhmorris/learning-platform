import { useEffect } from "react";
import { useFetcher, useLocation } from "react-router";

import { loader } from "~/routes/api.progress";

export function useProgress() {
  const fetcher = useFetcher<typeof loader>({ key: "progress" });
  const location = useLocation();

  useEffect(() => {
    if (fetcher.state === "idle") {
      void fetcher.load("/api/progress");
    }
  }, [location.pathname, fetcher]);

  return (
    fetcher.data ?? {
      lessonProgress: [],
      quizProgress: [],
    }
  );
}
