import { parseFormData } from "@rvf/react-router";
import { useState } from "react";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { AdminButton } from "~/components/ui/admin-button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { db } from "~/integrations/db.server";
import { Responses } from "~/lib/responses.server";
import { loader as adminCourseLoader } from "~/routes/admin.courses.$courseId";
import { text } from "~/schemas/fields";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const [backendList, localList] = await Promise.all([
    AuthService.getUserList(),
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const users = backendList.data.map((user) => {
    const localUser = localList.find((u) => u.clerkId === user.id);
    return {
      id: user.id,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.emailAddresses.at(0)?.emailAddress ?? "",
      phone: user.phoneNumbers.at(0)?.phoneNumber ?? undefined,
      createdAt: localUser?.createdAt ?? new Date(),
    };
  });
  return { users };
}

const schema = z.object({ userId: text });

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const courseId = args.params.courseId;

  invariant(courseId, "Course ID is required.");

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return result.error;
  }

  await db.userCourses.create({
    data: {
      courseId,
      userId: result.data.userId,
    },
  });

  return Responses.created();
}

export const meta: MetaFunction = () => [{ title: "Edit Course | Plumb Media & Education" }];

export default function AdminEditCourse() {
  const fetcher = useFetcher();
  const [filter, setFilter] = useState("");
  const { users } = useLoaderData<typeof loader>();
  const data = useRouteLoaderData<typeof adminCourseLoader>("routes/admin.courses.$courseId");

  const filteredUsers = users.filter((u) => {
    return (
      u.firstName.toLowerCase().includes(filter.toLowerCase()) ||
      u.lastName.toLowerCase().includes(filter.toLowerCase()) ||
      u.email.toLowerCase().includes(filter.toLowerCase())
    );
  });

  if (!data?.course) {
    throw new Error("Course not found.");
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        You can use this table to enroll users in this course, which will give the user full access without paying. You
        cannot unenroll a user from a course.
      </p>
      <div className="mt-4">
        <Label htmlFor="filter" className="sr-only">
          Filter
        </Label>
        <Input
          id="filter"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
          placeholder="Filter by name or email..."
        />
      </div>
      <ul className="mt-4 divide-y divide-border/75">
        {filteredUsers.map((u) => {
          return (
            <li key={u.id} className="grid w-full max-w-lg grid-cols-2 items-center gap-8 py-3 md:py-2">
              <h2 className="col-span-1 truncate text-sm">
                {u.firstName} {u.lastName}
              </h2>
              {!data.course.userCourses.some((uc) => uc.userId === u.id) ? (
                <fetcher.Form method="put" className="col-span-1">
                  <input type="hidden" name="userId" value={u.id} />
                  <AdminButton disabled={fetcher.state !== "idle"} variant="link">
                    Enroll
                  </AdminButton>
                </fetcher.Form>
              ) : (
                <p className="h-10 px-3.5 text-sm leading-10 text-muted-foreground">Enrolled</p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
