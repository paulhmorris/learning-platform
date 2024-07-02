import { useFetcher } from "@remix-run/react";
import { IconLoader } from "@tabler/icons-react";
import { useEffect, useState } from "react";

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

export function CompleteCourseDialog() {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const [completeCourseModalOpen, setCompleteCourseDialogOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (fetcher.data?.ok) {
      setCompleteCourseDialogOpen(false);
    }
  }, [fetcher.data]);

  return (
    <Dialog open={completeCourseModalOpen} onOpenChange={setCompleteCourseDialogOpen}>
      <DialogTrigger asChild>
        <AdminButton variant="secondary" className="hover:bg-destructive hover:text-destructive-foreground">
          Complete Course
        </AdminButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will complete the ENTIRE course for this user. If you want to restore the previous progress state, you
            will have to manually input each lesson and quiz.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => setCompleteCourseDialogOpen(false)}>
            Cancel
          </AdminButton>
          <fetcher.Form method="post">
            <AdminButton
              variant="destructive"
              type="submit"
              name="_action"
              value="complete-course"
              disabled={isSubmitting}
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Complete Course</span>
            </AdminButton>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
