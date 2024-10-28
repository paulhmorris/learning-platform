import { User } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";
import { useMatches, useRouteLoaderData } from "@remix-run/react";
import type { Attribute } from "@strapi/strapi";
import clsx, { ClassValue } from "clsx";
import { useMemo } from "react";
import { twMerge } from "tailwind-merge";

import { loader } from "~/root";

const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT,
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(id: string): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(() => matchingRoutes.find((route) => route.id === id), [matchingRoutes, id]);
  return route?.data as Record<string, unknown>;
}

function isUser(user: unknown): user is User {
  return user != null && typeof user === "object" && "email" in user && typeof user.email === "string";
}

export function useOptionalUser() {
  const data = useRouteLoaderData<typeof loader>("root");
  if (!data || !isUser(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): NonNullable<SerializeFrom<typeof loader>["user"]> {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.",
    );
  }
  return maybeUser;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

export function getSearchParam(param: string, request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get(param);
}

export function getAllSearchParams(param: string, request: Request) {
  const url = new URL(request.url);
  return url.searchParams.getAll(param);
}

export function getStrapiImgSrcSetAndSizes(formats: Attribute.JsonValue | undefined) {
  if (!formats) {
    return {
      srcSet: "",
      sizes: "",
    };
  }

  return {
    srcSet: Object.entries(formats)
      .map(([_key, value]) => {
        if ("url" in value && "width" in value) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return `${value.url} ${value.width}w`;
        }
      })
      .join(", "),
    sizes: Object.entries(formats)
      .map(([_key, value]) => {
        if ("url" in value && "width" in value) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return `(max-width: ${value.width}px) ${value.width}px`;
        }
      })
      .join(", "),
  };
}

export function valueIsNotNullishOrZero<T>(value: T | null | undefined): value is T {
  return value !== null && value !== 0;
}

export function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function normalizeSeconds(seconds: number) {
  if (seconds <= 3600) {
    return `${Math.floor(seconds / 60)} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
  }
}

export function hexToPartialHSL(H: string | undefined) {
  if (!H) {
    return null;
  }
  // Convert hex to RGB first
  let r: string | number = 0,
    g: string | number = 0,
    b: string | number = 0;
  if (H.length == 4) {
    r = parseInt("0x" + H[1] + H[1]);
    g = parseInt("0x" + H[2] + H[2]);
    b = parseInt("0x" + H[3] + H[3]);
  } else if (H.length == 7) {
    r = parseInt("0x" + H[1] + H[2]);
    g = parseInt("0x" + H[3] + H[4]);
    b = parseInt("0x" + H[5] + H[6]);
  }

  // Then to HSL
  r /= 255;
  g /= 255;
  b /= 255;
  const cmin = Math.min(r, g, b),
    cmax = Math.max(r, g, b),
    delta = cmax - cmin;

  let h = 0,
    s = 0,
    l = 0;

  if (delta == 0) h = 0;
  else if (cmax == r) h = ((g - b) / delta) % 6;
  else if (cmax == g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);

  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return `${h} ${s}% ${l}%`;
}
