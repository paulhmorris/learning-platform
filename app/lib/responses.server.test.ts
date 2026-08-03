import { redirect } from "react-router";
import { describe, expect, it } from "vitest";

import { getResponseStatus, isResponseLike, Responses } from "./responses.server";

describe("isResponseLike", () => {
  it("is true for real Response objects", () => {
    expect(isResponseLike(new Response("ok"))).toBe(true);
  });

  it("is true for redirects", () => {
    expect(isResponseLike(redirect("/preview"))).toBe(true);
  });

  it("is true for Responses helpers, which `instanceof Response` misses", () => {
    // This is the whole reason the helper exists: `Responses.*` is built on
    // react-router's `data()`, which is NOT a Response.
    expect(Responses.notFound() instanceof Response).toBe(false);
    expect(isResponseLike(Responses.notFound())).toBe(true);
    expect(isResponseLike(Responses.forbidden())).toBe(true);
    expect(isResponseLike(Responses.serverError())).toBe(true);
  });

  it("is false for errors and other values", () => {
    expect(isResponseLike(new Error("boom"))).toBe(false);
    expect(isResponseLike(null)).toBe(false);
    expect(isResponseLike(undefined)).toBe(false);
    expect(isResponseLike("nope")).toBe(false);
    expect(isResponseLike({ type: "something-else" })).toBe(false);
  });
});

describe("getResponseStatus", () => {
  it("reads the status off a real Response", () => {
    expect(getResponseStatus(new Response("nope", { status: 418 }))).toBe(418);
    expect(getResponseStatus(redirect("/preview"))).toBe(302);
  });

  it("reads the status off Responses helpers", () => {
    expect(getResponseStatus(Responses.notFound())).toBe(404);
    expect(getResponseStatus(Responses.forbidden())).toBe(403);
    expect(getResponseStatus(Responses.created())).toBe(201);
  });
});
