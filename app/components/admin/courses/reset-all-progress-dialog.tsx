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
import { action } from "~/routes/admin.users.$id.courses.$courseId";

export function ResetAllProgressDialog() {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const [resetProgressModalOpen, setResetProgressModalOpen] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok) {
      setResetProgressModalOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Dialog open={resetProgressModalOpen} onOpenChange={setResetProgressModalOpen}>
      <DialogTrigger asChild>
        <AdminButton variant="secondary" className="hover:bg-destructive hover:text-destructive-foreground">
          Reset All Progress
        </AdminButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will reset all progress for this user in this course. This action is not reversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => setResetProgressModalOpen(false)}>
            Cancel
          </AdminButton>
          <fetcher.Form id="reset-progress-form" method="post">
            <AdminButton
              variant="destructive"
              type="submit"
              name="_action"
              value="reset-all-progress"
              disabled={isSubmitting}
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Reset Progress</span>
            </AdminButton>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
