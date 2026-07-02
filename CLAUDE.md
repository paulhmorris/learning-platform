# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (port 3000). Also spawns the sibling CMS repo (`../learning-platform-cms`) in the background; that repo must be checked out beside this one.
- `npm run build` / `npm start` — production build, then run `build/server/index.js`.
- `npm run typecheck` — type check with `tsgo` (TypeScript native preview, not `tsc`). Run `npm run typegen` first if route types are stale.
- `npm run lint` (cached) / `npm run lint:prepush` (`--max-warnings=0`).
- `npm test` — Vitest (`--run`). `npm run test:watch` for watch mode. Run a single file: `npx vitest app/services/course.server.test.ts`. Filter by name: `npx vitest -t "some test name"`.
- `npm run test:e2e` — Playwright (`test/e2e/`, excluded from Vitest). `npm run test:e2e:ui` for the UI runner.
- `npm run prepush` (also the pre-push hook) — runs lint + typecheck + build + test in parallel. This is the gate; make it pass.
- `npm run copytypes` — copy Strapi's generated types from `../learning-platform-cms` into `app/types/generated/`. Run after CMS content-type changes.
- `npm run trigger` — Trigger.dev dev worker for jobs in `jobs/`.
- `npm run email:dev` — preview React Email templates from `app/emails/` (port 3001).
- Prisma: after editing `prisma/schema.prisma`, regenerate the client (`postinstall` runs `prisma generate`). Seed via `prisma db seed`.

## Architecture

React Router v7 (framework mode, SSR) served through a Hono server (`react-router-hono-server`). Deployed on Vercel.

**Multi-tenant by host.** One deployment serves many courses. Each `Course` row has a `host`; the root loader (`app/root.tsx`) resolves the current course from the request host via `CourseService.getByHost`, pulls branding from the CMS, and injects `window.ENV`. Localhost/preview hosts fall back to the first course. When touching request-scoped course logic, remember the host is the tenant key.

**Layers (follow a feature in this order):**

1. `app/routes/` — file-based routes via `flatRoutes()` (`app/routes.ts`). Dynamic segments use `$` (`_course.$lessonSlug.tsx`); API endpoints and webhooks are `api.*.ts` route files (e.g. `api.webhooks.stripe.ts`, `api.progress.ts`).
2. `app/services/*.server.ts` — business logic as singleton objects (`CourseService`, `SessionService`, etc.), each with a colocated `*.test.ts`.
3. `app/integrations/*.server.ts` — external clients (see below).

**Conventions:**

- `.server.ts` = server-only; never import into client components. `.client.ts` = client-only.
- Return HTTP responses/redirects via the `Responses` helper in `app/lib/responses.server.ts` (`Responses.notFound()`, `Responses.redirectToSignIn()`, etc.).
- Auth/role gating goes through `SessionService` (`requireAuth`, `requireUser`, `requireAdmin`, `requireSuperAdmin`); roles come from Clerk session claims (short keys like `pem`, `role`, `idV`).
- Env is validated in `app/lib/env.server.ts`; client-visible env is surfaced through `window.ENV` (set in `app/root.tsx`) and `import.meta.env.VITE_*`.
- Server singletons (DB client, etc.) use the `singleton()` helper in `db.server.ts` to survive HMR re-imports.
- `~/` path alias maps to `app/`.

**Integrations:**

- **DB:** Prisma. `app/integrations/db.server.ts` — Neon serverless adapter in prod, direct `PrismaClient` in dev. Schema `prisma/schema.prisma`. Types generated from `../learning-platform-cms` live in `app/types/generated/`.
- **CMS:** Strapi (`cms.server.ts`), a separate repo (`../learning-platform-cms`). Course content is fetched from Strapi and cached.
- **Cache:** Upstash Redis (`redis.server.ts`) wrapped by `CacheService` (`cache.server.ts`); disabled in dev/test. Keys via `CacheKeys`.
- **Auth:** Clerk (`clerk.server.ts`, `rootAuthLoader` in `app/root.tsx`).
- **Payments:** Stripe (`stripe.server.ts`, `api.purchase.ts`, `api.webhooks.stripe.ts`), plus Stripe Identity verification.
- **Jobs:** Trigger.dev (`trigger.config.ts`, jobs in `jobs/`), e.g. certificate claiming.
- **Storage/email:** R2/S3 (`bucket.server.ts`), Resend + React Email templates in `app/emails/` (`email.server.ts`).
- **Observability:** Sentry (`sentry.ts`, `instrument.server.mjs`), structured logging via `createLogger(name)` (Axiom, `logger.server.ts`). HTTP request logging in `app/server/middleware.ts` (prod only). Analytics: Mixpanel (`mixpanel.client.ts`).

**Testing:** Vitest with jsdom + Testing Library (`test/setup.ts` mocks ResizeObserver / Radix pointer APIs). UI primitives in `app/components/ui/` are excluded from coverage. Playwright e2e in `test/e2e/` with Clerk test helpers.
