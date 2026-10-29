import { getGeo } from "hono-geo-middleware";
// eslint-disable-next-line import/order
import { createMiddleware } from "hono/factory";
import { isbot } from "isbot";
import { matchRoutes, type RouteObject, type ServerBuild } from "react-router";

import { SERVER_CONFIG } from "~/config.server";
import { httpLogger } from "~/integrations/logger.server";

const matchers = ["/assets", "favicon", ".well-known", "site.webmanifest", "sitemap.xml", "robots.txt"];

/** Clerk's handshake params (`__clerk_handshake`, `__clerk_handshake_nonce`) carry session tokens. */
const isClerkHandshakeParam = (key: string) => key.startsWith("__clerk_handshake");

function stripHandshakeParams(rawUrl: string) {
  const url = new URL(rawUrl);
  url.search = new URLSearchParams([...url.searchParams].filter(([key]) => !isClerkHandshakeParam(key))).toString();
  return url.toString();
}

function stripHandshakeQuery(query: Record<string, string>) {
  return Object.fromEntries(Object.entries(query).filter(([key]) => !isClerkHandshakeParam(key)));
}

/** The proxy terminates TLS, so restore the original scheme for React Router, Clerk and `url.origin`. */
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

/**
 * Logs only failed requests; Railway's HTTP logs and metrics cover routine traffic.
 * 4xx from bots are skipped since scanners would flood Sentry Logs.
 */
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
    const duration = Date.now() - start;

    const status = c.res.status;
    if (status < 400) {
      return;
    }

    const userAgent = c.req.header("user-agent");
    const isBot = c.req.header("cf-isbot") === "true" || isbot(userAgent ?? "");
    if (status < 500 && isBot) {
      return;
    }

    const geo = getGeo(c);
    const data = {
      status,
      request_id: c.get("requestId") as string,
      uri: stripHandshakeParams(c.req.url),
      path: c.req.path,
      query: stripHandshakeQuery(c.req.query()),
      method: c.req.method,
      is_bot: isBot,
      user_agent: userAgent,
      request_content_type: c.req.header("content-type"),
      response_content_type: c.res.headers.get("content-type"),
      duration,
      ip: geo.ip,
      geo: {
        city: geo.city,
        region: geo.region,
        country: geo.country,
        postalCode: geo.postalCode,
      },
    };

    if (status >= 500) {
      httpLogger.error("Response", data);
    } else {
      httpLogger.warn("Response", data);
    }
  });
}
