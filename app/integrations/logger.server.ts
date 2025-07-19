import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, Logger } from "@axiomhq/logging";

import { CONFIG } from "~/config.server";

// Axiom
const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });
const logLevel = CONFIG.isDev ? "debug" : "info";
const logger = new Logger({
  logLevel,
  args: {
    environment: process.env.VERCEL_ENV,
  },
  transports: [
    new AxiomJSTransport({ axiom, logLevel, dataset: "server" }),
    new ConsoleTransport({ logLevel, prettyPrint: true }),
  ],
});

export function createLogger(module: string) {
  return module ? logger.with({ module }) : logger;
}

export const httpLogger = new Logger({
  logLevel,
  args: { environment: process.env.VERCEL_ENV },
  transports: [
    new AxiomJSTransport({ axiom, logLevel, dataset: "http" }),
    new ConsoleTransport({ logLevel, prettyPrint: true }),
  ],
});
