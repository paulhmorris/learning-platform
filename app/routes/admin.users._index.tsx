import { IconPlus } from "@tabler/icons-react";
import { ColumnDef } from "@tanstack/react-table";
import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { AdminButton } from "~/components/ui/admin-button";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { db } from "~/integrations/db.server";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const [backendList, localList] = await Promise.all([
    AuthService.getUserList(),
    db.user.findMany({
      select: {
        id: true,
        role: true,
        clerkId: true,
        createdAt: true,
        courses: {
          select: { id: true },
        },
      },
    }),
  ]);
  const users = backendList.data
    .map((user) => {
      const localUser = localList.find((u) => u.clerkId === user.id);
      if (!localUser) {
        return null;
      }

      return {
        id: user.id,
        clerkId: localUser.clerkId,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        email: user.emailAddresses.at(0)?.emailAddress ?? "",
        phone: user.phoneNumbers.at(0)?.phoneNumber ?? undefined,
        createdAt: localUser.createdAt,
        role: localUser.role,
        courses: localUser.courses,
      };
    })
    .filter((user) => user !== null);
  return { users };
}

export default function UsersIndex() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Users | Plumb Media & Education</title>
      <AdminButton asChild variant="secondary">
        <Link to="/admin/users/new" className="mb-4 flex items-center space-x-2">
          <IconPlus className="size-5" />
          <span>New User</span>
        </Link>
      </AdminButton>

      <DataTable data={users} columns={columns} facets={facets} />
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}

type User = Awaited<ReturnType<typeof loader>>["users"][number];

const columns: Array<ColumnDef<User>> = [
  {
    accessorKey: "name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => {
      return (
        <div>
          <Link to={`/admin/users/${row.original.id}`} className="max-w-[120px] truncate font-medium text-primary">
            {row.getValue("name")}
          </Link>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[120px] truncate font-medium">{row.getValue("role")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[120px] truncate font-medium">{row.getValue("email")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("phone")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "courses",
    accessorFn: (row) => `${row.courses.length}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Courses" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("courses")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
];

const facets: Array<Facet> = [
  {
    columnId: "role",
    title: "Role",
  },
];
