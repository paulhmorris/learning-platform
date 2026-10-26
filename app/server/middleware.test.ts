// @vitest-environment node
import { Hono } from "hono";

import { forwardedProtoMiddleware, unknownPathMiddleware } from "~/server/middleware";

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

describe("unknownPathMiddleware", () => {
  const routes = {
    root: { id: "root", path: "" },
    "routes/_index": { id: "routes/_index", parentId: "root", index: true },
    "routes/_course": { id: "routes/_course", parentId: "root" },
    "routes/_course.$lessonSlug": { id: "routes/_course.$lessonSlug", parentId: "routes/_course", path: ":lessonSlug" },
    "routes/sign-in.$": { id: "routes/sign-in.$", parentId: "root", path: "sign-in/*" },
  } as never;

  function createGuardedApp() {
    const app = new Hono();
    app.use(unknownPathMiddleware(() => Promise.resolve(routes)));
    app.all("*", (c) => c.text("app"));
    return app;
  }

  it.each(["/", "/_root.data", "/intro-to-driving", "/intro-to-driving.data", "/sign-in/sso-callback"])(
    "passes %s through",
    async (path) => {
      const res = await createGuardedApp().request(path);
      expect(await res.text()).toBe("app");
    },
  );

  it.each(["/.env", "/wp-login.php", "/.git/config", "/wp-admin/setup-config.php", "/sign-in/../.env"])(
    "404s %s",
    async (path) => {
      const res = await createGuardedApp().request(path);
      expect(res.status).toBe(404);
    },
  );
});
