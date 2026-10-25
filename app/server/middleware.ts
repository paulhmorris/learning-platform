import { getGeo } from "hono-geo-middleware";
// eslint-disable-next-line import/order
import { createMiddleware } from "hono/factory";
import { isbot } from "isbot";
import { matchRoutes, type RouteObject, type ServerBuild } from "react-router";

import { SERVER_CONFIG } from "~/config.server";
import { httpLogger } from "~/integrations/logger.server";

const matchers = ["/assets", "favicon", ".well-known", "site.webmanifest", "sitemap.xml", "robots.txt"];

/** Clerk's handshake param carries a session token. */
const REDACTED_PARAMS = ["__clerk_handshake"];
const redactedParamPattern = new RegExp(`([?&](?:${REDACTED_PARAMS.join("|")})=)[^&#]*`, "g");

function redactUrl(url: string | null) {
  return url?.replace(redactedParamPattern, "$1REDACTED") ?? null;
}

function redactQuery(query: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, REDACTED_PARAMS.includes(key) ? "REDACTED" : value]),
  );
}

/** Railway terminates TLS, so restore the original scheme for React Router, Clerk and `url.origin`. */
export function forwardedProtoMiddleware() {
  return createMiddleware(async (c, next) => {
    if (c.req.header("x-forwarded-proto") === "https" && c.req.url.startsWith("http:")) {
      c.req.raw = new Request(c.req.url.replace(/^http:/, "https:"), c.req.raw);
    }
    await next();
  });
}

type RouteManifest = ServerBuild["routes"];

function toRouteObjects(manifest: RouteManifest, parentId?: string): Array<RouteObject> {
  return Object.values(manifest)
    .filter((route) => route?.parentId === parentId)
    .map((route) => {
      const children = toRouteObjects(manifest, route!.id);
      return {
        path: route!.path,
        index: route!.index,
        caseSensitive: route!.caseSensitive,
        children: children.length ? children : undefined,
      } as RouteObject;
    });
}

const validParam = /^[\w-]+$/;
const validSplat = /^[\w/-]*$/;

/** Single fetch requests `/_root.data` for `/` and `<path>.data` for everything else. */
function toDocumentPath(path: string) {
  if (path === "/_root.data") return "/";
  return path.endsWith(".data") ? path.slice(0, -".data".length) : path;
}

/**
 * 404s paths no route can serve before any loader runs, so scanners probing `/.env`,
 * `/wp-login.php` etc. don't trigger auth, course and CMS lookups.
 */
export function unknownPathMiddleware(loadRoutes: () => Promise<RouteManifest>) {
  let routes: Array<RouteObject> | undefined;
  return createMiddleware(async (c, next) => {
    routes ??= toRouteObjects(await loadRoutes());
    const matches = matchRoutes(routes, toDocumentPath(c.req.path));
    const params = Object.entries(matches?.at(-1)?.params ?? {});
    const isValid =
      matches && params.every(([key, value]) => (key === "*" ? validSplat : validParam).test(value ?? ""));
    if (!isValid) {
      return c.text("Not Found", 404);
    }
    await next();
  });
}

export function loggerMiddleware() {
  return createMiddleware(async (c, next) => {
    if (SERVER_CONFIG.isDev) {
      return next();
    }
    if (matchers.some((m) => c.req.url.includes(m))) {
      return next();
    }

    const start = Date.now();
    await next();
    const end = Date.now();

    const geo = getGeo(c);
    const resStatus = c.res.status;
    const requestId = c.get("requestId") as string;
    const reqUrl = redactUrl(c.req.url);
    const reqIsFromBot = c.req.header("cf-isbot") === "true" || isbot(c.req.header("user-agent") ?? "");

    const reqData = {
      id: requestId,
      uri: reqUrl,
      path: c.req.path,
      query: redactQuery(c.req.query()),
      method: c.req.method,
      is_bot: reqIsFromBot,
      user_agent: c.req.header("user-agent"),
      content_type: c.req.header("content-type"),
      duration: end - start,
      ip: geo.ip,
      geo: {
        city: geo.city,
        region: geo.region,
        country: geo.country,
        postalCode: geo.postalCode,
      },
    } as const;

    const resData: Record<string, unknown> = {
      status: resStatus,
      request_id: requestId,
      request_uri: reqUrl,
      path: c.req.path,
      content_type: c.res.headers.get("content-type"),
      duration: end - start,
    } as const;

    if (resStatus >= 300 && resStatus < 400) {
      resData.redirect_url = redactUrl(c.res.headers.get("location"));
      httpLogger.warn(`Redirecting from ${reqUrl} to ${resData.redirect_url as string}`, resData);
    }

    if (resStatus >= 400) {
      httpLogger.error("Response", resData);
    }

    if (resStatus < 300) {
      httpLogger.info("Request", reqData);
      httpLogger.info("Response", resData);
    }
  });
}
