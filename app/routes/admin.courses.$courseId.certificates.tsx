import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { IconLoader } from "@tabler/icons-react";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, useFetcher, useLoaderData, useSearchParams } from "react-router";
import invariant from "tiny-invariant";
import * as z from "zod";

import { ErrorComponent } from "~/components/error-component";
import { AdminButton } from "~/components/ui/admin-button";
import { Badge } from "~/components/ui/badge";
import { DataTable, DEFAULT_PAGE_SIZE } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUpdateSearchParams } from "~/hooks/useSearchParamsUpdater";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { MAX_ALLOCATION_RANGE_SIZE } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { CertificateService } from "~/services/certificate.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Admin.Courses.Certificates");

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "available", label: "Available" },
  { value: "used", label: "Claimed" },
] as const;

const digits = z
  .string()
  .min(1, "Required")
  .max(20, "Must be 20 digits or less")
  // No leading zeros: one number, one written form, so a stored number is never ambiguous.
  .regex(/^(0|[1-9]\d*)$/, "Numbers only, without leading zeros");

function withRangeRules<T extends z.ZodType<{ start: string; end: string }>>(schema: T) {
  return (
    schema
      // BigInt, not Number: 20-digit numbers are allowed and would round past 2^53.
      .refine((data) => BigInt(data.end) >= BigInt(data.start), {
        message: "Must be greater than or equal to the first number",
        path: ["end"],
      })
      .refine((data) => BigInt(data.end) - BigInt(data.start) + 1n <= BigInt(MAX_ALLOCATION_RANGE_SIZE), {
        message: `Ranges are limited to ${MAX_ALLOCATION_RANGE_SIZE.toLocaleString()} numbers at a time`,
        path: ["end"],
      })
  );
}

const addRangeSchema = withRangeRules(
  z.object({
    _action: z.literal("add-range"),
    start: digits,
    end: digits,
  }),
);

const removeRangeSchema = withRangeRules(
  z.object({
    _action: z.literal("remove-range"),
    start: digits,
    end: digits,
  }),
);

const deleteSchema = z.object({
  _action: z.literal("delete"),
  allocationId: z.coerce.number(),
});

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const courseId = args.params.courseId;
  invariant(courseId, "Course ID is required.");

  const url = new URL(args.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const rawQuery = url.searchParams.get("q")?.trim();
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus === "used" || rawStatus === "available" ? rawStatus : undefined;

  const [summary, { allocations, totalCount }] = await Promise.all([
    CertificateService.getAllocationSummary(courseId),
    CertificateService.getAllocations({
      courseId,
      page,
      pageSize,
      query: rawQuery && rawQuery.length > 0 ? rawQuery : undefined,
      status,
      order: url.searchParams.get("order") === "desc" ? "desc" : "asc",
    }),
  ]);

  return { summary, allocations, totalCount };
}

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const courseId = args.params.courseId;
  invariant(courseId, "Course ID is required.");

  const formData = await args.request.formData();

  if (formData.get("_action") === "delete") {
    const result = await parseFormData(formData, deleteSchema);
    if (result.error) {
      return Toasts.dataWithError({ ok: false }, { message: "Error", description: "Invalid allocation." });
    }

    const deleted = await CertificateService.deleteUnusedAllocation({
      id: result.data.allocationId,
      courseId,
    });

    if (!deleted) {
      return Toasts.dataWithError(
        { ok: false },
        { message: "Error", description: "That number has already been claimed and cannot be removed." },
      );
    }

    return Toasts.dataWithSuccess({ ok: true }, { message: "Number removed." });
  }

  if (formData.get("_action") === "remove-range") {
    const result = await parseFormData(formData, removeRangeSchema);
    if (result.error) {
      return validationError(result.error);
    }

    try {
      const { requested, deleted } = await CertificateService.deleteUnusedAllocationRange({
        courseId,
        start: result.data.start,
        end: result.data.end,
      });

      if (deleted === 0) {
        return Toasts.dataWithWarning(
          { ok: true },
          {
            message: "No numbers removed",
            description: "Nothing in that range is an unused number on this course. Claimed numbers are never removed.",
          },
        );
      }

      const kept = requested - deleted;
      return Toasts.dataWithSuccess(
        { ok: true },
        {
          message: `Removed ${deleted.toLocaleString()} number${deleted === 1 ? "" : "s"}`,
          description:
            kept > 0
              ? `${kept === 1 ? "1 was" : `${kept.toLocaleString()} were`} claimed or not found and kept.`
              : "The whole range was removed.",
        },
      );
    } catch (error) {
      Sentry.captureException(error, { extra: { courseId, ...result.data } });
      logger.error(`Failed to remove allocation range for course ${courseId}`, { courseId });
      return Toasts.dataWithError(
        { ok: false },
        { message: "Error", description: "Failed to remove the range. Please try again." },
      );
    }
  }

  const result = await parseFormData(formData, addRangeSchema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const { requested, created, skipped } = await CertificateService.createAllocationRange({
      courseId,
      start: result.data.start,
      end: result.data.end,
    });

    if (created === 0) {
      return Toasts.dataWithWarning(
        { ok: true },
        {
          message: "No numbers added",
          description:
            requested === 1
              ? "That number already exists."
              : `All ${requested.toLocaleString()} numbers in that range already exist.`,
        },
      );
    }

    return Toasts.dataWithSuccess(
      { ok: true },
      {
        message: `Added ${created.toLocaleString()} number${created === 1 ? "" : "s"}`,
        description:
          skipped > 0
            ? `${skipped.toLocaleString()} already existed and ${skipped === 1 ? "was" : "were"} skipped.`
            : "The range is ready to use.",
      },
    );
  } catch (error) {
    Sentry.captureException(error, { extra: { courseId, ...result.data } });
    logger.error(`Failed to create allocation range for course ${courseId}`, { courseId });
    return Toasts.dataWithError(
      { ok: false },
      { message: "Error", description: "Failed to add the range. Please try again." },
    );
  }
}

