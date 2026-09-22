# Verification — updated 2026-09-22

## Redeployment — 2026-09-22

- 44 unit/integration tests, 12 isolated production HTTP tests, TypeScript checks, Next.js production build and linux/amd64 Docker build passed.
- Rehearsed the migration against a fresh production backup. Every pre-existing record was identical in its original columns after schema/content import. SQLite integrity and foreign keys passed.
- Deployed `hangang-academy:20260922` to all three services using the existing data/backup volumes and server secrets. A fresh complete backup was taken immediately before activation.
- Live database: 685 available questions, 685 published solutions and 12 mock forms. Existing users, groups, assignments, quizzes, reviews, notes, submissions and attachments retained their original counts.
- External trusted-HTTPS checks passed: health, teacher login with Secure/HttpOnly cookie, head-teacher content-editor access, question catalog, 291 vocabulary words, 43 idioms, all 685 ready solutions, question image and HTTP-to-HTTPS redirect. Each of 12 mocks has 48 graded questions.
- OpenRouter/Telegram configuration remains enabled. This redeployment made no paid AI request and sent no Telegram messages.
- Post-deployment comparison against the immediate pre-upgrade snapshot confirmed every original record in its original columns and the attachment SHA-256 checksum. Telegram webhook and normalized web-app menu URLs matched; pending updates were zero and no delivery error was reported.
- Disk remaining after deployment: approximately 1.9 GiB (90% used); increase capacity before significant content/upload growth. The preceding release image is retained for rollback.

## Passed in deployment preparation — 2026-09-19

- 14 Vitest tests and TypeScript checks. Coverage includes quiz isolation, ownership, CSRF, uploads, Telegram identity/reminders, AI job claims, strict review validation, OpenRouter routing and key isolation, partial/credit error handling, consistent backups and restored file hashes.
- 5 HTTP flow tests against an isolated production server/database: quiz completion and persistence; private notes; text/image/PDF submission and teacher feedback; separate grammar/vocabulary questions; teacher-added words and group access.
- Next.js production build and updated Docker image build with Node 24.18.0.
- Docker app, AI/Telegram worker and daily backup service started together in the isolated `hangang-local-check` project. App health passed. Daily backup completed successfully. Test containers stopped afterward without deleting their volumes.
- Backup restore test reopened the restored database, checked integrity and foreign keys and verified every attachment checksum. Missing attachments prevented a snapshot from being marked complete.
- OpenRouter credential check returned HTTP 200. Telegram getMe returned HTTP 200 and confirmed the configured bot username.
- Two real paid OpenRouter reviews using `openai/gpt-6-astra`: synthetic Korean text (34 seconds) and synthetic Korean text plus PNG and PDF (39 seconds). Both returned schema-valid Uzbek explanations and correctly corrected a past-tense error. The second explicitly read distinct identifiers from the image and PDF. Both remained unpublished teacher drafts. No real student data was used and no Telegram message was sent.
- `.env.local` credentials migrated to `OPENROUTER_API_KEY`, provider explicitly selected, secret file permissions 0600. OpenRouter credentials cannot be sent to the direct OpenAI endpoint.

## Previously verified, 2026-09-18

Desktop and mobile browser visual checks, student/teacher navigation, grammar details, complete quiz with explanations, reload/resume, saved activity, submission review and separate vocabulary authoring. These layouts are unchanged except the AI provider label.

## Production deployment — 2026-09-19

See [DEPLOYMENT.md](DEPLOYMENT.md). The server is live with trusted HTTPS. Production account/quiz/note/image/PDF/feedback flows passed, and a real queued OpenRouter job completed on the server worker. Telegram webhook and the web-app menu are configured. Test records were removed afterward.

## Follow-up verification

- Real Telegram Mini App login/delivery, representative Korean handwriting quality and a small student pilot.
- Target-server backup/restore and backup transfer to separate storage. Current daily backups keep seven complete snapshots on the same server.
- Concurrent user load test for the intended cohort. This release uses a single app/worker host and SQLite WAL.
