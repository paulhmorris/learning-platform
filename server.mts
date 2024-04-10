/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as fs from "node:fs";

import { createRequestHandler } from "@remix-run/express";
import type { ServerBuild } from "@remix-run/node";
import { installGlobals } from "@remix-run/node";
import { wrapExpressCreateRequestHandler } from "@sentry/remix";
import chalk from "chalk";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import sourceMapSupport from "source-map-support";

import { validateEnv } from "./app/lib/env.server.js";

const start = Date.now();

sourceMapSupport.install();
installGlobals();
validateEnv();

let viteVersion: any;
let remixVersion: any;
if (process.env.NODE_ENV !== "production") {
  // get the vite version from the vite package.json
  viteVersion = JSON.parse(fs.readFileSync("node_modules/vite/package.json") as unknown as string).version;
  remixVersion = JSON.parse(fs.readFileSync("node_modules/@remix-run/dev/package.json") as unknown as string).version;
}

const vite =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then(async ({ createServer }) =>
        createServer({
          server: {
            middlewareMode: true,
          },
        }),
      );

const app = express();

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
  app.use(morgan("tiny"));
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

const createHandler = vite ? createRequestHandler : wrapExpressCreateRequestHandler(createRequestHandler);
const handlerBuild = vite
  ? () => vite.ssrLoadModule("virtual:remix/server-build") as Promise<ServerBuild>
  : ((await import("./build/server/index.js")) as unknown as ServerBuild);

app.all("*", createHandler({ build: handlerBuild }));

const port = (process.env.PORT || 3000) as number;
app.listen(port, "0.0.0.0", () => {
  if (process.env.NODE_ENV === "production") {
    console.log("http://localhost:" + port);
  } else {
    // since we're using a custom server, emulate what vite dev server prints

    const elapsed = Date.now() - start;

    console.log(
      `  ${chalk.greenBright.bold("VITE")} ${chalk.green(
        `v${viteVersion}`,
      )} ${chalk.blueBright.bold("Remix")} ${chalk.blue(`v${remixVersion}`)} ready in ${chalk.bold(elapsed)} ms`,
    );
    console.log();
    console.log(
      `  ${chalk.greenBright.bold("➜")}  ${chalk.bold("Local:")}   ${chalk.cyan("http://localhost:" + port)}`,
    );
    console.log();
  }
});
