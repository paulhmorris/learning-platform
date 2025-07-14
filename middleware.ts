/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@axiomhq/pino";
import { geolocation, ipAddress, next } from "@vercel/functions";
import { isbot } from "isbot";
import pino from "pino";

export const config = { runtime: "nodejs" };

export default function middleware(request: Request) {
  const logger = pino(
    { level: "info", name: "HTTP" },
    pino.transport({
      target: "@axiomhq/pino",
      options: {
        dataset: process.env.AXIOM_DATASET_HTTP,
        token: process.env.AXIOM_TOKEN,
      },
    }),
  );
  const now = Date.now();
  const reqIsFromBot = request.headers.get("cf-isbot") === "true" || isbot(request.headers.get("user-agent") ?? "");
  const geo = geolocation(request);

  const logData: Record<string, unknown> = {
    content_type: request.headers.get("content-type"),
    geo: {
      city: geo.city ?? request.headers.get("cf-ipcity"),
      country: geo.country ?? request.headers.get("cf-ipcountry"),
    },
    id: request.headers.get("x-request-id"),
    ip: ipAddress(request),
    isbot: reqIsFromBot,
    method: request.method,
    uri: request.url,
    user_agent: request.headers.get("user-agent"),
  };
  logData.middleware_duration = Date.now() - now;

  logger.info(logData, "HTTP Request");
  return next();
}
