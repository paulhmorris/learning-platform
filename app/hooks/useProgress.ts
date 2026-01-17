import { useEffect } from "react";
import { useFetcher, useLocation } from "react-router";

import { loader } from "~/routes/api.progress";

export function useProgress() {
  const location = useLocation();
  const fetcher = useFetcher<typeof loader>({ key: "progress" });

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
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
