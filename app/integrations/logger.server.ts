import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, Logger, Transport } from "@axiomhq/logging";

import { SERVER_CONFIG } from "~/config.server";

const isCI = SERVER_CONFIG.isCI;
const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });
const commonArgs = { environment: SERVER_CONFIG.environment };

function buildTransports(dataset: string, level: "debug" | "info") {
  const transports: [Transport, ...Array<Transport>] = [new ConsoleTransport({ logLevel: level, prettyPrint: true })];

  // Axiom in production, or in test when running in CI
  if (SERVER_CONFIG.isProd || (SERVER_CONFIG.isTest && isCI)) {
    transports.push(new AxiomJSTransport({ axiom, logLevel: level, dataset }));
  }

  return transports;
}

const logLevel = SERVER_CONFIG.isDev ? "debug" : "info";

const serverLogger = new Logger({
  logLevel,
  args: commonArgs,
  transports: buildTransports("server", logLevel),
});

export function createLogger(module: string) {
  return serverLogger.with({ module });
}

export const httpLogger = new Logger({
  logLevel,
  args: commonArgs,
  transports: buildTransports("http", logLevel),
});
