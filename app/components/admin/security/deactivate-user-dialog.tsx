import { IconLoader } from "@tabler/icons-react";
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
import type { action } from "~/routes/admin.users.$id.courses.$courseId";

export function DeactivateUserDialog() {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const [deactivateUserModalOpen, setDeactivateUserModalOpen] = useState(false);

  useEffect(() => {
    if (fetcher.data) {
      setDeactivateUserModalOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Dialog open={deactivateUserModalOpen} onOpenChange={setDeactivateUserModalOpen}>
      <DialogTrigger asChild>
        <AdminButton variant="link" className="-ml-3.5 hover:text-destructive sm:text-xs">
          Deactivate User
        </AdminButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will deactivate the user and they will no longer be able to access their account. This action can be
            reversed at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => setDeactivateUserModalOpen(false)}>
            Cancel
          </AdminButton>
          <fetcher.Form method="post">
            <AdminButton
              variant="destructive"
              type="submit"
              name="_action"
              value="deactivate-user"
              disabled={isSubmitting}
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Deactivate</span>
            </AdminButton>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
