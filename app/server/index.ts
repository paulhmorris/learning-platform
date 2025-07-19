import { createHonoServer } from "react-router-hono-server/node";

export default await createHonoServer({
  // configure(server) {
  //   server.use("*", requestId());
  //   server.use("*", loggerMiddleware());
  // },
});
