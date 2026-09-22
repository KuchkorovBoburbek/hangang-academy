import { courseAccess } from './course-access';
import { allVocabulary, visibleVocabularyWord } from './vocabulary-data';
import { many, one, run, now, transaction } from './db';
import { AppError } from './auth';
import type { User } from './types';
export type StudyKind = 'question' | 'word';
export type StudyReview = {
  kind: StudyKind;
  item_id: string;
  stage: number;
  due_at: string;
  correct_count: number;
  wrong_count: number;
  last_at: string;
};
// Called within the caller's transaction. Event keys make retries harmless.
export function recordStudy(
  userId: string,
  kind: StudyKind,
  itemId: string,
  correct: boolean,
  uncertain: boolean,
  eventKey: string,
  at = now(),
) {
  const inserted = run(
    'INSERT OR IGNORE INTO study_events(user_id,event_key,kind,item_id,correct,uncertain,at) VALUES(?,?,?,?,?,?,?)',
    userId,
    eventKey,
    kind,
    itemId,
    +correct,
    +uncertain,
    at,
  );
  if (!inserted.changes) return;
  const previous = one<StudyReview>(
    'SELECT * FROM study_reviews WHERE user_id=? AND kind=? AND item_id=?',
    userId,
    kind,
    itemId,
  );
  if (previous && previous.last_at > at) return;
  // Confident new questions do not create unnecessary reviews. Once scheduled,
  // a question stays in the review cycle; multiple same-day retries cannot advance it.
  if (kind === 'question' && correct && !uncertain && !previous) return;
  const success = correct && !uncertain;
  const canAdvance =
    !previous || new Date(at).getTime() - new Date(previous.last_at).getTime() >= 20 * 3600000;
  const stage = success ? Math.min((previous?.stage || 0) + (canAdvance ? 1 : 0), 5) : 0;
  const days = [1, 2, 4, 7, 14, 30][stage];
  const due =
    success && previous && !canAdvance
      ? previous.due_at
      : new Date(new Date(at).getTime() + days * 86400000).toISOString();
  run(
    `INSERT INTO study_reviews(user_id,kind,item_id,stage,due_at,correct_count,wrong_count,last_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,kind,item_id) DO UPDATE SET stage=excluded.stage,due_at=excluded.due_at,correct_count=excluded.correct_count,wrong_count=excluded.wrong_count,last_at=excluded.last_at`,
    userId,
    kind,
    itemId,
    stage,
    due,
    (previous?.correct_count || 0) + +success,
    (previous?.wrong_count || 0) + +!success,
    at,
  );
}
export function dueStudyIds(userId: string, kind: StudyKind) {
  return many<{ item_id: string }>(
    'SELECT item_id FROM study_reviews WHERE user_id=? AND kind=? AND due_at<=? ORDER BY due_at',
    userId,
    kind,
    now(),
  ).map((r) => r.item_id);
}
export function studySummary(userId: string) {
  const user = one<User>('SELECT * FROM users WHERE id=?', userId);
  const visible = new Set(user ? allVocabulary(user).map((w) => w.id) : []);
  const items = many<StudyReview>(
    `SELECT r.* FROM study_reviews r WHERE user_id=? AND (kind='word' OR EXISTS(SELECT 1 FROM topik_questions q WHERE q.id=r.item_id AND (q.servable=1 OR q.current=0))) ORDER BY due_at`,
    userId,
  ).filter((r) => (r.kind === 'word' ? visible.has(r.item_id) : !user || courseAccess(user).topik));
  return {
    items,
    questions: items.filter((r) => r.kind === 'question' && r.due_at <= now()).length,
    words: items.filter((r) => r.kind === 'word' && r.due_at <= now()).length,
  };
}
export function rateStudyWord(user: User, wordId: string, remembered: boolean, eventKey: string) {
  if (!visibleVocabularyWord(user, wordId)) throw new AppError(404, 'So‘z topilmadi.');
  return transaction(() => {
    recordStudy(user.id, 'word', wordId, remembered, false, `word:${eventKey}`);
    return studySummary(user.id);
  });
}

export function saveStudyWord(user: User, wordId: string) {
  if (!visibleVocabularyWord(user, wordId)) throw new AppError(404, 'So‘z topilmadi.');
  run(
    "INSERT OR IGNORE INTO study_reviews(user_id,kind,item_id,due_at,last_at) VALUES(?,'word',?,?,?)",
    user.id,
    wordId,
    now(),
    now(),
  );
  return { ok: true };
}
