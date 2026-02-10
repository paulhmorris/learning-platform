# Mixpanel Events Summary (Non‑Technical)

This document lists the user-facing moments we track in Mixpanel.

## Sign‑in and Sign‑up

- sign_in_started: Someone opens the sign‑in page.
- sign_in_completed: A sign‑in finishes successfully.
- sign_up_started: Someone opens the sign‑up page.
- sign_up_completed: A sign‑up finishes successfully.

## Preview and Purchase

- preview_viewed: Someone views a course preview page. We also note which course it was and whether the person already has access.
- purchase_cta_clicked: Someone clicks the “Enroll” button on the preview page.
- purchase_success: A purchase finishes successfully on the preview page.
- purchase_canceled: A purchase is canceled or abandoned and the user returns to preview.

## Lessons

- lesson_started: A lesson page is opened for the first time in a session.
- lesson_completed: A lesson is marked complete.

## Quizzes

- quiz_started: A quiz page is opened when the quiz is unlocked.
- quiz_completed: A quiz is submitted. We also record the score and whether it was a pass.
- quiz_passed: A quiz submission is a pass. We also record the score.
- quiz_failed: A quiz submission is a fail. We also record the score.

## Course Completion

- course_completed: The course is fully completed (all lessons and required quizzes) by a user with access.

## Certificates

- certificate_claim_started: A user clicks the button to claim a certificate.
- certificate_claim_success: A certificate is successfully claimed.
- certificate_claim_blocked: A certificate claim is blocked. We record why, such as:
  - incomplete_course: The user has not finished all required content.
  - identity_verification_required: Identity verification is required but not complete.

## Identity Verification

- id_verification_started: A user begins the identity verification process.
- id_verification_success: Identity verification succeeds.
- id_verification_failed: Identity verification fails. We record the failure reason and code from the provider.

## Notes on Data Collected (Plain‑Language)

- Course details: We often include which course the event is about.
- Lesson or quiz details: We include which lesson or quiz is involved.
- Quiz results: We include the score and whether it passed.
- Certificate blockers: We include the reason a certificate couldn’t be claimed.
- Identity verification errors: We include the provider’s error reason and code.
