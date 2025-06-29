import { useNavigate, useRouteLoaderData } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { loader } from "~/routes/preview";

export function useCoursePreviewData() {
  const navigate = useNavigate();
  const data = useRouteLoaderData<typeof loader>("routes/preview");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!data || !data.course || !data.lessons || !data.lessonProgress || !data.quizProgress) {
      navigate("/");
      toast.error("Error loading course.", {
        description: "There was an error loading the course data. Please try again.",
      });
    }
  }, [data, navigate]);

  return data;
}
