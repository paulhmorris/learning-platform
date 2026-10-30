// eslint-disable-next-line import/order
import { GeoMiddleware } from "hono-geo-middleware";
import { requestId } from "hono/request-id";
import { handle } from "hono/vercel";
import { createHonoServer } from "react-router-hono-server/node";

import {
  coldStartMiddleware,
  forwardedProtoMiddleware,
  loggerMiddleware,
  unknownPathMiddleware,
} from "~/server/middleware";

const isVercel = process.env.VERCEL === "1";

const server = await createHonoServer({
  configure(_server) {
    _server.use(coldStartMiddleware());
    _server.use(unknownPathMiddleware(async () => (await import("virtual:react-router/server-build")).routes));
    _server.use(forwardedProtoMiddleware());
    _server.use(requestId());
    _server.use(GeoMiddleware());
    _server.use(loggerMiddleware());
  },
});

export default isVercel ? handle(server) : server;
