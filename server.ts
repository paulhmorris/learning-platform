/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-misused-promises */

import prom from "@isaacs/express-prometheus-middleware";
import { createRequestHandler } from "@remix-run/express";
import type { ServerBuild } from "@remix-run/node";
import { installGlobals } from "@remix-run/node";
import { wrapExpressCreateRequestHandler } from "@sentry/remix";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import sourceMapSupport from "source-map-support";

import { validateEnv } from "~/lib/env.server";

try {
  void run();
} catch (e) {
  console.error(e);
}

async function run() {
  sourceMapSupport.install();
  installGlobals();

  validateEnv();
  const vite =
    process.env.NODE_ENV === "production"
      ? undefined
      : await import("vite").then(async (vite) =>
          vite.createServer({
            server: { middlewareMode: true },
          }),
        );

  const app = express();
  const metricsApp = express();
  app.use(
    prom({
      metricsPath: "/metrics",
      collectDefaultMetrics: true,
      metricsApp,
    }),
  );

  app.use((req, res, next) => {
    // /clean-urls/ -> /clean-urls
    if (req.path.endsWith("/") && req.path.length > 1) {
      const query = req.url.slice(req.path.length);
      const safepath = req.path.slice(0, -1).replace(/\/+/g, "/");
      res.redirect(301, safepath + query);
      return;
    }
    next();
  });

  app.use(compression());

  // http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable("x-powered-by");

  if (vite) {
    app.use(vite.middlewares);
  } else {
    app.use(
      "/assets",
      express.static("build/client/assets", {
        immutable: true,
        maxAge: "1y",
      }),
    );
  }

  // Everything else (like favicon.ico) is cached for an hour. You may want to be
  // more aggressive with this caching.
  app.use(express.static("public", { maxAge: "1h" }));

  app.use(morgan("tiny"));

  const createHandler = vite ? createRequestHandler : wrapExpressCreateRequestHandler(createRequestHandler);
  const handlerBuild = vite
    ? () => vite.ssrLoadModule("virtual:remix/server-build") as Promise<ServerBuild>
    : ((await import("./build/server/index.js")) as unknown as ServerBuild);

  app.all("*", createHandler({ build: handlerBuild }));

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✅ app ready: http://localhost:${port}`);
  });

  const metricsPort = process.env.METRICS_PORT || 3010;

  metricsApp.listen(metricsPort, () => {
    console.log(`✅ metrics ready: http://localhost:${metricsPort}/metrics`);
  });
}
