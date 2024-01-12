import { useEffect } from "react";

import { Toaster } from "~/components/ui/toast";
import type { Toast } from "~/components/ui/use-toast";
import { useToast } from "~/components/ui/use-toast";

export function Notifications({ serverToast }: { serverToast: Toast | null }) {
  const { toast } = useToast();

  useEffect(() => {
    if (!serverToast) return;
    toast({ ...serverToast });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverToast]);

  return <Toaster />;
}
