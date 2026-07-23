import { RankingInfo, rankItem } from "@tanstack/match-sorter-utils";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { useSearchParams } from "react-router";
import { useDebounceCallback } from "usehooks-ts";

import { DataTablePagination } from "~/components/ui/data-table/data-table-pagination";
import { DataTableToolbar, Facet } from "~/components/ui/data-table/data-table-toolbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

declare module "@tanstack/table-core" {
  interface FilterFns {
    fuzzy: FilterFn<unknown>;
  }
  interface FilterMeta {
    itemRank: RankingInfo;
  }
}

export const DEFAULT_PAGE_SIZE = 20;

interface DataTableProps<TData> {
  data: Array<TData>;
  columns: Array<ColumnDef<TData>>;
  facets?: Array<Facet>;
  /** When true, pagination, sorting, and search are synced to URL query params instead of computed client-side. */
  serverPagination?: boolean;
  /** Total row count across all pages. Required when `serverPagination` is true. */
  rowCount?: number;
  searchPlaceholder?: string;
}

export function DataTable<TData>({
  data,
  columns,
  facets,
  serverPagination,
  rowCount,
  searchPlaceholder,
}: DataTableProps<TData>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");

  const [sorting, setSorting] = React.useState<SortingState>(() => {
    if (!serverPagination) return [];
    const sort = searchParams.get("sort");
    return sort ? [{ id: sort, desc: searchParams.get("order") === "desc" }] : [];
  });
  const [pagination, setPagination] = React.useState<PaginationState>(() => ({
    pageIndex: serverPagination ? Math.max(0, Number(searchParams.get("page") ?? 1) - 1) : 0,
    pageSize: serverPagination ? Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) : 20,
  }));
  const [searchInput, setSearchInput] = React.useState(() => searchParams.get("q") ?? "");

  const commitSearch = useDebounceCallback((value: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value) {
          params.set("q", value);
        } else {
          params.delete("q");
        }
        params.delete("page");
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }, 400);

  function updateSearch(value: string) {
    setSearchInput(value);
    commitSearch(value);
  }

  function updateSorting(updaterOrValue: Updater<SortingState>) {
    const newValue = typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
    setSorting(newValue);
    if (!serverPagination) return;

    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (newValue.length > 0) {
          const [first] = newValue;
          params.set("sort", first.id);
          params.set("order", first.desc ? "desc" : "asc");
        } else {
          params.delete("sort");
          params.delete("order");
        }
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function updatePagination(updaterOrValue: Updater<PaginationState>) {
    const newValue = typeof updaterOrValue === "function" ? updaterOrValue(pagination) : updaterOrValue;
    setPagination(newValue);
    if (!serverPagination) return;

    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("page", String(newValue.pageIndex + 1));
        params.set("pageSize", String(newValue.pageSize));
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  const table = useReactTable({
    data,
    columns,
    rowCount: serverPagination ? rowCount : undefined,
    manualPagination: serverPagination,
    manualSorting: serverPagination,
    filterFns: { fuzzy: fuzzyFilter },
    globalFilterFn: fuzzyFilter,
    state: {
      sorting,
      pagination,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
    },
    enableRowSelection: !serverPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: updateSorting,
    onPaginationChange: updatePagination,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        facets={facets}
        searchValue={serverPagination ? searchInput : undefined}
        onSearchChange={serverPagination ? updateSearch : undefined}
        searchPlaceholder={searchPlaceholder}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : null}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
