import { IconCamera, IconCameraFilled, IconCertificate, IconDevices, IconDocument } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { UserMenu } from "~/components/user-menu";

export default function Components() {
  return (
    <div className="mx-auto mt-48 flex max-w-lg flex-col gap-4 px-12">
      <Button variant="primary">Primary</Button>
      <Button className="text-" variant="secondary">
        Secondary
      </Button>
      <UserMenu />
      <p>Here is some text to select</p>
      <IconCameraFilled className="text-success size-8" />
      <IconCamera className="size-8" />
      <IconCertificate className="size-8" />
      <IconDevices className="size-8" />
      <IconDocument className="size-8" />
      <IconDocument className="size-8 text-primary" />
      <button className="bg-success text-success-foreground rounded-full px-4 py-2 font-bold">Success button</button>
    </div>
  );
}
