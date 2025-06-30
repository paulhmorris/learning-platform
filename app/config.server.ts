export const CONFIG = {
  EMAIL_FROM_DOMAIN: "hiphopdriving.com",
  isCI: Boolean(process.env.CI),
  baseUrl: process.env.BASE_URL,
  isTest: process.env.NODE_ENV === "test",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.VERCEL_ENV === "production" && process.env.NODE_ENV === "production",
  isPreview: process.env.VERCEL_ENV === "preview" && process.env.NODE_ENV === "production",
};
