// @vitest-environment node
import { Hono } from "hono";

import { forwardedProtoMiddleware } from "~/server/middleware";

function createApp() {
  const app = new Hono();
  app.use(forwardedProtoMiddleware());
  app.post("/", async (c) => c.json({ url: c.req.raw.url, body: await c.req.raw.text() }));
  return app;
}

describe("forwardedProtoMiddleware", () => {
  it("rewrites http to https when the proxy says the request was https", async () => {
    const res = await createApp().request("http://example.com/?a=1", {
      method: "POST",
      body: "payload",
      headers: { "x-forwarded-proto": "https" },
    });
    expect(await res.json()).toEqual({ url: "https://example.com/?a=1", body: "payload" });
  });

  it("leaves the URL alone without the header", async () => {
    const res = await createApp().request("http://example.com/", { method: "POST", body: "" });
    expect(await res.json()).toEqual({ url: "http://example.com/", body: "" });
  });
});
