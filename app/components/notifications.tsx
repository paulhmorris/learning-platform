import { useEffect } from "react";
import { useTypedRouteLoaderData } from "remix-typedjson";
import { Toaster, toast } from "sonner";

import { loader } from "~/root";

export function Notifications() {
  const data = useTypedRouteLoaderData<typeof loader>("root");
  useEffect(() => {
    if (!data?.serverToast) return;
    const { title, type, ...rest } = data.serverToast;
    switch (type) {
      case "success": {
        toast.success(title, rest);
        break;
      }
      case "error": {
        toast.error(title, { ...rest, duration: Infinity, closeButton: true });
        break;
      }
      case "warning": {
        toast.warning(title, rest);
        break;
      }
      case "info": {
        toast.info(title, rest);
        break;
      }
      case "normal":
      default: {
        toast(title, rest);
        break;
      }
    }
  }, [data]);

  return <Toaster richColors expand />;
}
