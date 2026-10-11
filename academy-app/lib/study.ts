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
export type StudyReviewItem = StudyReview & {
  source: 'word' | 'quiz' | 'topik';
  topic_id?: string;
};
export type TodayPlanItem = {
  id: string;
  kind:
    | 'reading'
    | 'listening'
    | 'speaking'
    | 'writing'
    | 'vocabulary'
    | 'grammar'
    | 'homework'
    | 'other';
  title: string;
  minutes: number;
  complete: boolean;
};
export type TodayPlan = {
  day: string;
  headline: string;
  items: TodayPlanItem[];
  estimatedMinutes: number;
  completedCount: number;
  configured: boolean;
  complete: boolean;
};
type TodayPlanRow = {
  user_id: string;
  day: string;
  items: string;
  created_at: string;
  updated_at: string;
};

function studyDay(at: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at));
}
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
  const timezone =
    one<{ timezone: string }>('SELECT timezone FROM users WHERE id=?', userId)?.timezone ||
    'Asia/Tashkent';
  const success = correct && !uncertain;
  // Mastery grows only when recall succeeds on a different local calendar day.
  // Repeating the same item many times today can reinforce it, but cannot skip intervals.
  const canAdvance = !previous || studyDay(previous.last_at, timezone) !== studyDay(at, timezone);
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
export function visibleStudyReviews(userId: string): StudyReviewItem[] {
  const user = one<User>('SELECT * FROM users WHERE id=?', userId);
  if (!user) return [];
  const access = courseAccess(user);
  const visibleWords = new Set(allVocabulary(user).map((word) => word.id));
  const group = one<{ grammar_ids: string }>(
    'SELECT grammar_ids FROM groups WHERE id=?',
    user.group_id || '',
  );
  const visibleGrammar = new Set<string>(
    access.managed ? access.grammarIds : JSON.parse(group?.grammar_ids || '[]'),
  );
  const quizQuestions = new Map(
    many<{ id: string; kind: string; topic_id: string }>(
      "SELECT id,kind,topic_id FROM questions WHERE kind='grammar'",
    ).map((question) => [question.id, question]),
  );
  const topikQuestions = new Set(
    many<{ id: string }>('SELECT id FROM topik_questions WHERE servable=1 OR current=0').map(
      (question) => question.id,
    ),
  );
  const rows = many<StudyReview>(
    'SELECT * FROM study_reviews WHERE user_id=? ORDER BY due_at,wrong_count DESC',
    userId,
  );
  const items: StudyReviewItem[] = [];
  for (const review of rows) {
    if (review.kind === 'word') {
      if (visibleWords.has(review.item_id)) items.push({ ...review, source: 'word' });
      continue;
    }
    const quiz = quizQuestions.get(review.item_id);
    if (quiz) {
      if (visibleGrammar.has(quiz.topic_id))
        items.push({ ...review, source: 'quiz', topic_id: quiz.topic_id });
      continue;
    }
    if (access.topik && topikQuestions.has(review.item_id))
      items.push({ ...review, source: 'topik' });
  }
  return items;
}
export function studySummary(userId: string) {
  const items = visibleStudyReviews(userId);
  const due = items.filter((review) => review.due_at <= now());
  return {
    items,
    questions: due.filter((review) => review.kind === 'question').length,
    grammarQuestions: due.filter((review) => review.source === 'quiz').length,
    topikQuestions: due.filter((review) => review.source === 'topik').length,
    words: due.filter((review) => review.kind === 'word').length,
  };
}

const planKinds = new Set<TodayPlanItem['kind']>([
  'reading',
  'listening',
  'speaking',
  'writing',
  'vocabulary',
  'grammar',
  'homework',
  'other',
]);

function validPlanItem(item: unknown): item is TodayPlanItem {
  if (!item || typeof item !== 'object') return false;
  const value = item as Partial<TodayPlanItem>;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.id.length <= 100 &&
    typeof value.kind === 'string' &&
    planKinds.has(value.kind as TodayPlanItem['kind']) &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    value.title.length <= 80 &&
    Number.isInteger(value.minutes) &&
    Number(value.minutes) >= 5 &&
    Number(value.minutes) <= 180 &&
    typeof value.complete === 'boolean'
  );
}

function storedPlanItems(row?: TodayPlanRow) {
  if (!row) return [];
  try {
    const parsed: unknown = JSON.parse(row.items);
    return Array.isArray(parsed) ? parsed.filter(validPlanItem) : [];
  } catch {
    return [];
  }
}

export function todayStudyPlan(user: User): TodayPlan {
  const day = studyDay(now(), user.timezone);
  const row = one<TodayPlanRow>(
    'SELECT * FROM student_day_plans WHERE user_id=? AND day=?',
    user.id,
    day,
  );
  const items = storedPlanItems(row);
  const remaining = items.filter((item) => !item.complete);
  const configured = items.length > 0;
  return {
    day,
    headline: !configured
      ? 'O‘zingiz uchun oddiy checklist tuzing.'
      : !remaining.length
        ? 'Bugungi rejangiz bajarildi.'
        : `${remaining.length} ta band · ${remaining.reduce((sum, item) => sum + item.minutes, 0)} daqiqa qoldi.`,
    items,
    estimatedMinutes: remaining.reduce((minutes, item) => minutes + item.minutes, 0),
    completedCount: items.length - remaining.length,
    configured,
    complete: configured && !remaining.length,
  };
}

export function saveTodayStudyPlan(user: User, items: TodayPlanItem[]) {
  if (user.role !== 'student') throw new AppError(403, 'Rejani o‘quvchi belgilaydi.');
  if (!items.length) throw new AppError(400, 'Checklistga kamida bitta band qo‘shing.');
  if (items.length > 12)
    throw new AppError(400, 'Checklistda ko‘pi bilan 12 ta band bo‘lishi mumkin.');
  if (items.some((item) => !validPlanItem(item)))
    throw new AppError(400, 'Checklist bandlarini tekshiring.');
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new AppError(400, 'Checklistda takrorlangan band bor.');
  const current = todayStudyPlan(user);
  const clean = items.map((item) => ({ ...item, title: item.title.trim() }));
  const timestamp = now();
  run(
    `INSERT INTO student_day_plans(user_id,day,items,created_at,updated_at) VALUES(?,?,?,?,?)
     ON CONFLICT(user_id,day) DO UPDATE SET items=excluded.items,updated_at=excluded.updated_at`,
    user.id,
    current.day,
    JSON.stringify(clean),
    timestamp,
    timestamp,
  );
  return todayStudyPlan(user);
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
