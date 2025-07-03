import { createCookieSessionStorage } from "react-router";
import { createThemeAction, createThemeSessionResolver } from "remix-themes";

const themeSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__plumb_theme",
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  },
});

const themeSessionResolver = createThemeSessionResolver(themeSessionStorage);
export const action = createThemeAction(themeSessionResolver);
