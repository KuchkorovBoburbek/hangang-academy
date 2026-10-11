import { courseAccess } from './course-access';
import { allVocabulary, visibleVocabularyWord } from './vocabulary-data';
import { many, one, run, now, transaction } from './db';
import { AppError } from './auth';
import type { HomeTask } from './student-home';
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
  kind: 'words' | 'grammar' | 'topik' | 'task';
  title: string;
  detail: string;
  count: number;
  wordIds?: string[];
  questionIds?: string[];
  taskId?: string;
};
export type TodayPlan = {
  headline: string;
  items: TodayPlanItem[];
  reviewCount: number;
  assignmentCount: number;
  estimatedMinutes: number;
  complete: boolean;
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

export function todayStudyPlan(user: User, tasks: HomeTask[]): TodayPlan {
  const due = visibleStudyReviews(user.id).filter((review) => review.due_at <= now());
  const words = due.filter((review) => review.source === 'word').slice(0, 5);
  const grammar = due
    .filter((review) => review.source === 'quiz')
    .sort((a, b) => b.wrong_count - a.wrong_count || a.due_at.localeCompare(b.due_at))
    .slice(0, 3);
  const topik = due
    .filter((review) => review.source === 'topik')
    .sort((a, b) => b.wrong_count - a.wrong_count || a.due_at.localeCompare(b.due_at))
    .slice(0, 3);
  const teacherTask = tasks.find((task) => task.required && task.status === 'todo');
  const items: TodayPlanItem[] = [];
  if (words.length)
    items.push({
      id: 'due-words',
      kind: 'words',
      title: `${words.length} ta eski so‘zni eslash`,
      detail: 'Muddati kelgan so‘zlar · xotiradan topish',
      count: words.length,
      wordIds: words.map((review) => review.item_id),
    });
  if (grammar.length)
    items.push({
      id: 'due-grammar',
      kind: 'grammar',
      title: `${grammar.length} ta grammatika savoli`,
      detail: grammar.some((review) => review.wrong_count > 0)
        ? 'Oldingi xatolarni mustahkamlash'
        : 'Muddati kelgan grammatikani eslash',
      count: grammar.length,
      questionIds: grammar.map((review) => review.item_id),
    });
  if (topik.length)
    items.push({
      id: 'due-topik',
      kind: 'topik',
      title: `${topik.length} ta TOPIK savolini takrorlash`,
      detail: 'Oldingi xatolar va ikkilangan javoblar',
      count: topik.length,
      questionIds: topik.map((review) => review.item_id),
    });
  if (teacherTask)
    items.push({
      id: `task-${teacherTask.id}`,
      kind: 'task',
      title: teacherTask.title,
      detail: `${teacherTask.lesson} · ustoz vazifasi`,
      count: 1,
      taskId: teacherTask.id,
    });
  const reviewCount = words.length + grammar.length + topik.length;
  const assignmentCount = teacherTask ? 1 : 0;
  return {
    headline:
      reviewCount && assignmentCount
        ? 'Avval takrorlash, keyin ustoz vazifasi.'
        : reviewCount
          ? 'Muddati kelgan takrorlashlardan boshlang.'
          : assignmentCount
            ? 'Bugun ustoz ochgan vazifani bajaring.'
            : 'Bugungi majburiy rejangiz bajarildi.',
    items,
    reviewCount,
    assignmentCount,
    estimatedMinutes: words.length + (grammar.length + topik.length) * 2 + assignmentCount * 10,
    complete: items.length === 0,
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
