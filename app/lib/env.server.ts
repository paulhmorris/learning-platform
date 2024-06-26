/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { loadEnv } from "vite";
import { TypeOf, z } from "zod";

const serverEnvValidation = z.object({
  // Remix
  SESSION_SECRET: z.string().min(16),

  // Strapi
  STRAPI_TOKEN: z.string().min(1),
  STRAPI_URL: z.string().url(),

  // AWS
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),

  // Cloudflare
  R2_BUCKET_NAME: z.string().min(1),
  R2_BUCKET_URL: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string().url(),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().startsWith("tr_"),

  // Stripe
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // Upstash
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

const clientEnvValidation = z.object({
  STRAPI_URL: z.string().url(),
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
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
