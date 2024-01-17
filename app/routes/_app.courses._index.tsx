import { typedjson } from "remix-typedjson";

import { cms } from "~/integrations/cms.server";

export async function loader() {
  const courses = await cms.getCourses();
  return typedjson({ courses });
}
