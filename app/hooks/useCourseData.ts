import { useEffect } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { toast } from "sonner";

import type { loader } from "~/routes/_course";

export function useCourseData() {
  const navigate = useNavigate();
  const data = useRouteLoaderData<typeof loader>("routes/_course");

  useEffect(() => {
    if (!data?.course) {
      void navigate("/");
      toast.error("Error loading course.", {
        description: "There was an error loading the course data. Please try again.",
      });
    }
  }, [data, navigate]);

  return data!;
}
