import { parseFormData } from "@rvf/react-router";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useMemo } from "react";
import {
  ActionFunctionArgs,
  Link,
  LoaderFunctionArgs,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import invariant from "tiny-invariant";
import * as z from "zod";

import { ErrorComponent } from "~/components/error-component";
import { AdminButton } from "~/components/ui/admin-button";
import { DataTable, DEFAULT_PAGE_SIZE } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { createLogger } from "~/integrations/logger.server";
import { Responses } from "~/lib/responses.server";
import type { loader as adminCourseLoader } from "~/routes/admin.courses.$courseId";
import { text } from "~/schemas/fields";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";
import { UserCourseService } from "~/services/user-course.server";

const logger = createLogger("Admin.Courses.Users");

const sortColumnToClerkField = {
  name: "first_name",
  email: "email_address",
  createdAt: "created_at",
} as const;

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);

  const url = new URL(args.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const rawQuery = url.searchParams.get("q")?.trim();
  const query = rawQuery && rawQuery.length > 0 ? rawQuery : undefined;

  const sortColumn = url.searchParams.get("sort");
  const clerkField =
    sortColumn && sortColumn in sortColumnToClerkField
      ? sortColumnToClerkField[sortColumn as keyof typeof sortColumnToClerkField]
      : undefined;
  const orderBy = clerkField
    ? url.searchParams.get("order") === "desc"
      ? (`-${clerkField}` as const)
      : (`+${clerkField}` as const)
    : undefined;

  const backendList = await AuthService.getUserList({
    query,
    orderBy,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const users = backendList.data.map((user) => {
    return {
      id: user.id,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.emailAddresses.at(0)?.emailAddress ?? "",
      createdAt: user.createdAt,
    };
  });

  return { users, totalCount: backendList.totalCount };
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

  try {
    await UserCourseService.enrollUser(result.data.userId, courseId);
  } catch (error) {
    logger.error(`Error enrolling user ${result.data.userId} in course ${courseId}`, {
      error,
      userId: result.data.userId,
      courseId,
    });
    return Responses.serverError("Failed to enroll user in course");
  }

  return Responses.created();
}

type UserRow = Awaited<ReturnType<typeof loader>>["users"][number];

function EnrollButton({ userId }: { userId: string }) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form method="put">
      <input type="hidden" name="userId" value={userId} />
      <AdminButton type="submit" disabled={fetcher.state !== "idle"} variant="link">
        Enroll
      </AdminButton>
    </fetcher.Form>
  );
}

function getColumns(courseId: string, enrolledUserIds: Set<string>): Array<ColumnDef<UserRow>> {
  return [
    {
      id: "name",
      accessorFn: (row) => `${row.firstName} ${row.lastName}`.trim(),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <Link
          to={`/admin/users/${row.original.id}/courses/${courseId}`}
          className="max-w-[200px] truncate font-medium text-primary hover:underline"
        >
          {row.getValue("name")}
        </Link>
      ),
      enableColumnFilter: false,
    },
    {
      id: "email",
      accessorFn: (row) => row.email,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => <span className="max-w-[240px] truncate">{row.getValue("email")}</span>,
      enableColumnFilter: false,
    },
    {
      id: "createdAt",
      accessorFn: (row) => dayjs(row.createdAt).format("MM/DD/YY h:mm a"),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => <span>{row.getValue("createdAt")}</span>,
      enableColumnFilter: false,
    },
    {
      id: "enrolled",
      header: "Enrolled",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (enrolledUserIds.has(row.original.id)) {
          return <p className="text-sm text-muted-foreground">Enrolled</p>;
        }
        return <EnrollButton userId={row.original.id} />;
      },
    },
  ];
}

export default function AdminEditCourseUsers() {
  const { users, totalCount } = useLoaderData<typeof loader>();
  const data = useRouteLoaderData<typeof adminCourseLoader>("routes/admin.courses.$courseId");

  const enrolledUserIds = useMemo(
    () => new Set(data?.course.userCourses.map((uc) => uc.userId) ?? []),
    [data?.course.userCourses],
  );
  const columns = useMemo(() => getColumns(data?.course.id ?? "", enrolledUserIds), [data?.course.id, enrolledUserIds]);

  if (!data?.course) {
    throw new Error("Course not found.");
  }

  return (
    <>
      <title>Edit Course | Plumb Media & Education</title>
      <p className="text-sm text-muted-foreground">
        You can use this table to enroll users in this course, which will give the user full access without paying. You
        cannot unenroll a user from a course.
      </p>
      <div className="mt-4">
        <DataTable
          data={users}
          columns={columns}
          serverPagination
          rowCount={totalCount}
          searchPlaceholder="Search by name or email..."
        />
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
