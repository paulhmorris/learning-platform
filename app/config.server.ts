/* eslint-disable @typescript-eslint/no-unnecessary-condition */
export const SERVER_CONFIG = {
  emailFromDomain: "plumblearning.com",
  isCI: Boolean(process.env.CI),
  baseUrl: process.env.BASE_URL,
  environment: process.env.VERCEL_ENV || "development",
  isTest: process.env.NODE_ENV === "test",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.VERCEL_ENV === "production" && process.env.NODE_ENV === "production",
  isPreview: process.env.VERCEL_ENV === "preview" && process.env.NODE_ENV === "production",
  signInUrl: new URL("/sign-in", process.env.AUTH_DOMAIN),
  signUpUrl: new URL("/sign-up", process.env.AUTH_DOMAIN),
} as const;
