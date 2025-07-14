/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@axiomhq/pino";
import { Geo, ipAddress } from "@vercel/functions";
import { isbot } from "isbot";
import pino from "pino";

const logger = pino(
  { level: "info", name: "HTTP" },
  pino.transport({
    target: "@axiomhq/pino",
    options: {
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
    },
  }),
);

export const config = { runtime: "nodejs" };

export default function middleware(request: Request & { geo: Geo }) {
  const reqIsFromBot = request.headers.get("cf-isbot") === "true" || isbot(request.headers.get("user-agent") ?? "");

  const logData = {
    content_type: request.headers.get("content-type"),
    geo: {
      city: request.geo.city ?? request.headers.get("cf-ipcity"),
      country: request.geo.country ?? request.headers.get("cf-ipcountry"),
    },
    id: request.headers.get("x-request-id"),
    ip: ipAddress(request),
    isbot: reqIsFromBot,
    method: request.method,
    uri: request.url,
    user_agent: request.headers.get("user-agent"),
  };

  logger.info(logData, "HTTP Request");

  return new Response("OK", { status: 200 });
}
