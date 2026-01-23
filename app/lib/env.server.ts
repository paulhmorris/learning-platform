/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod/v4";

import { UserRole } from "~/config";

const _serverEnvValidation = z.object({
  // Clerk
  AUTH_DOMAIN: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  // Axiom
  AXIOM_TOKEN: z.string().min(1),

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

  // Resend
  RESEND_API_KEY: z.string().min(1),

  // Upstash
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Playwright
  E2E_USER_EMAIL: z.email(),
  E2E_USER_PASSWORD: z.string(),
  E2E_BASE_URL: z.string().optional(),
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
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Clerk Session Claims
  // {
  // 	"fn": "{{user.first_name}}",
  // 	"ln": "{{user.last_name}}",
  // 	"eid": "{{user.external_id}}",
  // 	"pem": "{{user.primary_email_address}}",
  // 	"phn": "{{user.primary_phone_number}}",
  //  "role": "{{user.public_metadata.role}}",
  // 	"strpId": "{{user.public_metadata.stripeCustomerId}}",
  // 	"strpIdV": "{{user.public_metadata.stripeVerificationSessionId}}",
  // 	"idV": "{{user.public_metadata.isIdentityVerified}}",
  // }
  interface CustomJwtSessionClaims {
    /** Primary email address */
    pem: string;
    /** First name */
    fn: string;
    /** Last name */
    ln: string;
    /** Phone number */
    phn: string | null;
    /** External ID */
    eid: string | null;
    /** Stripe customer ID */
    strpId: string | null;
    /** Stripe Identity Verification session id */
    strpIdV: string | null;
    /** User has had their identity verified */
    idV: boolean | null;
    /** User role */
    role: UserRole | null;
  }

  interface UserPublicMetadata {
    role?: UserRole;
    stripeCustomerId?: string | null;
    isIdentityVerified?: boolean;
    stripeVerificationSessionId?: string | null;
  }
}