type AllocationRow = Awaited<ReturnType<typeof loader>>["allocations"][number];

function DeleteButton({ allocationId, number }: { allocationId: number; number: string }) {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== "idle";
  const [isOpen, setIsOpen] = useState(false);

  // The action also returns validation errors for the add-range form, which have no `ok`.
  useEffect(() => {
    if (fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
      setIsOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <AdminButton variant="link" className="-my-1.5">
          Remove
        </AdminButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove certificate number {number}?</DialogTitle>
          <DialogDescription>
            This number will no longer be available to issue for this course. This action is not reversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </AdminButton>
          <fetcher.Form method="post">
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="allocationId" value={allocationId} />
            <AdminButton variant="destructive" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Remove Number</span>
            </AdminButton>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const columns: Array<ColumnDef<AllocationRow>> = [
  {
    id: "number",
    accessorFn: (row) => row.number,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="font-mono">{row.original.number}</span>
        {row.original.isDuplicated ? (
          <Badge variant="destructive" title="More than one certificate on this course carries this number">
            Duplicate
          </Badge>
        ) : null}
      </span>
    ),
    enableColumnFilter: false,
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <Badge variant={row.original.isUsed ? "outline" : "success"}>
        {row.original.isUsed ? "Claimed" : "Available"}
      </Badge>
    ),
  },
  {
    id: "claimedBy",
    header: "Claimed By",
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) =>
      row.original.claimedByUserId ? (
        <Link to={`/admin/users/${row.original.claimedByUserId}`} className="font-medium text-primary hover:underline">
          View student
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "issuedAt",
    header: "Issued",
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) =>
      row.original.issuedAt ? (
        <span>{dayjs(row.original.issuedAt).format("MM/DD/YY")}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "reported",
    header: "Reported",
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) => {
      if (!row.original.isUsed) return <span className="text-muted-foreground">—</span>;
      return row.original.isExported ? (
        <span>{dayjs(row.original.isExported).format("MM/DD/YY")}</span>
      ) : (
        <span className="text-muted-foreground">Pending</span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) =>
      row.original.isUsed ? null : <DeleteButton allocationId={row.original.id} number={row.original.number} />,
  },
];

export default function AdminCourseCertificates() {
  const { summary, allocations, totalCount } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const activeStatus = searchParams.get("status") ?? "";

  const memoizedColumns = useMemo(() => columns, []);

  function setStatus(value: string) {
    updateSearchParams((params) => {
      if (value) {
        params.set("status", value);
      } else {
        params.delete("status");
      }
      params.delete("page");
    });
  }

  return (
    <>
      <title>Certificate Numbers | Plumb Media & Education</title>

      <dl className="flex flex-wrap gap-6">
        <Stat label="Available" value={summary.available} highlight={summary.available === 0} />
        <Stat label="Claimed" value={summary.used} />
        <Stat label="Total" value={summary.total} />
      </dl>

      <section className="mt-8">
        <h2 className="text-xl">Add a range</h2>
        <p className="mt-1 max-w-screen-md text-sm text-muted-foreground">
          Adds every number between the two values, inclusive. Numbers only need to be unique within this course, and
          any this course already has are skipped. Leading zeros are not allowed &mdash;{" "}
          <span className="font-mono">1</span> to <span className="font-mono">100</span> stores{" "}
          <span className="font-mono">1, 2, &hellip; 100</span>.
        </p>
        <ValidatedForm
          id="add-allocation-range"
          method="post"
          schema={addRangeSchema}
          defaultValues={{ _action: "add-range" as const, start: "", end: "" }}
          className="mt-4 flex max-w-lg flex-wrap items-start gap-4"
        >
          {(form) => (
            <>
              <input type="hidden" name="_action" value="add-range" />
              <FormField scope={form.scope("start")} label="First number" placeholder="e.g. 123000" required />
              <FormField scope={form.scope("end")} label="Last number" placeholder="e.g. 123999" required />
              <SubmitButton variant="admin" isSubmitting={form.formState.isSubmitting} className="mt-6 w-auto">
                Add Range
              </SubmitButton>
            </>
          )}
        </ValidatedForm>
      </section>

      <RemoveRangeSection />

      <section className="mt-10">
        <h2 className="text-xl">Numbers</h2>
        <div className="mt-4 flex gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                activeStatus === filter.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-background/50",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <DataTable
            data={allocations}
            columns={memoizedColumns}
            serverPagination
            rowCount={totalCount}
            searchPlaceholder="Search by number..."
          />
        </div>
      </section>
    </>
  );
}

function RemoveRangeSection() {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== "idle";
  const [pendingRange, setPendingRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
      setPendingRange(null);
    }
  }, [fetcher.data]);

  const spanSize =
    pendingRange && BigInt(pendingRange.end) >= BigInt(pendingRange.start)
      ? Number(BigInt(pendingRange.end) - BigInt(pendingRange.start) + 1n)
      : 0;

  return (
    <section className="mt-10">
      <h2 className="text-xl">Remove a range</h2>
      <p className="mt-1 max-w-screen-md text-sm text-muted-foreground">
        Removes unused numbers in bulk, for undoing a range that was added by mistake. Claimed numbers are never
        removed.
      </p>
      <ValidatedForm
        id="remove-allocation-range"
        schema={removeRangeSchema}
        defaultValues={{ _action: "remove-range" as const, start: "", end: "" }}
        // Confirm before submitting: this opens the dialog instead of posting the form.
        submitSource="state"
        handleSubmit={(data) => setPendingRange({ start: data.start, end: data.end })}
        className="mt-4 flex max-w-lg flex-wrap items-start gap-4"
      >
        {(form) => (
          <>
            <FormField scope={form.scope("start")} label="First number" placeholder="e.g. 1" required />
            <FormField scope={form.scope("end")} label="Last number" placeholder="e.g. 100" required />
            <AdminButton type="submit" variant="secondary" className="mt-6 w-auto">
              Remove Range
            </AdminButton>
          </>
        )}
      </ValidatedForm>

      <Dialog open={pendingRange !== null} onOpenChange={(open) => !open && setPendingRange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {spanSize.toLocaleString()} number{spanSize === 1 ? "" : "s"} from {pendingRange?.start} to{" "}
              {pendingRange?.end}?
            </DialogTitle>
            <DialogDescription>
              Any of these that are unused on this course will be deleted. Claimed numbers and numbers that do not exist
              are left alone, so fewer than {spanSize.toLocaleString()} may be removed. This action is not reversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="secondary" onClick={() => setPendingRange(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => {
                if (!pendingRange) return;
                void fetcher.submit(
                  { _action: "remove-range", start: pendingRange.start, end: pendingRange.end },
                  { method: "post" },
                );
              }}
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Remove Numbers</span>
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-2xl tabular-nums", highlight && "text-destructive")}>{value.toLocaleString()}</dd>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
