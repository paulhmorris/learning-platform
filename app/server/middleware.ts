import { createMiddleware } from "hono/factory";
import { isbot } from "isbot";
import pino from "pino";

import { CONFIG } from "~/config.server";
import { devTransport } from "~/integrations/logger.server";

const devLogger = pino({
  name: "HTTP",
  level: "trace",
  transport: devTransport,
});

const prodLogger = pino(
  {
    base: {
      environment: process.env.VERCEL_ENV,
    },
    level: process.env.LOG_LEVEL ?? "info",
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

const logger = CONFIG.isDev ? devLogger : prodLogger;

const matchers = ["/assets", "favicon", ".well-known", "site.webmanifest", "sitemap.xml", "robots.txt"];

export function loggerMiddleware() {
  return createMiddleware(async (c, next) => {
    if (matchers.some((m) => c.req.url.includes(m))) {
      return next();
    }

    const start = Date.now();
    const reqIsFromBot = c.req.header("cf-isbot") === "true" || isbot(c.req.header("user-agent") ?? "");
    const requestId = c.get("requestId") as string;

    const reqData: Record<string, unknown> = {
      id: requestId,
      uri: c.req.url,
      path: c.req.path,
      query: c.req.query(),
      method: c.req.method,
      is_bot: reqIsFromBot,
      user_agent: c.req.header("user-agent"),
      content_type: c.req.header("content-type"),
    };

    const isPostOrPut = c.req.method === "POST" || c.req.method === "PUT";
    const isFormData =
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      c.req.header("content-type")?.startsWith("multipart/form-data") ||
      c.req.header("content-type")?.startsWith("application/x-www-form-urlencoded");
    if (isPostOrPut && isFormData) {
      const clone = c.req.raw.clone();
      const body = Object.fromEntries(await clone.formData());
      delete body.rvfFormId;
      reqData.body = body;
    }

    logger.info(reqData, "Request");

    await next();

    const end = Date.now();
    const resStatus = c.res.status;
    const resData: Record<string, unknown> = {
      status: resStatus,
      request_id: requestId,
      request_uri: c.req.url,
      content_type: c.res.headers.get("content-type"),
      duration: end - start,
    };

    if (resStatus >= 300 && resStatus < 400) {
      resData.redirect_url = c.res.headers.get("location");
      logger.warn(resData, "Response");
    }

    if (resStatus >= 400) {
      logger.error(resData, "Response");
    }

    logger.info(resData, "Response");
    logger.flush();
  });
}
