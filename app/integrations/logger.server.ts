// import "@axiomhq/pino";
import pino from "pino";

import { CONFIG } from "~/config.server";

const devLogger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
    },
  },
  level: "debug",
  name: "Global",
});

const liveLogger = pino({
  // transport: {
  //   target: "@axiomhq/pino",
  //   options: {
  //     dataset: process.env.AXIOM_DATASET,
  //     token: process.env.AXIOM_TOKEN,
  //   },
  // },
  level: "info",
  name: "Global",
});

export function createLogger(name?: string) {
  if (CONFIG.isDev) {
    return name ? devLogger.child({ name }) : devLogger;
  }

  return name ? liveLogger.child({ name }) : liveLogger;
}

export const logger = createLogger();
