import { Link } from "@remix-run/react";

import { AdminButton } from "~/components/ui/admin-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};
export function PurchaseSuccessModal(props: Props) {
  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Congrats!</DialogTitle>
          <DialogDescription>You&apos;ve successfully enrolled. You can now proceed to the course.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => props.onOpenChange(false)}>
            Close
          </AdminButton>
          <AdminButton asChild>
            <Link to="/preview">Go to course</Link>
          </AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
