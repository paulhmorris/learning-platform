import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

export const meta: MetaFunction = () => {
  return [{ title: `Users | Plumb Media & Education}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);

  try {
    const users = await db.user.findMany({
      where: { role: "USER" },
      include: { courses: true },
    });
    return typedjson({ users });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw error;
  }
}

export default function UsersIndex() {
  const { users } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <DataTable data={users} columns={columns} facets={facets} />
    </div>
  );
}

type User = Prisma.UserGetPayload<{ include: { courses: true } }>;
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
    accessorKey: "isEmailVerified",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Verified" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span
            className={cn(
              "max-w-[500px] truncate font-medium capitalize",
              !row.getValue("isEmailVerified") ? "text-destructive" : "",
            )}
          >
            {row.getValue("isEmailVerified") === true ? "yes" : "no"}
          </span>
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
    columnId: "isEmailVerified",
    title: "Verified",
  },
];
