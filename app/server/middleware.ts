import { createMiddleware } from "hono/factory";
import { isbot } from "isbot";
import pino from "pino";

import "pino-pretty";
import { CONFIG } from "~/config.server";

const logger = pino(
  {
    level: "info",
    base: {
      environment: process.env.VERCEL_ENV,
    },
    transport: CONFIG.isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
          },
        }
      : undefined,
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  CONFIG.isDev
    ? undefined
    : pino.transport({
        target: "@axiomhq/pino",
        options: {
          dataset: "http",
          token: process.env.AXIOM_TOKEN,
        },
      }),
);

export function loggerMiddleware() {
  return createMiddleware(async (c, next) => {
    if (c.req.url.startsWith("/assets")) {
      return next();
    }

    const reqIsFromBot = c.req.header("cf-isbot") === "true" || isbot(c.req.header("user-agent") ?? "");
    const url = new URL(c.req.url);
    logger.info(
      {
        id: c.get("requestId") as string,
        content_type: c.req.header("content-type"),
        method: c.req.method,
        user_agent: c.req.header("user-agent"),
        is_bot: reqIsFromBot,
        uri: c.req.url,
        pathname: url.pathname,
        params: url.search,
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
