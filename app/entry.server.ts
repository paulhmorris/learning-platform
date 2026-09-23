// oxlint-disable-next-line import/no-unassigned-import
import "../instrument.server.mjs";
import { createReadableStreamFromReadable } from "@react-router/node";
import * as Sentry from "@sentry/react-router";
import { renderToPipeableStream } from "react-dom/server";
import type { HandleErrorFunction } from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";

import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("ServerEntry");

/** Unmatched URLs and POSTs to action-less routes, mostly bot scans (/wp-json, /.git/config) and stale asset maps. */
const IGNORED_ROUTE_STATUSES = [404, 405];

export const handleError: HandleErrorFunction = (error, { request }) => {
  if (isRouteErrorResponse(error) && IGNORED_ROUTE_STATUSES.includes(error.status)) {
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
