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
export function PurchaseCanceledModal(props: Props) {
  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Something went wrong!</DialogTitle>
          <DialogDescription>
            It looks like you weren&apos;t able to purchase the course for some reason. If you&apos;d like to continue,
            try pressing "Try again".
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <ButtonGroup>
            <AdminButton variant="secondary" onClick={() => props.onOpenChange(false)}>
              Close
            </AdminButton>
            <AdminButton onClick={() => props.onOpenChange(false)}>Try again</AdminButton>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
