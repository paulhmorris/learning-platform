import { useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { useTypedRouteLoaderData } from "remix-typedjson";
import { toast } from "sonner";

import { loader } from "~/routes/_course";

export function useCourseData() {
  const navigate = useNavigate();
  const data = useTypedRouteLoaderData<typeof loader>("routes/_course");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!data || !data.course || !data.lessonsInOrder || !data.progress || !data.quizProgress) {
      navigate("/");
      toast.error("Error loading course.", {
        description: "There was an error loading the course data. Please try again.",
      });
    }
  }, [data, navigate]);

  return data as NonNullable<typeof data>;
}
