# Architecture

A Node web service, a background AI/Telegram worker and a daily backup service share a local SQLite WAL database and a private uploads directory. Docker named volumes persist both. This is intentionally a single-host MVP; move to PostgreSQL and object storage before horizontal scaling.

- `app/api/[...path]/route.ts`: validated HTTP boundaries, same-origin mutations, sessions and role/ownership checks.
- `lib/learning.ts`: quiz selection, server-only answer keys, transactional answer submission, spaced repetition, student/teacher summaries.
- `lib/db.ts`: parameterized SQLite queries and startup schema. All multi-write critical operations use `BEGIN IMMEDIATE`. Do not put awaited work inside these transactions.
- `lib/library.ts`: static handbook vocabulary plus teacher-added words and question coverage counts.
- `lib/ai.ts`: OpenRouter Chat Completions or direct OpenAI Responses multimodal requests, strict output schema, local validation and independent score sum. No automatic publication or paid retry.
- `lib/worker.ts`: durable AI jobs, local-day reminder deduplication, bounded Telegram retries. Only one worker replica is supported.
- `lib/files.ts`: bounded streaming uploads, maximum three 5 MiB files, allowed signatures, randomized disk names. File downloads always check submission ownership. Existing stored uploads are immutable.
- `lib/auth.ts`: bcrypt passwords, hashed opaque session tokens, HMAC-verified expiring Telegram init data, same-origin validation and request limits.
- `components`: responsive learning and teaching experiences. API keys never enter client state; configuration only exposes enabled flags, provider label and model name.

## AI state

`queued → running → completed | failed`. Claim is transactional. A request timeout is ten minutes. A job still marked running after twenty minutes becomes failed, requiring an explicit teacher retry; avoid accidentally repeating a paid request after a crash. Completed drafts are visible only to the owning teacher. Publishing is a separate authenticated endpoint.

## Data boundaries

Student files and AI drafts are not public assets. A student sees only their own submissions, notes and quiz sessions. Teachers see students and assignments only in their owned groups. The academy question and vocabulary bank is shared across the one-academy installation. A grammar handbook band is not necessarily a unique grammar form: the 111 entries retain the earlier guide’s structure.

## Content versions

Initial questions are shipped in `content/questions.json`. `content-v2` seeds six similarity questions and improves starter prompts without changing answer positions. User-created questions are never overwritten by this step. `scripts/create-content.py` is the original authoring helper; do not rerun it over reviewed JSON content. Changes to historical answer positions need versioned question IDs.

## Operations

API and worker configuration comes from environment variables. `.env.local` is local development only; Docker excludes all env files and uses Compose’s runtime `.env`. There is no managed cloud deployment and no external message has been sent during development. Backups use SQLite’s consistent `VACUUM INTO`, verify integrity/foreign keys, copy precisely the snapshot’s referenced immutable attachments and save SHA-256 hashes. A completed snapshot is published atomically; the separate backup service creates one each UTC day and retains seven. A local restore test reopens the copied database and validates every file hash. Test both restore and provider integrations on the target server before inviting a real cohort.

AI credentials are isolated by provider. Existing rows migrate to `provider=openai`; new jobs snapshot the provider alongside the model. OpenRouter PDF requests explicitly use native file input, strict response schemas and providers that deny data collection. Partial/error responses never become completed reviews.
