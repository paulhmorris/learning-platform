import { nanoid } from "nanoid";
import { createCookieSessionStorage } from "react-router";
import { createThemeAction, createThemeSessionResolver } from "remix-themes";

const themeSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__plumb_theme",
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secrets: [nanoid(32)],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const themeSessionResolver = createThemeSessionResolver(themeSessionStorage);
export const action = createThemeAction(themeSessionResolver);
