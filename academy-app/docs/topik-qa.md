# TOPIK reading verification — 2026-09-21

Deployment update, 2026-09-22: the current TOPIK bank, 12 mocks and 685 solutions are now live. Current production checks are in `DEPLOYMENT.md` and `VERIFICATION.md`. The dated results below remain a record of the earlier local verification.

## Final mock policy after the user's decision

The user declined authored replacements, allowed reuse of authentic questions between mocks, and explicitly requested empty 42–43 slots labelled “Bu savollarni tashlab o‘ting”. This supersedes the initial unavailable-mock state recorded below.

- Twelve real-source mock forms are imported into the local database. Each has 48 graded questions at positions 1–41 and 44–50, plus two ungraded navigation placeholders. Generated grammar remains in practice only.
- Allocation uses all 574 distinct usable source questions across 576 graded positions. Exactly one 23–24 passage pair is reused across two forms; no question repeats within a form. Shared passages remain intact and every form mixes source exams.
- All **29 unit/content tests**, **8 production-build HTTP tests**, and the optimized production build passed.
- A real browser run (`/private/tmp/hangang-topik-mock-qa.mjs`) passed the 12-card catalog, 50 navigation positions, next-from-41 placeholder, both skip buttons, jump-to-44, saved-answer resume, mobile overflow check, all 48 correct answers, zero wrong answers and **96/96** result. The browser recorded zero page errors. No mock response fixture was used for this run.
- Screenshots in `/private/tmp/hangang-topik-mock-qa/`: `catalog.png`, `skipped.png`, `mobile-skipped.png`, `result.png`. All were visually inspected.
- Backup before the local migration: `backups/2026-09-21T07-33-08.376Z`. Counts of eight existing data tables, including TOPIK attempts and bookmarks, were preserved. SQLite integrity: `ok`; foreign-key violations: zero.
- At the time of this 2026-09-21 verification, public-server deployment had not been performed; it subsequently completed on 2026-09-22. The remaining sections document the earlier initial verification, not a current blocker or an outstanding content decision.

## Environment and scope

Student UI was exercised against the actual local TOPIK corpus with a disposable database at `/private/tmp/hangang-topik-ui-20260921`. The preview ran at `http://127.0.0.1:3168` and was stopped after verification. Production data and audio files were not used.

Visual QA covered desktop (1440 × 1000) and mobile (390 × 844). Initial inspection used the Codex browser; the complete flows used a separate headless Chromium test context with no existing user profile. A browser-native confirmation was replaced by the application's accessible dialog, and the completed flow passed with that dialog.

At the final isolated import, the bank contained 711 question records: 685 available questions and 26 excluded questions. There were 334 vocabulary/idiom entries. No real 50-question mock was ready: the source bank lacked two questions in band 23–24 and all 24 questions in band 42–43 required for 12 distinct forms. The UI displayed all 12 forms as unavailable. Mock timer verification below used a network fixture only; it did not publish or insert substitute questions.

## Browser checks

Two temporary scripts completed successfully. Their JSON reports contain **13 main-flow check groups and 4 additional timer/error check groups**, not 14 tests.

Main flow: `/private/tmp/hangang-topik-ui-qa/verify.mjs`

1. Real image crops loaded with nonzero image dimensions; Korean instructions and four text options rendered on the paper surface.
2. An answer could be selected, changed, and changed back; each accepted value remained selected.
3. Active session responses contained no answer key, explanation, result list, or score.
4. A practice could be exited, reloaded, and resumed with its saved answer and review marker.
5. Finishing with nine unanswered questions opened the confirmation dialog; cancelling returned to the practice.
6. Confirmed completion graded ten questions, counted unanswered questions as wrong, and displayed the result review.
7. A wrong question could be bookmarked from its result.
8. The saved question could be retaken in a fresh session and completed with the correct answer (1/1).
9. Twelve mock cards were present and disabled when the actual corpus could not produce a complete form.
10. Vocabulary could be filtered to 1–4 and displayed in a table with meanings and examples.
11. Flashcard practice revealed the meaning/translation and advanced after “Esladim”.
12. The dedicated idiom tab displayed entries from the idiom API.
13. A 15-question request for a linked-passage band produced 16 questions with a clear notice, retained two questions under one passage, and introduced no horizontal page overflow at desktop/mobile widths.

