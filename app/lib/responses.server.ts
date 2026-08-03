import { data, redirect, type UNSAFE_DataWithResponseInit } from "react-router";

type DataResponse = UNSAFE_DataWithResponseInit<unknown>;

/**
 * The `Responses` helpers below are built on react-router's `data()`, which returns a
 * `DataWithResponseInit` instance — *not* a `Response`. That makes `error instanceof Response`
 * silently false for anything thrown via `Responses.notFound()` and friends, which turns
 * intentional 4xx control flow into a 500.
 *
 * Use this in a catch block to decide whether a caught error is control flow to re-throw.
 */
export function isResponseLike(error: unknown): error is Response | DataResponse {
  if (error instanceof Response) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "DataWithResponseInit"
  );
}

/** Status code of a value that has passed `isResponseLike`, if it carries one. */
export function getResponseStatus(error: Response | DataResponse): number | undefined {
  return error instanceof Response ? error.status : (error.init?.status ?? undefined);
}

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

  redirectToSignIn(redirect_url: string) {
    const path = "/sign-in";
    const params = new URLSearchParams({ redirect_url });
    return redirect(`${path}?${params.toString()}`);
  },
};

export const HttpHeaders = {
  CacheControl: "Cache-Control",
};
