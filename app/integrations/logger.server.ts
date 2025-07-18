/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@axiomhq/pino";

import pino from "pino";

import "pino-pretty";
import { CONFIG } from "~/config.server";

const devTransport: pino.TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    ignore: "pid,hostname",
  },
};

export function createLogger(name: string, dataset = "server") {
  const logger = pino(
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
            dataset,
            token: process.env.AXIOM_TOKEN,
          },
        }),
  );
  return name ? logger.child({ name }) : logger;
}

export const logger = createLogger("Global");
