import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, Logger } from "@axiomhq/logging";

import { SERVER_CONFIG } from "~/config.server";

// Axiom
const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });
const logLevel = SERVER_CONFIG.isDev || SERVER_CONFIG.isTest ? "debug" : "info";
const consoleTransport = new ConsoleTransport({ logLevel, prettyPrint: true });

const logger = new Logger({
  logLevel,
  args: { environment: process.env.VERCEL_ENV },
  transports: [new AxiomJSTransport({ axiom, logLevel, dataset: "server" }), consoleTransport],
});

const devLogger = new Logger({
  logLevel,
  args: { environment: process.env.VERCEL_ENV },
  transports: [consoleTransport],
});

export function createLogger(module: string) {
  if (SERVER_CONFIG.isTest) {
    return new Logger({
      logLevel,
      args: { environment: "test" },
      transports: [new AxiomJSTransport({ axiom, logLevel, dataset: "server" }), consoleTransport],
    });
  }

  if (SERVER_CONFIG.isDev) {
    return devLogger.with({ module });
  }

  return logger.with({ module });
}

export const httpLogger = new Logger({
  logLevel,
  args: { environment: process.env.VERCEL_ENV },
  transports: [new AxiomJSTransport({ axiom, logLevel, dataset: "http" }), consoleTransport],
});
