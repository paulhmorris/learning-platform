import { useEffect } from "react";
import { useFetcher } from "react-router";

import { loader } from "~/routes/api.progress";

export function useProgress() {
  const fetcher = useFetcher<typeof loader>({ key: "progress" });

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      void fetcher.load("/api/progress");
    }
  }, []);

  return (
    fetcher.data ?? {
      lessonProgress: [],
      quizProgress: [],
    }
  );
}
