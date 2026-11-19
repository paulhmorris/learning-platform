import Strapi from "strapi-sdk-js";

import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("CMS");

const SLOW_REQUEST_MS = 2_000;
const SPAN_STATUS_ERROR = 2;

export const cms = new Strapi({
  url: process.env.STRAPI_URL,
  axiosOptions: {
    timeout: 8_000,
    headers: {
      Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
    },
  },
});

type RequestConfig = Parameters<Parameters<typeof cms.axios.interceptors.request.use>[0] & {}>[0];
type InFlight = { span: ReturnType<typeof Sentry.startInactiveSpan>; start: number };

const inFlight = new WeakMap<object, InFlight>();

function describe(config: RequestConfig) {
  const method = (config.method ?? "get").toUpperCase();
  const path = config.url ?? "";
  const params = config.params as { filters?: { slug?: unknown } } | undefined;
  const slug = params?.filters?.slug;
  return {
    method,
    path,
    contentType: path.split("/")[1],
    slug: typeof slug === "string" ? slug : undefined,
  };
}

function traceHeaders(headers: Record<string, unknown> | undefined) {
  return {
    "cms.cf_ray": headers?.["cf-ray"] as string | undefined,
    "cms.railway_request_id": headers?.["x-railway-request-id"] as string | undefined,
  };
}

cms.axios.interceptors.request.use((config) => {
  const { method, path, contentType, slug } = describe(config);
  const span = Sentry.startInactiveSpan({
    op: "http.client",
    name: `${method} ${path}`,
    attributes: {
      "http.request.method": method,
      "url.path": path,
      "cms.content_type": contentType,
      "cms.slug": slug,
    },
  });
  inFlight.set(config, { span, start: performance.now() });
  return config;
});

cms.axios.interceptors.response.use(
  (response) => {
    const request = inFlight.get(response.config);
    if (request) {
      const durationMs = Math.round(performance.now() - request.start);
      const ids = traceHeaders(response.headers);
      request.span.setAttributes({ "http.response.status_code": response.status, ...ids });
      request.span.end();

      if (durationMs > SLOW_REQUEST_MS) {
        logger.warn("Slow CMS request", { ...describe(response.config), durationMs, ...ids });
      }
    }
    return response;
  },
  (error: {
    code?: string;
    message?: string;
    config?: RequestConfig;
    response?: { status: number; headers?: Record<string, unknown>; data?: unknown };
  }) => {
    const request = error.config && inFlight.get(error.config);
    const durationMs = request && Math.round(performance.now() - request.start);
    const status = error.response?.status;
    const ids = traceHeaders(error.response?.headers);

    if (request) {
      request.span.setAttributes({ "http.response.status_code": status, "error.type": error.code, ...ids });
      request.span.setStatus({ code: SPAN_STATUS_ERROR, message: error.code ?? "internal_error" });
      request.span.end();
    }

    const body = error.response?.data;
    logger.error("CMS request failed", {
      ...(error.config && describe(error.config)),
      status,
      code: error.code,
      message: error.message,
      durationMs,
      bodyPreview: (typeof body === "string" ? body : JSON.stringify(body))?.slice(0, 200),
      ...ids,
    });

    return Promise.reject(error);
  },
);
