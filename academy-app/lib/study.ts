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
  complete: boolean;
};
export type TodayPlan = {
  day: string;
  headline: string;
  items: TodayPlanItem[];
  options: TodayPlanItem[];
  reviewCount: number;
  assignmentCount: number;
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

function todayPlanCandidates(user: User, tasks: HomeTask[], due: StudyReviewItem[]) {
  const words = due.filter((review) => review.source === 'word').slice(0, 5);
  const grammar = due
    .filter((review) => review.source === 'quiz')
    .sort((a, b) => b.wrong_count - a.wrong_count || a.due_at.localeCompare(b.due_at))
    .slice(0, 3);
  const topik = due
    .filter((review) => review.source === 'topik')
    .sort((a, b) => b.wrong_count - a.wrong_count || a.due_at.localeCompare(b.due_at))
    .slice(0, 3);
  const items: TodayPlanItem[] = [];
  if (words.length)
    items.push({
      id: 'due-words',
      kind: 'words',
      title: `${words.length} ta eski so‘zni eslash`,
      detail: 'Muddati kelgan so‘zlar · xotiradan topish',
      count: words.length,
      wordIds: words.map((review) => review.item_id),
      complete: false,
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
      complete: false,
    });
  if (topik.length)
    items.push({
      id: 'due-topik',
      kind: 'topik',
      title: `${topik.length} ta TOPIK savolini takrorlash`,
      detail: 'Oldingi xatolar va ikkilangan javoblar',
      count: topik.length,
      questionIds: topik.map((review) => review.item_id),
      complete: false,
    });
  for (const teacherTask of tasks.filter((task) => task.required && task.status === 'todo'))
    items.push({
      id: `task-${teacherTask.id}`,
      kind: 'task',
      title: teacherTask.title,
      detail: `${teacherTask.lesson} · ustoz vazifasi`,
      count: 1,
      taskId: teacherTask.id,
      complete: false,
    });
  return items;
}

function hydratePlanItem(
  raw: TodayPlanItem,
  reviews: StudyReviewItem[],
  dueIds: Set<string>,
  tasks: HomeTask[],
): TodayPlanItem | null {
  if (raw.kind === 'task') {
    const task = tasks.find((candidate) => candidate.id === raw.taskId);
    if (!task?.required) return null;
    return {
      ...raw,
      title: task.title,
      detail: `${task.lesson} · ustoz vazifasi`,
      complete: task.status !== 'todo',
    };
  }
  const source = raw.kind === 'words' ? 'word' : raw.kind === 'grammar' ? 'quiz' : 'topik';
  const ids = raw.kind === 'words' ? raw.wordIds || [] : raw.questionIds || [];
  const visible = new Set(
    reviews.filter((review) => review.source === source).map((review) => review.item_id),
  );
  const allowedIds = ids.filter((itemId) => visible.has(itemId));
  if (!allowedIds.length) return null;
  const count = allowedIds.length;
  return {
    ...raw,
    title:
      raw.kind === 'words'
        ? `${count} ta eski so‘zni eslash`
        : raw.kind === 'grammar'
          ? `${count} ta grammatika savoli`
          : `${count} ta TOPIK savolini takrorlash`,
    count,
    wordIds: raw.kind === 'words' ? allowedIds : undefined,
    questionIds: raw.kind === 'words' ? undefined : allowedIds,
    complete: allowedIds.every((itemId) => !dueIds.has(itemId)),
  };
}

export function todayStudyPlan(user: User, tasks: HomeTask[]): TodayPlan {
  const day = studyDay(now(), user.timezone);
  const reviews = visibleStudyReviews(user.id);
  const due = reviews.filter((review) => review.due_at <= now());
  const dueIds = new Set(due.map((review) => review.item_id));
  const candidates = todayPlanCandidates(user, tasks, due);
  const row = one<TodayPlanRow>(
    'SELECT * FROM student_day_plans WHERE user_id=? AND day=?',
    user.id,
    day,
  );
  const saved = row
    ? (JSON.parse(row.items) as TodayPlanItem[])
        .map((item) => hydratePlanItem(item, reviews, dueIds, tasks))
        .filter((item): item is TodayPlanItem => !!item)
    : [];
  const optionMap = new Map<string, TodayPlanItem>();
  for (const option of [...saved, ...candidates])
    if (!optionMap.has(option.id)) optionMap.set(option.id, option);
  const items = saved;
  const remaining = items.filter((item) => !item.complete);
  const reviewCount = remaining
    .filter((item) => item.kind !== 'task')
    .reduce((sum, item) => sum + item.count, 0);
  const assignmentCount = remaining.filter((item) => item.kind === 'task').length;
  return {
    day,
    headline: !row
      ? 'Bugungi rejangizni o‘zingiz belgilang.'
      : !items.length
        ? 'Bugun uchun ochiq reja bandi yo‘q.'
        : !remaining.length
          ? 'Siz belgilagan bugungi reja bajarildi.'
          : `${remaining.length} ta tanlangan qadam qoldi.`,
    items,
    options: [...optionMap.values()],
    reviewCount,
    assignmentCount,
    estimatedMinutes: remaining.reduce(
      (minutes, item) => minutes + (item.kind === 'task' ? 10 : item.count * 2),
      0,
    ),
    completedCount: items.length - remaining.length,
    configured: !!row,
    complete: !!row && !remaining.length,
  };
}

export function saveTodayStudyPlan(user: User, tasks: HomeTask[], selectedIds: string[]) {
  if (user.role !== 'student') throw new AppError(403, 'Rejani o‘quvchi belgilaydi.');
  const current = todayStudyPlan(user, tasks);
  const unique = [...new Set(selectedIds)];
  const options = new Map(current.options.map((option) => [option.id, option]));
  if (unique.some((itemId) => !options.has(itemId)))
    throw new AppError(409, 'Reja variantlari yangilandi. Sahifani yangilang.');
  if (current.options.length && !unique.length)
    throw new AppError(400, 'Bugungi rejangiz uchun kamida bitta band tanlang.');
  const selected = unique.map((itemId) => options.get(itemId)!);
  const timestamp = now();
  run(
    `INSERT INTO student_day_plans(user_id,day,items,created_at,updated_at) VALUES(?,?,?,?,?)
     ON CONFLICT(user_id,day) DO UPDATE SET items=excluded.items,updated_at=excluded.updated_at`,
    user.id,
    current.day,
    JSON.stringify(selected),
    timestamp,
    timestamp,
  );
  return todayStudyPlan(user, tasks);
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