Additional flow: `/private/tmp/hangang-topik-ui-qa/timer-errors.mjs`

1. A simulated failed answer save rolled back the optimistic radio selection and progress count; retry then saved correctly.
2. A test-only 50-question mock session automatically submitted once when its server-based deadline expired.
3. Expiry submitted without opening the unanswered-question confirmation dialog.
4. The timeout result displayed 0/50 and the time-expired message.

The main flow reported no browser page errors. Source labels distinguish official questions from Hangang-created exercises. The hero copy explicitly includes additional grammar exercises.

## Visual evidence

Screenshots were inspected directly. Temporary artifact directory: `/private/tmp/hangang-topik-ui-qa/`.

| File | View |
| --- | --- |
| `desktop-hub.png` | Student navigation, category selector, live bank counts |
| `desktop-paper.png` | Actual cropped advertisement, printed-style Korean question and circled choices |
| `desktop-results.png` | Score and marked correct/wrong options |
| `desktop-mocks.png` | Honest unavailable-form states |
| `desktop-vocabulary.png` | Category bands and word/example cards |
| `desktop-idioms.png` | Separate idiom practice section |
| `mobile-hub-clean.png` | Mobile tabs, cards, and six-item bottom navigation |
| `mobile-shared-paper.png` | Linked passage and actual-count notice |
| `mobile-vocabulary-clean.png` | Mobile vocabulary filters, search and view controls |

The snapshots capture the bank as it existed during the browser run, before the final vocabulary expansion; the final isolated import was separately verified at 334 entries. The hero wording was subsequently corrected without altering the layout.

## Independent backend review

Reviewed `lib/topik.ts`, the TOPIK routes in `app/api/[...path]/route.ts`, and `tests/topik.test.ts` for ownership, answer disclosure, timer enforcement, reimport behavior, saved-question review and mock uniqueness.

- Session lookup, mutation and completion are scoped to the authenticated owner. Bookmarks are scoped to the owner and require a completed owned attempt.
- Public questions omit answer/explanation fields; completed results use the attempt's immutable snapshot.
- Server deadlines reject late answers; completion is idempotent. Answer writes and explicit completion use SQLite transactions.
- Import validation rejects duplicate IDs and invalid slots. A partially unverified passage is excluded as a whole. Existing attempts and bookmarks survive reimport.
- Mock planning preserves linked passages, fills all 50 positions in category order, and uses disjoint question IDs across ready forms; incomplete forms remain unavailable.
- Authenticated API mutations retain the application's origin check, input validation, body limit and rate limit.

Two material integration issues found during review were fixed:

1. Bulk saved-question review previously sent every visible question ID. More than 50 saves exceeded the API limit, and explicit IDs bypassed random sampling. The UI now requests a category-filtered, random 15-question saved review; an individual retake still sends its explicit question ID.
2. The saved badge previously counted revoked questions hidden from the usable saved list. It now counts usable entries while preserving stored bookmarks so they reappear when a passage is restored.

Final checks: `npx vitest run tests/topik.test.ts` passed **9/9 tests**, including new 100-bookmark sampling and retired/revoked/restored-passage regressions. `npm run typecheck` passed after all fixes. Production build and deployment verification are tracked separately by the main task.

## Final integration checks

- Full `npm test`: **27/27 passed** across four suites.
- Optimized `npm run build`: passed, including TypeScript.
- Full `npm run test:e2e`: **7/7 passed** against the production build and an isolated database, including the two real-corpus TOPIK HTTP tests. The first sandboxed attempt could not bind the local port; the permitted local rerun passed.
- All 72 final stimulus crops were visually inspected. Original question-number remnants were removed from exams 36, 60 and 64 without clipping their graphics.
- The local database was backed up before import. Existing user, group, assignment, submission, quiz-session and note counts were unchanged; SQLite integrity was `ok`, with zero foreign-key violations.
- No update has been deployed to the public server. New reading replacements remain unapproved drafts; the 12 complete mock forms are still pending that content decision.
