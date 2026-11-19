import { createCookieSessionStorage } from "react-router";
import { createThemeAction, createThemeSessionResolver } from "remix-themes";
import invariant from "tiny-invariant";

const { THEME_COOKIE_SECRET } = process.env;
invariant(THEME_COOKIE_SECRET, "THEME_COOKIE_SECRET env var not set");

const themeSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__plumb_theme",
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secrets: [THEME_COOKIE_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const themeSessionResolver = createThemeSessionResolver(themeSessionStorage);
export const action = createThemeAction(themeSessionResolver);
