import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, Logger } from "@axiomhq/logging";
import { next, waitUntil } from "@vercel/functions";

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!assets|favicon|site.webmanifest|.well-known).*)"],
};

const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });
const logger = new Logger({
  transports: [new AxiomJSTransport({ axiom, dataset: "requests" }), new ConsoleTransport()],
});

export default function middleware(request: Request) {
  // const reqIsFromBot = request.headers.get("cf-isbot") === "true" || isbot(request.headers.get("user-agent") ?? "");
  // const geo = geolocation(request);

  // const logData: Record<string, unknown> = {
  //   content_type: request.headers.get("content-type"),
  //   geo: {
  //     city: geo.city ?? request.headers.get("cf-ipcity"),
  //     country: geo.country ?? request.headers.get("cf-ipcountry"),
  //   },
  //   id: request.headers.get("x-request-id"),
  //   ip: ipAddress(request),
  //   isbot: reqIsFromBot,
  //   method: request.method,
  //   uri: request.url,
  //   user_agent: request.headers.get("user-agent"),
  // };

  logger.info("http", { test: true });
  waitUntil(logger.flush());
  return next();
}
