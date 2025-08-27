import { data, redirect } from "react-router";

import { CONFIG } from "~/config.server";

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
    const url = CONFIG.signInUrl;
    if (redirect_url) {
      url.searchParams.set("redirect_url", redirect_url);
    }
    return redirect(url.toString());
  },

  redirectToSignUp(redirect_url?: string) {
    const url = CONFIG.signUpUrl;
    if (redirect_url) {
      url.searchParams.set("redirect_url", redirect_url);
    }
    return redirect(url.toString());
  },
};

export const HttpHeaders = {
  CacheControl: "Cache-Control",
};
