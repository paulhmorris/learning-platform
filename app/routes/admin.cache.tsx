import { parseFormData } from "@rvf/react-router";
import { ColumnDef } from "@tanstack/react-table";
import { ActionFunctionArgs, LoaderFunctionArgs, useLoaderData } from "react-router";
import * as z from "zod";

import { DeleteCacheKeyDialog } from "~/components/admin/cache/delete-cache-key-dialog";
import { ErrorComponent } from "~/components/error-component";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { CacheService, COURSE_LESSON_CACHE_PATTERNS } from "~/services/cache.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("AdminCache");

const schema = z.object({
  _action: z.literal("delete-key"),
  key: z.string().min(1),
});

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const items = await CacheService.listByPrefixes(COURSE_LESSON_CACHE_PATTERNS);
  return { items };
}

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireAdmin(args);
  const result = await parseFormData(args.request, schema);

  if (result.error) {
    return Toasts.dataWithError({ ok: false }, { message: "Error", description: "Error deleting cache item." });
  }

  try {
    await CacheService.deleteRawKey(result.data.key);
    logger.info("Cache item deleted", { key: result.data.key, userId: user.id });
    return Toasts.dataWithSuccess({ ok: true }, { message: "Success", description: "Cache item deleted." });
  } catch (error) {
    logger.error("Error deleting cache item", { error, userId: user.id });
    Sentry.captureException(error);
    return Toasts.dataWithError({ ok: false }, { message: "Error", description: "Error deleting cache item." });
  }
}

export default function AdminCache() {
  const { items } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Cache | Plumb Media & Education</title>
      <p className="mb-4 max-w-screen-lg text-sm font-normal text-muted-foreground">
        Course and lesson caches from Redis. Deleting an item forces it to be refetched from the CMS on next access.
      </p>
      <DataTable data={items} columns={columns} />
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}

type CacheItem = Awaited<ReturnType<typeof loader>>["items"][number];

function formatTTL(ttl: number) {
  if (ttl < 0) {
    return "No expiration";
  }

  const hours = Math.floor(ttl / 3600);
  const minutes = Math.floor((ttl % 3600) / 60);
  const seconds = ttl % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

const columns: Array<ColumnDef<CacheItem>> = [
  {
    accessorKey: "key",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Key" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("key")}</span>,
  },
  {
    accessorKey: "ttl",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Expires In" />,
    cell: ({ row }) => <span>{formatTTL(row.getValue("ttl"))}</span>,
    enableColumnFilter: false,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <DeleteCacheKeyDialog cacheKey={row.original.key} />
      </div>
    ),
    enableColumnFilter: false,
    enableSorting: false,
  },
];
