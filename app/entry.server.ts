// oxlint-disable-next-line import/no-unassigned-import
import "../instrument.server.mjs";
import { createReadableStreamFromReadable } from "@react-router/node";
import * as Sentry from "@sentry/react-router";
import { renderToPipeableStream } from "react-dom/server";
import type { HandleErrorFunction } from "react-router";
import { ServerRouter } from "react-router";

import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("ServerEntry");

// Stale, content-hashed asset requests (e.g. /assets/index-XLjWcFRZ.js.map) hit the
// server after a deploy when a client is still running old code. React Router surfaces
// these as an ErrorResponse (not an Error instance), with the message on `.data`.
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") {
    return error.data;
  }
  return "";
}

export const handleError: HandleErrorFunction = (error, { request }) => {
  const isMissingAssetSourceMap =
    request.url.includes("/assets/") &&
    request.url.endsWith(".map") &&
    errorMessage(error).includes("No route matches URL");

  if (isMissingAssetSourceMap || request.url.includes(".well-known")) {
    return;
  }

  if (!request.signal.aborted) {
    Sentry.captureException(error);
    logger.error("Request handling error", {
      error,
      url: request.url,
      method: request.method,
    });
  }
};

const handleRequest = Sentry.createSentryHandleRequest({
  ServerRouter,
  renderToPipeableStream,
  createReadableStreamFromReadable,
});

export default handleRequest;
