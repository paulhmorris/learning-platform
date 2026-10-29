import { SERVER_CONFIG } from "~/config.server";
import { Sentry } from "~/integrations/sentry";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogAttributes = Record<string, unknown>;
type LogFn = (message: string, attributes?: LogAttributes) => void;
export type ServerLogger = Record<LogLevel, LogFn>;

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Emit debug and up in dev; otherwise honor LOG_LEVEL (default "info").
const minLevel: LogLevel = SERVER_CONFIG.isDev ? "debug" : (process.env.LOG_LEVEL ?? "info");

const consoleLog: Record<LogLevel, (...args: Array<unknown>) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Under test (vitest sets NODE_ENV=test, Playwright sets PLAYWRIGHT_TEST) logs stay on stdout
// only — test runs shouldn't add noise or cost to Sentry Logs.
const sentryEnabled = !SERVER_CONFIG.isTest;

const sentryLog: Record<LogLevel, (message: string, attributes?: LogAttributes) => void> = {
  debug: (message, attributes) => Sentry.logger.debug(message, attributes),
  info: (message, attributes) => Sentry.logger.info(message, attributes),
  warn: (message, attributes) => Sentry.logger.warn(message, attributes),
  error: (message, attributes) => Sentry.logger.error(message, attributes),
};

// Sentry log attributes are meant to be primitives. Flatten Errors to their message
// (plus a separate `.stack` attribute) and JSON-encode any remaining objects so nested
// data is preserved rather than serialized as "[object Object]".
function normalizeAttributes(attributes: LogAttributes): LogAttributes {
  const normalized: LogAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value instanceof Error) {
      normalized[key] = value.message;
      if (value.stack) normalized[`${key}.stack`] = value.stack;
    } else if (value !== null && typeof value === "object") {
      normalized[key] = JSON.stringify(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

export function createLogger(module: string): ServerLogger {
  const at =
    (level: LogLevel): LogFn =>
    (message, attributes) => {
      if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

      consoleLog[level](`[${module}] ${message}`, attributes ?? "");

      if (sentryEnabled) {
        sentryLog[level](message, { module, ...(attributes && normalizeAttributes(attributes)) });
      }
    };

  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

export const httpLogger = createLogger("Http");
