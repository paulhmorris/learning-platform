import { Link } from "@remix-run/react";
import { useTypedRouteLoaderData } from "remix-typedjson";

import { PageTitle } from "~/components/page-header";
import { loader } from "~/routes/_app.courses.$courseSlug";

export default function Course() {
  const data = useTypedRouteLoaderData<typeof loader>("routes/_app.courses.$courseSlug");

  return (
    <div className="border border-purple-800 p-6">
      <PageTitle>Course Title</PageTitle>
      <Link className="font-bold text-purple-800" to={`/courses/${data?.course.id}/purchase`}>
        Purchase Course
      </Link>
      <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
