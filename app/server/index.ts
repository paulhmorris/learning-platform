import { requestId } from "hono/request-id";
import { handle } from "hono/vercel";
import { createHonoServer } from "react-router-hono-server/node";

import { loggerMiddleware } from "~/server/middleware";

export default handle(
  await createHonoServer({
    configure(server) {
      server.use(requestId());
      server.use(loggerMiddleware());
    },
  }),
);
