import { IconExternalLink } from "@tabler/icons-react";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { Button } from "~/components/ui/button";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const list = await AuthService.getUserList();
  return { users: list.data };
}

export default function UsersIndex() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Users | Plumb Media & Education</title>
      <Button asChild variant="ghost" className="w-auto font-normal text-muted-foreground">
        <a className="block" href="https://dashboard.clerk.com" target="_blank" rel="noreferrer">
          <span>Manage User Authentication on Clerk</span>
          <IconExternalLink className="size-4" />
        </a>
      </Button>
      <div className="mt-4">
        <DataTable data={users} columns={columns} />
      </div>
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
    accessorKey: "email",
    accessorFn: (row) => row.emailAddresses.at(0)?.emailAddress ?? "No email",
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
    accessorKey: "createdAt",
    accessorFn: (row) => dayjs(row.createdAt).format("MM/DD/YY h:mm a"),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("createdAt")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
];
