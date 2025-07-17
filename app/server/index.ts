import { createHonoServer } from "react-router-hono-server/node";

import { loggerMiddleware } from "~/server/middleware";

export default await createHonoServer({
  configure(server) {
    server.use("*", loggerMiddleware());
  },
});
