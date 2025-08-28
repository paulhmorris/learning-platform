import { data, redirect } from "react-router";

function responseFactory(status: number) {
  return <T = unknown>(body?: T, init?: Omit<ResponseInit, "status">) => {
    return data(body ?? null, { ...init, status });
  };
}

export const Responses = {
  ok: responseFactory(200),
  created: responseFactory(201),
  notModified: responseFactory(304),
  badRequest: responseFactory(400),
  unauthorized: responseFactory(401),
  forbidden: responseFactory(403),
  notFound: responseFactory(404),
  methodNotAllowed: responseFactory(405),
  conflict: responseFactory(409),
  unprocessableEntity: responseFactory(422),
  serverError: responseFactory(500),

  redirectBack(request: Request, { fallback, ...init }: ResponseInit & { fallback: string }): Response {
    return redirect(request.headers.get("Referer") ?? fallback, init);
  },

  redirectToSignIn(redirect_url?: string) {
    const path = "/sign-in";
    const params = new URLSearchParams();
    if (redirect_url) {
      params.set("redirect_url", redirect_url);
    }
    return redirect(`${path}?${params.toString()}`);
  },

  redirectToSignUp(redirect_url?: string) {
    const path = "/sign-up";
    const params = new URLSearchParams();
    if (redirect_url) {
      params.set("redirect_url", redirect_url);
    }
    return redirect(`${path}?${params.toString()}`);
  },
};

export const HttpHeaders = {
  CacheControl: "Cache-Control",
};
