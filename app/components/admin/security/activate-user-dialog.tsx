import { IconLoader } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTypedFetcher } from "remix-typedjson";

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
import { action } from "~/routes/admin.users.$id.courses.$courseId";

export function ActivateUserDialog() {
  const fetcher = useTypedFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const [activateUserModalOpen, setActivateUserModalOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (fetcher.data) {
      setActivateUserModalOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Dialog open={activateUserModalOpen} onOpenChange={setActivateUserModalOpen}>
      <DialogTrigger asChild>
        <AdminButton variant="secondary" className="hover:bg-destructive hover:text-destructive-foreground">
          Activate User
        </AdminButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will activate the user and they will be able to access their account. This action can be reversed at
            any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => setActivateUserModalOpen(false)}>
            Cancel
          </AdminButton>
          <fetcher.Form method="post">
            <AdminButton
              variant="destructive"
              type="submit"
              name="_action"
              value="activate-user"
              disabled={isSubmitting}
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Activate</span>
            </AdminButton>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
