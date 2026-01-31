# E2E test plan

## Goals

- Validate core learning, purchase, and admin workflows from the browser.
- Catch integration regressions across auth, CMS/DB data, and Stripe.

## Environments & identities

- Roles: Anonymous, Student, Admin.
- Use seeded data or fixtures for deterministic courses, lessons, quizzes, and users.
- Prefer test-only Clerk users and Stripe test mode.
- Use API/network stubs only when third-party UIs or webhooks are in the flow.

## Existing coverage

- Auth page access: [test/e2e/sign-up-flow.spec.ts](test/e2e/sign-up-flow.spec.ts)
- Smoke + theme + account navigation: [test/e2e/smoke.spec.ts](test/e2e/smoke.spec.ts)
- Lesson start flow basics: [test/e2e/start-lesson-flow.spec.ts](test/e2e/start-lesson-flow.spec.ts)

## Planned flows

### Auth & onboarding

1. Sign up end-to-end (email + password) → redirected to preview or first lesson.
2. Sign in with existing user → lands on last visited lesson or preview.
3. Sign out → session cleared and protected routes redirect to sign in.
4. Password reset flow (request + complete) → successful login with new password.
5. Session timeout handling → protected pages redirect to sign in.

**Mocks needed**

- Clerk hosted UI and callbacks if running offline: stub `/sign-in`, `/sign-up`, `/sso-callback` pages or use Clerk test instance.
- Email delivery for password reset: mock email provider or use Clerk test inbox.
- Session expiration: mock server session cookie or API response from `SessionService`.

### Course discovery & preview

1. Preview page loads with course overview and sections.
2. “Up next” matches first unlocked lesson.
3. Locked lessons visually disabled for new users.
4. Navigate between sections on preview page.

**Mocks needed**

- Strapi course/lesson payloads via `CourseService` cache: fixture JSON for course, sections, lessons.
- Redis cache disabled in test or mocked to avoid cross-test leakage.

### Learning flow (lessons)

1. Start first lesson from preview → lesson page renders title and content.
2. Progress updates when completing a lesson (server update + UI).
3. Navigate lesson → next/previous buttons advance correctly.
4. Resume flow: revisit app → returns to last in-progress lesson.

**Mocks needed**

- Lesson content payloads from Strapi (text, media URLs, quiz links).
- Progress API (`/api.progress`) responses: success + updated progress state.
- Optional media asset URLs: stub to prevent external fetch failures.

### Quizzes

1. Start quiz from lesson/section.
2. Answer selection persists and submit succeeds.
3. Score/results rendered with pass/fail state.
4. Quiz unlocks subsequent content if applicable.

**Mocks needed**

- Quiz payloads (questions, options, correct answers) via fixtures.
- Quiz submit API response (score, pass/fail, unlock flags).

### Certificates

1. Complete course + reach certificate page.
2. Claim certificate flow completes (including identity verification if required).
3. Certificate download or view link works.

**Mocks needed**

- Certificate eligibility and claim API response.
- Identity verification status from `/api.identity-verification`.
- Download URL stub (signed URL or static test asset).

### Purchases & entitlements

1. Purchase CTA visible for locked course.
2. Checkout redirect to Stripe (test mode) and success return.
3. Success modal and enrollment status updated.
4. Canceled checkout returns to app with canceled state.

**Mocks needed**

- Stripe Checkout session creation (`/api.purchase`) response.
- Stripe success/cancel redirect URLs (use test mode or stub).
- Stripe webhook handling (`/api.webhooks.stripe`) in test to grant entitlements.

### Account management

1. Update profile fields and save (name, avatar if available).
2. Security: change password / MFA setup if enabled.
3. Identity verification flow (if required) persists status.
4. Courses tab shows enrollments and progress.

**Mocks needed**

- Profile update API response.
- Clerk security/MFA UI or mocked endpoints if not using live Clerk.
- Enrollment/progress payload for courses tab.

### Theme & preferences

1. Theme switch persists across reloads.
2. System theme respects OS preference.

**Mocks needed**

- None if persisted via `localStorage`/cookies; otherwise stub `/api.set-theme` response.

### Admin

1. Admin login → admin dashboard access.
2. Courses list loads with pagination/filters.
3. Create course → appears in list.
4. Edit course → updates persisted fields.
5. View course users → assignments visible.
6. User detail page → courses and progress visible.
7. Assign/unenroll user from course (if available).

**Mocks needed**

- Admin auth role (seeded admin user or mocked Clerk role claim).
- Course CRUD API responses (create/update/list) with fixtures.
- User/course assignment API responses.

### API/operational checks (optional E2E)

1. Healthcheck route returns OK.
2. Webhook endpoints reject unauthenticated requests (smoke only).

**Mocks needed**

- None for healthcheck.
- Stripe/Clerk webhook payload fixtures for negative-path tests.

## Prioritization

- P0: Auth, start lesson, progress update, purchase success/cancel, certificate claim.
- P1: Quizzes, resume flow, account updates, admin course edit.
- P2: Theme persistence, healthcheck/webhook smoke.

## Notes

- Avoid flaky assertions on timing; rely on role-based locators and server confirmations.
- Prefer deterministic fixtures and seed data for consistent lesson ordering.
- Use `test.use({ storageState })` for authenticated roles.
