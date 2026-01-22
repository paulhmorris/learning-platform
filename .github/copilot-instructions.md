# Copilot instructions for learning-platform

## Architecture & data flow

- React Router v7 with file-based routes; `app/routes.ts` uses `flatRoutes()` and route files live in `app/routes/` (e.g., `_course.$lessonSlug.tsx` for dynamic segments). API endpoints are also route files named `api.*` in `app/routes/`.
- Root loader (`app/root.tsx`) wires Clerk SSR (`rootAuthLoader`), session/user lookup (`SessionService`), theme (`themeSessionResolver`), and course data (`CourseService`). It also injects `window.ENV` for client env usage.
- Server entry (`app/entry.server.ts`) wraps requests with Sentry and `createLogger`, and skips `.well-known` errors.

## Data & service boundaries

- DB access is Prisma via a singleton in `app/integrations/db.server.ts` (Neon adapter in prod, direct Prisma client in dev). Schema lives in `prisma/schema.prisma`.
- CMS is Strapi via `app/integrations/cms.server.ts`; `CourseService` caches Strapi + DB responses in `CacheService` (see `app/services/course.server.ts`).
- Cache is Upstash Redis (`app/integrations/redis.server.ts`) and is disabled in dev/test (`app/services/cache.server.ts`).

## Project-specific conventions

- Files ending in `.server.ts` are server-only; do not import them into client components.
- Use `Responses` helpers from `app/lib/responses.server.ts` for status responses and redirects (used by services and route actions).
- Env schema is defined in `app/lib/env.server.ts`; client env is surfaced via `window.ENV` and `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`.

## External integrations (entry points)

- Auth: Clerk in `app/integrations/clerk.server.ts` and `app/services/session.server.ts`.
- Payments: Stripe in `app/integrations/stripe.server.ts` and `app/routes/api.purchase.ts`.
- Observability: Sentry in `app/integrations/sentry.ts`, logger in `app/integrations/logger.server.ts`.
- Storage/email: R2/S3 in `app/integrations/bucket.server.ts`, Resend in `app/integrations/email.server.ts`.
- Jobs/queues: Trigger.dev via `trigger.config.ts` and `npm run trigger`.

## Developer workflows (from package.json)

- Dev server: `npm run dev` (react-router dev).
- Build + run: `npm run build` then `npm start` (runs `build/server/index.js`).
- Types: `npm run typegen` and `npm run typecheck`.
- Tests: `npm test` (Vitest) and `npm run test:e2e` (Playwright).
- Postinstall runs `prisma generate` and `patch-package`.

## When changing a feature

- Start with its route file in `app/routes/`, then follow into `app/services/*` and `app/integrations/*`.
- For DB changes update `prisma/schema.prisma`, then regenerate Prisma client.

If any section is unclear or missing (e.g., specific routes, auth flows, or job pipelines), tell me what to expand.
