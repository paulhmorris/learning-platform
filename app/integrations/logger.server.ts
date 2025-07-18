/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@axiomhq/pino";

import pino from "pino";

import "pino-pretty";
import { CONFIG } from "~/config.server";

export const devTransport: pino.TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    ignore: "pid,hostname",
  },
};

const _logger = pino(
  {
    base: CONFIG.isDev
      ? undefined
      : {
          environment: process.env.VERCEL_ENV,
        },
    transport: CONFIG.isDev ? devTransport : undefined,
    level: CONFIG.isDev ? "debug" : (process.env.LOG_LEVEL ?? "info"),
  },
  CONFIG.isDev
    ? undefined
    : pino.transport({
        target: "@axiomhq/pino",
        options: {
          dataset: "server",
          token: process.env.AXIOM_TOKEN,
        },
      }),
);

export function createLogger(name: string) {
  return name ? _logger.child({ name }) : _logger;
}
