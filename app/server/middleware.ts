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
  pino.transport({
    target: "@axiomhq/pino",
    options: {
      dataset: "http",
      token: process.env.AXIOM_TOKEN,
    },
  }),
);

export function loggerMiddleware() {
  return createMiddleware(async (c, next) => {
    const requestId = crypto.randomUUID();
    const reqIsFromBot = c.req.header("cf-isbot") === "true" || isbot(c.req.header("user-agent") ?? "");
    logger.info(
      {
        id: requestId,
        content_type: c.req.header("content-type"),
        method: c.req.method,
        user_agent: c.req.header("user-agent"),
        isbot: reqIsFromBot,
        uri: c.req.url,
      },
      "Request received",
    );

    await next();

    const status = c.res.status;
    const responseLogData: Record<string, unknown> = {
      id: requestId,
      status,
      content_type: c.res.headers.get("content-type"),
      method: c.req.method,
      uri: c.req.url,
    };

    if (status >= 300 && status < 400) {
      responseLogData.redirect_url = c.res.headers.get("location");
      logger.warn(responseLogData, "Redirect response");
    }

    if (status >= 400) {
      logger.error(responseLogData, "Error response");
    }

    logger.info(responseLogData, "Response sent");
    logger.flush();
  });
}
