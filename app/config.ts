export const COMPANY_NAME = "LearnIt" as const;
export const DOMAIN = new URL(process.env.SITE_URL ?? process.env.VERCEL_URL);
export const META = {
  titleSuffix: COMPANY_NAME,
  description: "A learning platform for the modern web.",
};
