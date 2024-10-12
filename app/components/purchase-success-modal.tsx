import { AdminButton } from "~/components/ui/admin-button";
import { ButtonGroup } from "~/components/ui/button-group";
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
          <ButtonGroup>
            <AdminButton variant="secondary" onClick={() => props.onOpenChange(false)}>
              Close
            </AdminButton>
            <AdminButton onClick={() => props.onOpenChange(false)}>Start Course</AdminButton>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
