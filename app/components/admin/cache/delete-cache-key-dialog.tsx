import { IconLoader, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { AdminButton } from "~/components/ui/admin-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { action } from "~/routes/admin.cache";

export function DeleteCacheKeyDialog({ cacheKey }: { cacheKey: string }) {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok) {
      setOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <AdminButton variant="ghost" size="icon" className="hover:bg-destructive hover:text-destructive-foreground">
          <IconTrash className="size-4" />
          <span className="sr-only">Delete cache item</span>
        </AdminButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will delete the cached item <span className="font-mono text-xs">{cacheKey}</span>. It will be refetched
            the next time it&apos;s requested.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </AdminButton>
          <fetcher.Form method="post">
            <input type="hidden" name="key" value={cacheKey} />
            <AdminButton variant="destructive" type="submit" name="_action" value="delete-key" disabled={isSubmitting}>
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Delete</span>
            </AdminButton>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
