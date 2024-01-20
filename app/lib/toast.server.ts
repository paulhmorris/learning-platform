import type { Session } from "@remix-run/node";
import { TypedJsonResponse, redirect, typedjson } from "remix-typedjson";
import { ExternalToast, ToastT } from "sonner";

import { SessionService } from "~/services/SessionService.server";

type Toast = ExternalToast & { type: ToastT["type"]; title: ToastT["title"] };

export function setGlobalToast(session: Session, toast: Toast) {
  session.flash("globalMessage", toast);
}

export function getGlobalToast(session: Session): Toast | null {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (session.get("globalMessage") as Toast) || null;
}

class ToastHandler {
  async redirect(request: Request, url: string, toast: Toast, init: ResponseInit = {}) {
    const session = await SessionService.getSession(request);
    const type: Toast["type"] = toast.type ?? "default";

    setGlobalToast(session, { ...toast, type });
    return redirect(url, {
      ...init,
      headers: {
        ...init.headers,
        "Set-Cookie": await SessionService.commitSession(session),
      },
    });
  }

  async json<Data>(
    request: Request,
    data: Data,
    toast: Toast,
    init: ResponseInit = {},
  ): Promise<TypedJsonResponse<Data>> {
    const session = await SessionService.getSession(request);
    const type: Toast["type"] = toast.type ?? "default";

    setGlobalToast(session, { ...toast, type });
    return typedjson<Data>(data, {
      ...init,
      headers: {
        ...init.headers,
        "Set-Cookie": await SessionService.commitSession(session),
      },
    });
  }
}

export const toast = new ToastHandler();
