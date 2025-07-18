import { createMiddleware } from "hono/factory";
import { isbot } from "isbot";

import "pino-pretty";
import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("HTTP");

const matchers = ["/assets", "favicon", ".well-known", "site.webmanifest", "sitemap.xml", "robots.txt"];

export function loggerMiddleware() {
  return createMiddleware(async (c, next) => {
    if (matchers.some((m) => c.req.url.includes(m))) {
      return next();
    }

    const reqIsFromBot = c.req.header("cf-isbot") === "true" || isbot(c.req.header("user-agent") ?? "");
    logger.info(
      {
        id: c.get("requestId") as string,
        content_type: c.req.header("content-type"),
        method: c.req.method,
        user_agent: c.req.header("user-agent"),
        is_bot: reqIsFromBot,
        uri: c.req.url,
        path: c.req.path,
        query: c.req.query(),
      },
      "Request",
    );

    await next();

    const status = c.res.status;
    const responseLogData: Record<string, unknown> = {
      request_id: c.get("requestId") as string,
      status,
      content_type: c.res.headers.get("content-type"),
      method: c.req.method,
      request_uri: c.req.url,
    };

    if (status >= 300 && status < 400) {
      responseLogData.redirect_url = c.res.headers.get("location");
      logger.warn(responseLogData, "Response");
    }

    if (status >= 400) {
      logger.error(responseLogData, "Response");
    }

    logger.info(responseLogData, "Response");
    logger.flush();
  });
}
