/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod/v4";

const _serverEnvValidation = z.object({
  // General
  SITE_URL: z.url(),

  // Remix
  SESSION_SECRET: z.string().min(16),

  // Strapi
  STRAPI_TOKEN: z.string().min(1),
  STRAPI_URL: z.url(),

  // AWS
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),

  // Cloudflare
  R2_BUCKET_NAME: z.string().min(1),
  R2_BUCKET_URL: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.url(),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().startsWith("tr_"),

  // Stripe
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // Upstash
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

const _clientEnvValidation = z.object({
  STRAPI_URL: z.url(),
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]),
  VERCEL_GIT_COMMIT_SHA: z.string(),
});

declare global {
  // Server side
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends z.infer<typeof _serverEnvValidation & typeof _clientEnvValidation> {}
  }

  // Client side
  interface Window {
    ENV: z.infer<typeof _clientEnvValidation>;
  }

  // Vite
  interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    readonly VITE_CLERK_SIGN_IN_URL: string;
    readonly VITE_CLERK_SIGN_UP_URL: string;
    readonly VITE_CLERK_SIGN_IN_FORCE_REDIRECT_URL: string;
    readonly VITE_CLERK_SIGN_UP_FORCE_REDIRECT_URL: string;
    readonly VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: string;
    readonly VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
