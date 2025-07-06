/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@axiomhq/pino";
import pino from "pino";
import { unstable_MiddlewareFunction } from "react-router";

import { CONFIG } from "~/config.server";

const devTransport: pino.TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    ignore: "pid,hostname",
  },
};

const serverLogger = pino(
  {
    transport: CONFIG.isDev ? devTransport : undefined,
    level: CONFIG.isDev ? "debug" : (process.env.LOG_LEVEL ?? "info"),
  },
  CONFIG.isDev
    ? undefined
    : pino.transport({
        target: "@axiomhq/pino",
        options: {
          dataset: process.env.AXIOM_DATASET_SERVER,
          token: process.env.AXIOM_TOKEN,
        },
      }),
);

export function createLogger(name?: string) {
  return serverLogger.child({
    name: name ?? "Global",
    env: CONFIG.environment,
  });
}

export function createHttpLogger() {
  return pino(
    {
      transport: CONFIG.isDev ? devTransport : undefined,
      level: CONFIG.isDev ? "debug" : (process.env.LOG_LEVEL ?? "info"),
    },
    CONFIG.isDev
      ? undefined
      : pino.transport({
          target: "@axiomhq/pino",
          options: {
            dataset: process.env.AXIOM_DATASET_HTTP,
            token: process.env.AXIOM_TOKEN,
          },
        }),
  );
}

export const logger = createLogger();

const _httpLogger = createHttpLogger();

export const httpLogger: unstable_MiddlewareFunction = async ({ request }, next) => {
  const start = performance.now();

  const response = (await next()) as Response;

  const duration = performance.now() - start;

  const headers = new Headers(request.headers);
  if (CONFIG.isDev) {
    headers.delete("cookie");
  }

  const requestData = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(headers.entries()),
    duration: Math.round(duration),
    status: response.status,
    statusText: response.statusText,
  };

  if (response.status <= 299) {
    _httpLogger.info(requestData, "Request completed");
  }

  if (response.status >= 400) {
    _httpLogger.warn(requestData, "Request completed with error");
  }

  if (response.status >= 500) {
    _httpLogger.error(requestData, "Request failed");
  }

  return response;
};
