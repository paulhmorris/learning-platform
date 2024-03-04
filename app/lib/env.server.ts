/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { loadEnv } from "vite";
import { TypeOf, z } from "zod";

const serverEnvValidation = z.object({
  // Remix
  SESSION_SECRET: z.string().min(16),
  SITE_URL: z.string().url().optional(),

  // Strapi
  STRAPI_TOKEN: z.string().min(1),

  // Resend
  // RESEND_API_KEY: z.string().startsWith("re_"),

  // Cloudflare
  // AWS_BUCKET_NAME: z.string().min(1),
  // AWS_BUCKET_URL: z.string().url(),
  // AWS_ACCESS_KEY_ID: z.string().min(1),
  // AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string().min(1),

  // Sentry
  SENTRY_DSN: z.string().url(),

  // Trigger.dev
  TRIGGER_API_KEY: z.string().startsWith("tr_"),
  TRIGGER_PUBLIC_API_KEY: z.string().startsWith("pk_"),
  TRIGGER_API_URL: z.string().url(),

  // Stripe
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
});

const clientEnvValidation = z.object({
  // Trigger.dev
  STRAPI_URL: z.string().url(),
  // TRIGGER_PUBLIC_API_KEY: z.string().startsWith("pk_"),
});

const deploymentPublicEnvValidation = z.object({
  // Vercel
  VERCEL_URL: z.string(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]),
});

declare global {
  // Server side
  namespace NodeJS {
    interface ProcessEnv
      extends TypeOf<typeof serverEnvValidation & typeof clientEnvValidation & typeof deploymentPublicEnvValidation> {}
  }

  // Client side
  interface Window {
    ENV: TypeOf<typeof clientEnvValidation & typeof deploymentPublicEnvValidation>;
  }
}

export function validateEnv(): void {
  try {
    const env = loadEnv("", process.cwd(), "");
    console.info("🌎 validating environment variables..");
    serverEnvValidation.parse(env);
    clientEnvValidation.parse(env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { fieldErrors } = err.flatten();
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => (errors ? `${field}: ${errors.join(", ")}` : field))
        .join("\n  ");
      throw new Error(`Missing environment variables:\n  ${errorMessage}`);
    }
  }
}
