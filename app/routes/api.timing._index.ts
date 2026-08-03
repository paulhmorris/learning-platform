import { LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/db.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireSuperAdmin(args);

  const startTime = performance.now();
  await db.userCourse.findFirst();
  const endTime = performance.now();

  return { duration: endTime - startTime };
}
