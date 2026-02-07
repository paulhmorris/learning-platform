import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { loader } from "~/routes/api.progress";

// Module-level flag to prevent duplicate requests when multiple components mount simultaneously
let loadInitiated = false;

export function useProgress() {
  const fetcher = useFetcher<typeof loader>({ key: "progress" });
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data && !loadInitiated) {
      loadInitiated = true;
      void fetcher.load("/api/progress");
    }
    // Reset flag when data arrives so future navigations can refetch
    if (fetcher.data) {
      loadInitiated = false;
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    setIsLoading(fetcher.state === "loading");
    if (!hasLoaded && fetcher.state === "idle" && fetcher.data) {
      setHasLoaded(true);
    }
  }, [fetcher.state, fetcher.data, hasLoaded]);

  return {
    lessonProgress: fetcher.data?.lessonProgress ?? [],
    quizProgress: fetcher.data?.quizProgress ?? [],
    isLoading: isLoading || !hasLoaded,
  };
}
