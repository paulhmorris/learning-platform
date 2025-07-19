import { requestId } from "hono/request-id";
import { createHonoServer } from "react-router-hono-server/node";

import { loggerMiddleware } from "~/server/middleware";

console.log("Server starting...");

export default await createHonoServer({
  configure(server) {
    server.use("*", requestId());
    server.use("*", loggerMiddleware());
  },
});
