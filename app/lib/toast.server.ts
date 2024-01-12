import type { Session, TypedResponse } from "@remix-run/node";
import { redirect, typedjson } from "remix-typedjson";

import type { Toast } from "~/components/ui/use-toast";
// import { Sentry } from "~/integrations/sentry";
import { SessionService } from "~/services/SessionService.server";

export function setGlobalToast(session: Session, toast: Toast) {
  session.flash("globalMessage", toast);
}

export function getGlobalToast(session: Session): Toast | null {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (session.get("globalMessage") as Toast) || null;
}

class ToastHandler {
  private defaultToasts: Record<NonNullable<Toast["variant"]>, Partial<Toast>> = {
    default: {
      variant: "default",
      title: "Success",
      description: "Your action was successful.",
      duration: 5_000,
    },
    warning: {
      variant: "warning",
      title: "Warning",
      description: "Your action was successful, but there may be some issues.",
      duration: 8_000,
    },
    destructive: {
      variant: "destructive",
      title: "Something went wrong",
      description: "Your action was not successful.",
      duration: 20_000,
    },
  };

  async redirect(request: Request, url: string, toast: Toast, init: ResponseInit = {}) {
    const session = await SessionService.getSession(request);
    const variant = toast.variant || "default";

    if (variant === "destructive" && toast.description) {
      // Sentry.captureMessage(`${toast.title} - ${toast.description}`, "error");
    }

    setGlobalToast(session, { ...this.defaultToasts[variant], ...toast });
    return redirect(url, {
      ...init,
      headers: {
        ...init.headers,
        "Set-Cookie": await SessionService.commitSession(session),
      },
    });
  }

  async json<Data>(request: Request, data: Data, toast: Toast, init: ResponseInit = {}): Promise<TypedResponse<Data>> {
    const session = await SessionService.getSession(request);
    const variant = toast.variant || "default";

    if (variant === "destructive" && toast.description) {
      // Sentry.captureMessage(toast.description, "error");
    }

    setGlobalToast(session, { ...this.defaultToasts[variant], ...toast });
    return typedjson(data, {
      ...init,
      headers: {
        ...init.headers,
        "Set-Cookie": await SessionService.commitSession(session),
      },
    });
  }
}

export const toast = new ToastHandler();
