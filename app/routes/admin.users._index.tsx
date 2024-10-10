import { Prisma } from "@prisma/client";
import { Link, useLoaderData } from "@remix-run/react";
import { IconPlus } from "@tabler/icons-react";
import { ColumnDef } from "@tanstack/react-table";
import { LoaderFunctionArgs, MetaFunction, json } from "@vercel/remix";

import { AdminButton } from "~/components/ui/admin-button";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { db } from "~/integrations/db.server";
import { SessionService } from "~/services/session.server";

export const meta: MetaFunction = () => {
  return [{ title: `Users | Plumb Media & Education}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const users = await db.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      courses: {
        select: { id: true },
      },
    },
  });
  return json({ users });
}

export default function UsersIndex() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <>
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

type User = Prisma.UserGetPayload<{
  select: {
    id: true;
    firstName: true;
    lastName: true;
    email: true;
    phone: true;
    role: true;
    courses: {
      select: { id: true };
    };
  };
}>;
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
