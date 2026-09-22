import { requireTopikAccess } from './course-access';
import { readingWords, scopeVocabulary } from './vocabulary-data';
import { recordStudy, dueStudyIds, studySummary } from './study';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './auth';
import { id, many, now, one, run, transaction } from './db';
import type { User } from './types';
import {
  TOPIK_CATEGORIES,
  type TopikBookmark,
  type TopikCatalog,
  type TopikGroup,
  type TopikHistoryItem,
  type TopikMockShortage,
  type TopikPublicGroup,
  type TopikQuestion,
  type TopikSession,
  type TopikVocabulary,
} from './topik-types';

const textValue = z.string().max(30_000);
const asset = z
  .string()
  .regex(/^\/(?:topik|topik-assets)\/[\w./-]+$/)
  .refine((s) => !s.includes('..'));
const questionSchema = z.object({
  id: z.string().min(1).max(180),
  number: z.number().int().min(1).max(50),
  prompt: textValue,
  options: z.array(textValue).length(4),
  optionImages: z.array(asset.nullable()).length(4).optional(),
  answer: z.number().int().min(0).max(3).nullable(),
  explanation: textValue,
  translation: textValue.optional(),
  grammarIds: z.array(z.string().max(100)).optional(),
  verified: z.boolean().optional(),
  withheld: z.boolean().optional(),
});
const groupSchema = z.object({
  id: z.string().min(1).max(180),
  category: z.enum(TOPIK_CATEGORIES.map((c) => c.id)),
  origin: z.enum(['official', 'generated']),
  source: z.object({
    exam: z.number().int().positive().nullable(),
    file: z.string().max(1000),
    pages: z.array(z.number().int().positive()),
  }),
  instruction: textValue,
  passage: textValue,
  blocks: z.array(
    z.object({
      type: z.enum(['text', 'box', 'image', 'heading']),
      text: textValue.optional(),
      src: asset.optional(),
      alt: textValue.optional(),
    }),
  ),
  questions: z.array(questionSchema).min(1).max(4),
});
const vocabularySchema = z.object({
  id: z.string().min(1).max(180),
  ko: textValue,
  uz: textValue,
  pos: textValue,
  example: textValue,
  translation: textValue,
  categories: z.array(z.string()),
  sourceQuestionIds: z.array(z.string()),
  frequency: z.number().int().nonnegative(),
  categoryFrequencies: z.record(z.string(), z.number().int().nonnegative()).optional(),
  categoryQuestionIds: z.record(z.string(), z.array(z.string())).optional(),
  kind: z.enum(['word', 'idiom']),
});
type GroupRow = {
  id: string;
  category: TopikGroup['category'];
  origin: TopikGroup['origin'];
  source: string;
  instruction: string;
  passage: string;
  blocks: string;
};
type QuestionRow = {
  id: string;
  group_id: string;
  number: number;
  prompt: string;
  options: string;
  option_images: string;
  answer: number | null;
  explanation: string;
  translation: string;
  grammar_ids: string;
  servable: number;
};
type SessionRow = {
  id: string;
  user_id: string;
  mode: TopikSession['mode'];
  category: string;
  form_id: string | null;
  requested_count: number;
  actual_count: number;
  snapshot: string;
  choices: string;
  uncertain: string;
  timings: string;
  seen_before: string;
  checked: string;
  status: 'active' | 'completed';
  score: number;
  started_at: string;
  deadline: string | null;
  completed_at: string | null;
  timed_out: number;
  notice: string | null;
};
const decodeQuestion = (q: QuestionRow): TopikQuestion => ({
  id: q.id,
  number: q.number,
  prompt: q.prompt,
  options: JSON.parse(q.options),
  optionImages: JSON.parse(q.option_images),
  answer: q.answer,
  explanation: q.explanation,
  translation: q.translation,
  grammarIds: JSON.parse(q.grammar_ids),
  verified: !!q.servable,
});
const decodeGroup = (g: GroupRow, questions: TopikQuestion[]): TopikGroup => ({
  id: g.id,
  category: g.category,
  origin: g.origin,
  source: JSON.parse(g.source),
  instruction: g.instruction,
  passage: g.passage,
  blocks: JSON.parse(g.blocks),
  questions,
});
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const questionsOf = (groups: TopikGroup[]) => groups.flatMap((g) => g.questions);
const categoryById = (id: string) => TOPIK_CATEGORIES.find((c) => c.id === id);
const isServable = (q: TopikQuestion) => q.answer !== null && q.verified !== false && !q.withheld;

export function topikGroups(): TopikGroup[] {
  const qs = many<QuestionRow>('SELECT * FROM topik_questions WHERE current=1 ORDER BY number,id');
  const groups = new Map<string, TopikQuestion[]>();
  for (const q of qs)
    groups.set(q.group_id, [...(groups.get(q.group_id) || []), decodeQuestion(q)]);
  return many<GroupRow>('SELECT * FROM topik_groups WHERE current=1 ORDER BY id')
    .map((g) => decodeGroup(g, groups.get(g.id) || []))
    .filter((g) => g.questions.length && g.questions.every(isServable));
}

function shuffled<T>(items: T[]): T[] {
  const values = [...items];
  for (let i = values.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

// Singles are interchangeable within their band; linked passages stay intact.
function allocateCategory(
  groups: TopikGroup[],
  start: number,
  end: number,
  count: number,
): TopikGroup[][] | null {
  const buckets = new Map<string, TopikGroup[]>();
  for (const g of groups) {
    const key = g.questions.length === 1 ? 'single' : g.questions.map((q) => q.number).join(',');
    buckets.set(key, [...(buckets.get(key) || []), g]);
  }
  const types = [...buckets].map(([key, values]) => ({
    key,
    values,
    size: values[0].questions.length,
    start: values[0].questions[0].number,
  }));
  const remaining = types.map((t) => t.values.length);
  const chosen: number[][] = Array.from({ length: count }, () => []);
  const failed = new Set<string>();
  const fill = (form: number, slot: number): boolean => {
    if (form === count) return true;
    if (slot > end) return fill(form + 1, start);
    const key = `${form}:${slot}:${remaining.join(',')}`;
    if (failed.has(key)) return false;
    for (let t = 0; t < types.length; t++) {
      const type = types[t];
      if (!remaining[t] || slot + type.size - 1 > end || (type.size > 1 && type.start !== slot))
        continue;
      remaining[t]--;
      chosen[form].push(t);
      if (fill(form, slot + type.size)) return true;
      chosen[form].pop();
      remaining[t]++;
    }
    failed.add(key);
    return false;
  };
  if (!fill(0, start)) return null;
  const used = types.map(() => 0);
  return chosen.map((form) => form.map((t) => types[t].values[used[t]++]));
}

export function planTopikMocks(
  groups: TopikGroup[],
  seed = 'hangang-official-reading-v2',
  requestedForms = 12,
) {
  const ready = groups.filter(
    (g) => g.origin === 'official' && g.questions.length && g.questions.every(isServable),
  );
  // The supplied papers withhold every 42–43 passage. Leave those two slots
  // explicitly empty; never invent text or substitute a different question type.
  const skippedNumbers = ready.some((g) => g.category === '42-43') ? [] : [42, 43];
  const shortages: TopikMockShortage[] = [];
  const categories = TOPIK_CATEGORIES.filter((c) => !skippedNumbers.includes(c.start));
  for (const category of categories) {
    const pool = ready.filter((g) => g.category === category.id);
    const required = category.end - category.start + 1;
    const available = questionsOf(pool).length;
    if (!allocateCategory(pool, category.start, category.end, 1))
      shortages.push({
        category: category.id,
        slots: Array.from(
          { length: category.end - category.start + 1 },
          (_, i) => category.start + i,
        ),
        required,
        available,
        missing: Math.max(0, required - available),
      });
  }
  const forms: TopikGroup[][] = [];
  const usage = new Map<string, number>();
  if (!shortages.length)
    for (let f = 0; f < requestedForms; f++) {
      const form = categories.flatMap((category) => {
        // Exhaust unused questions first, then reuse the least-used source.
        // Selection stays stable for a corpus version and never repeats inside
        // one form. The user permits repetition between different forms.
        const pool = ready
          .filter((g) => g.category === category.id)
          .sort(
            (a, b) =>
              (usage.get(a.id) || 0) - (usage.get(b.id) || 0) ||
              hash(`${seed}:${f}:${a.id}`).localeCompare(hash(`${seed}:${f}:${b.id}`)),
          );
        return allocateCategory(pool, category.start, category.end, 1)![0];
      });
      for (const group of form) usage.set(group.id, (usage.get(group.id) || 0) + 1);
      forms.push(form);
    }
  return {
    requestedForms,
    readyForms: forms.length,
    questionCount: 50 - skippedNumbers.length,
    skippedNumbers,
    shortages,
    forms,
  };
}

export function importTopikCorpus(rawGroups: unknown, rawVocabulary: unknown, version?: string) {
  const groups = z.array(groupSchema).parse(rawGroups) as TopikGroup[];
  const vocabulary = z.array(vocabularySchema).parse(rawVocabulary) as TopikVocabulary[];
  const groupIds = new Set<string>();
  const questionIds = new Set<string>();
  for (const group of groups) {
    if (groupIds.has(group.id)) throw new Error(`Duplicate TOPIK group: ${group.id}`);
    groupIds.add(group.id);
    const category = categoryById(group.category)!;
    group.questions.sort((a, b) => a.number - b.number);
    for (const [i, q] of group.questions.entries()) {
      if (questionIds.has(q.id)) throw new Error(`Duplicate TOPIK question: ${q.id}`);
      questionIds.add(q.id);
      if (
        q.number < category.start ||
        q.number > category.end ||
        (i && q.number !== group.questions[i - 1].number + 1)
      )
        throw new Error(`Invalid original question slots: ${group.id}`);
      if (isServable(q) && q.options.some((o, n) => !o.trim() && !q.optionImages?.[n]))
        throw new Error(`Empty answer option: ${q.id}`);
    }
  }
  if (new Set(vocabulary.map((v) => v.id)).size !== vocabulary.length)
    throw new Error('Duplicate TOPIK vocabulary id');
  for (const word of vocabulary) {
    if (word.sourceQuestionIds.some((q) => !questionIds.has(q)))
      throw new Error(`Unknown vocabulary source: ${word.id}`);
    if (word.categories.some((c) => c !== '1-4' && !categoryById(c)))
      throw new Error(`Unknown vocabulary category: ${word.id}`);
  }
  const corpusVersion =
    version ||
    `reading-v2-${hash(JSON.stringify({ groups, vocabulary, mockPolicy: 'official-reuse-skip-42-43' })).slice(0, 20)}`;
  const plan = planTopikMocks(groups, corpusVersion);
  const unchanged =
    one<{ value: string }>('SELECT value FROM app_meta WHERE key=?', 'topik_corpus_version')
      ?.value === corpusVersion;
  if (!unchanged)
    transaction(() => {
      run('UPDATE topik_groups SET current=0');
      run('UPDATE topik_questions SET current=0');
      run('UPDATE topik_vocabulary SET current=0');
      run('UPDATE topik_mock_forms SET current=0');
      for (const g of groups) {
        run(
          'INSERT INTO topik_groups(id,category,origin,source,instruction,passage,blocks,corpus_version,current) VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET category=excluded.category,origin=excluded.origin,source=excluded.source,instruction=excluded.instruction,passage=excluded.passage,blocks=excluded.blocks,corpus_version=excluded.corpus_version,current=1',
          g.id,
          g.category,
          g.origin,
          JSON.stringify(g.source),
          g.instruction,
          g.passage,
          JSON.stringify(g.blocks),
          corpusVersion,
        );
        const serveGroup = g.questions.every(isServable);
        for (const q of g.questions)
          run(
            'INSERT INTO topik_questions(id,group_id,number,prompt,options,option_images,answer,explanation,translation,grammar_ids,servable,corpus_version,current) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id,number=excluded.number,prompt=excluded.prompt,options=excluded.options,option_images=excluded.option_images,answer=excluded.answer,explanation=excluded.explanation,translation=excluded.translation,grammar_ids=excluded.grammar_ids,servable=excluded.servable,corpus_version=excluded.corpus_version,current=1',
            q.id,
            g.id,
            q.number,
            q.prompt,
            JSON.stringify(q.options),
            JSON.stringify(q.optionImages || []),
            q.answer,
            q.explanation,
            q.translation || '',
            JSON.stringify(q.grammarIds || []),
            serveGroup ? 1 : 0,
            corpusVersion,
          );
      }
      for (const w of vocabulary)
        run(
          'INSERT INTO topik_vocabulary(id,ko,uz,pos,example,translation,categories,source_question_ids,frequency,kind,corpus_version,category_frequencies,category_question_ids,current) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET ko=excluded.ko,uz=excluded.uz,pos=excluded.pos,example=excluded.example,translation=excluded.translation,categories=excluded.categories,source_question_ids=excluded.source_question_ids,frequency=excluded.frequency,kind=excluded.kind,corpus_version=excluded.corpus_version,category_frequencies=excluded.category_frequencies,category_question_ids=excluded.category_question_ids,current=1',
          w.id,
          w.ko,
          w.uz,
          w.pos,
          w.example,
          w.translation,
          JSON.stringify(w.categories),
          JSON.stringify(w.sourceQuestionIds),
          w.frequency,
          w.kind,
          corpusVersion,
          JSON.stringify(w.categoryFrequencies || {}),
          JSON.stringify(w.categoryQuestionIds || {}),
        );
      for (const [i, form] of plan.forms.entries())
        run(
          'INSERT INTO topik_mock_forms(id,number,group_ids,corpus_version,current,created_at) VALUES(?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET current=1',
          `${corpusVersion}-form-${i + 1}`,
          i + 1,
          JSON.stringify(form.map((g) => g.id)),
          corpusVersion,
          now(),
        );
      run(
        'INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        'topik_corpus_version',
        corpusVersion,
      );
      run(
        'INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        'topik_mock_plan',
        JSON.stringify({
          requestedForms: 12,
          readyForms: plan.readyForms,
          questionCount: plan.questionCount,
          skippedNumbers: plan.skippedNumbers,
          shortages: plan.shortages,
        }),
      );
    });
  return {
    corpusVersion,
    unchanged,
    groups: groups.length,
    questions: questionsOf(groups).length,
    servable: questionsOf(groups.filter((g) => g.questions.every(isServable))).length,
    vocabulary: vocabulary.length,
    mockForms: plan.readyForms,
    mockQuestionCount: plan.questionCount,
    skippedNumbers: plan.skippedNumbers,
    shortages: plan.shortages,
  };
}

export function importTopikFiles(directory = path.resolve('content/topik')) {
  const groupsFile = path.join(directory, 'groups.json');
  const vocabFile = path.join(directory, 'vocabulary.json');
  if (!fs.existsSync(groupsFile)) throw new Error(`TOPIK corpus does not exist: ${groupsFile}`);
  return importTopikCorpus(
    JSON.parse(fs.readFileSync(groupsFile, 'utf8')),
    fs.existsSync(vocabFile) ? JSON.parse(fs.readFileSync(vocabFile, 'utf8')) : [],
  );
}

function publicGroups(groups: TopikGroup[], mock = false): TopikPublicGroup[] {
  let number = 0;
  return groups.map((g) => {
    if (mock) number = Math.max(number, categoryById(g.category)!.start - 1);
    return {
      ...g,
      questions: g.questions.map((q) => ({
        id: q.id,
        number: q.number,
        displayNumber: ++number,
        prompt: q.prompt,
        options: q.options,
        ...(q.optionImages?.length ? { optionImages: q.optionImages } : {}),
      })),
    };
  });
}
function ownSession(user: User, sessionId: string): SessionRow {
  const row = one<SessionRow>(
    'SELECT * FROM topik_sessions WHERE id=? AND user_id=?',
    sessionId,
    user.id,
  );
  if (!row) throw new AppError(404, 'TOPIK mashqi topilmadi.');
  return row;
}
function reviewGroups(user: User): TopikGroup[] {
  const current = topikGroups();
  const found = new Set(current.flatMap((g) => g.questions.map((q) => q.id)));
  const revoked = new Set(
    many<{ id: string }>('SELECT id FROM topik_questions WHERE current=1 AND servable=0').map(
      (q) => q.id,
    ),
  );
  const prior = many<{ snapshot: string; status: string; checked: string }>(
    "SELECT snapshot,status,checked FROM topik_sessions WHERE user_id=? AND (status='completed' OR checked!='{}') ORDER BY started_at DESC",
    user.id,
  );
  for (const row of prior)
    for (const group of JSON.parse(row.snapshot) as TopikGroup[]) {
      // A completed or checked attempt preserves the original shared passage.
      if (
        (row.status === 'completed' ||
          group.questions.some((q) => JSON.parse(row.checked || '{}')[q.id])) &&
        group.questions.every((q) => !found.has(q.id) && !revoked.has(q.id))
      ) {
        current.push(group);
        for (const q of group.questions) found.add(q.id);
      }
    }
  return current;
}
function finalize(row: SessionRow, timedOut = false): SessionRow {
  if (row.status === 'completed') return row;
  const groups: TopikGroup[] = JSON.parse(row.snapshot);
  const choices: Record<string, number> = JSON.parse(row.choices);
  const score = questionsOf(groups).filter((q) => choices[q.id] === q.answer).length;
  run(
    "UPDATE topik_sessions SET status='completed',score=?,completed_at=?,timed_out=? WHERE id=? AND status='active'",
    score,
    now(),
    timedOut ? 1 : 0,
    row.id,
  );
  const uncertain: Record<string, boolean> = JSON.parse(row.uncertain || '{}');
  for (const q of questionsOf(groups))
    recordStudy(
      row.user_id,
      'question',
      q.id,
      choices[q.id] === q.answer,
      !!uncertain[q.id],
      `topik:${row.id}:${q.id}`,
    );
  return one<SessionRow>('SELECT * FROM topik_sessions WHERE id=?', row.id)!;
}
function expire(row: SessionRow): SessionRow {
  return row.status === 'active' && row.deadline && row.deadline <= now()
    ? finalize(row, true)
    : row;
}
function sessionView(row: SessionRow): TopikSession {
  const snapshot: TopikGroup[] = JSON.parse(row.snapshot);
  const displayed = publicGroups(snapshot, row.mode === 'mock');
  const numbers = displayed.flatMap((g) => g.questions.map((q) => q.displayNumber));
  const skippedNumbers =
    row.mode === 'mock'
      ? Array.from({ length: 50 }, (_, i) => i + 1).filter((n) => !numbers.includes(n))
      : [];
  const choices: Record<string, number> = JSON.parse(row.choices);
  const complete = row.status === 'completed';
  const result: TopikSession = {
    id: row.id,
    mode: row.mode,
    category: row.category,
    formId: row.form_id,
    status: row.status,
    requestedCount: row.requested_count,
    actualCount: row.actual_count,
    skippedNumbers,
    notice: row.notice,
    startedAt: row.started_at,
    deadline: row.deadline,
    completedAt: row.completed_at,
    serverNow: now(),
    groups: displayed,
    choices,
    uncertain: JSON.parse(row.uncertain || '{}'),
    checked: JSON.parse(row.checked || '{}'),
    answeredCount: Object.keys(choices).length,
    score: complete ? row.score : null,
    percent: complete ? Math.round((row.score / row.actual_count) * 100) : null,
    timedOut: !!row.timed_out,
  };
  if (!complete && row.mode !== 'mock') {
    result.checkedResults = questionsOf(snapshot)
      .filter((q) => result.checked[q.id])
      .map((q) => ({
        questionId: q.id,
        number: displayed.flatMap((g) => g.questions).find((item) => item.id === q.id)!
          .displayNumber,
        choice: choices[q.id] ?? null,
        answer: q.answer!,
        correct: choices[q.id] === q.answer,
        explanation: '',
        translation: '',
        saved: false,
        uncertain: !!result.uncertain[q.id],
      }));
  }
  if (complete) {
    const saved = new Set(
      many<{ question_id: string }>(
        'SELECT question_id FROM topik_bookmarks WHERE user_id=?',
        row.user_id,
      ).map((b) => b.question_id),
    );
    const timings: Record<string, number> = JSON.parse(row.timings || '{}');
    const seen: Record<string, boolean> = JSON.parse(row.seen_before || '{}');
    const firstStats = { total: 0, correct: 0 },
      seenStats = { total: 0, correct: 0 };
    if (seen._tracked)
      for (const q of questionsOf(snapshot)) {
        const bucket = seen[q.id] ? seenStats : firstStats;
        bucket.total++;
        bucket.correct += +(choices[q.id] === q.answer);
      }
    result.analytics = {
      categories: [...new Set(snapshot.map((g) => g.category))].map((category) => {
        const qs = questionsOf(snapshot.filter((g) => g.category === category));
        return {
          category,
          total: qs.length,
          correct: qs.filter((q) => choices[q.id] === q.answer).length,
          seconds: qs.reduce((n, q) => n + (timings[q.id] || 0), 0),
          enough: qs.length >= 4,
        };
      }),
      first: firstStats,
      seen: seenStats,
      unknown: seen._tracked ? 0 : row.actual_count,
      seconds: Object.values(timings).reduce((a, b) => a + b, 0),
    };
    result.results = questionsOf(snapshot).map((q, i) => ({
      questionId: q.id,
      number: numbers[i],
      choice: choices[q.id] ?? null,
      answer: q.answer!,
      correct: choices[q.id] === q.answer,
      explanation: q.explanation,
      translation: q.translation || '',
      saved: saved.has(q.id),
      uncertain: !!result.uncertain[q.id],
    }));
  }
  return result;
}
export function getTopikSession(user: User, sessionId: string): TopikSession {
  requireTopikAccess(user);
  return transaction(() => sessionView(expire(ownSession(user, sessionId))));
}

function practiceGroups(groups: TopikGroup[], requested: number): TopikGroup[] {
  const pool = shuffled(groups);
  const max = Math.min(questionsOf(pool).length, requested + 3);
  const options = new Map<number, TopikGroup[]>([[0, []]]);
  for (const group of pool) {
    for (const [size, picked] of [...options.entries()].sort((a, b) => b[0] - a[0])) {
      const next = size + group.questions.length;
      if (next <= max && !options.has(next)) options.set(next, [...picked, group]);
    }
  }
  const count = [...options.keys()]
    .filter(Boolean)
    .sort((a, b) => Math.abs(a - requested) - Math.abs(b - requested) || b - a)[0];
  return options.get(count) || [];
}

export function startTopikSession(
  user: User,
  options: {
    mode: 'practice' | 'mock' | 'review';
    category?: string;
    count?: number;
    grammarId?: string;
    formId?: string;
    questionIds?: string[];
    dueOnly?: boolean;
  },
): TopikSession {
  requireTopikAccess(user);
  hydrateTopikReviews(user);
  if (!['practice', 'mock', 'review'].includes(options.mode))
    throw new AppError(400, 'Mashq turini tanlang.');
  const category = options.category || 'all';
  const requested = options.count || 10;
  if (category !== 'all' && !categoryById(category))
    throw new AppError(400, 'Savol turini tanlang.');
  if (!Number.isInteger(requested) || requested < 1 || requested > 15)
    throw new AppError(400, 'Savollar soni yaroqsiz.');
  let groups = topikGroups();
  let formId: string | null = null;
  if (options.mode === 'mock') {
    const form = one<{ id: string; group_ids: string }>(
      'SELECT * FROM topik_mock_forms WHERE id=? AND current=1',
      options.formId || '',
    );
    if (!form) throw new AppError(409, 'Bu mock uchun tekshirilgan savollar hali yetarli emas.');
    const ids: string[] = JSON.parse(form.group_ids);
    const available = new Map(groups.map((g) => [g.id, g]));
    groups = ids.map((gid) => available.get(gid)!).filter(Boolean);
    const expected = groups.some((g) => g.category === '42-43') ? 50 : 48;
    if (
      groups.length !== ids.length ||
      questionsOf(groups).length !== expected ||
      new Set(ids).size !== ids.length ||
      groups.some((g) => g.origin !== 'official')
    )
      throw new AppError(409, 'Mock savollari to‘liq emas.');
    formId = form.id;
  } else if (options.mode === 'review') {
    groups = reviewGroups(user);
    let ids = options.questionIds || [];
    const completed = many<{ snapshot: string; status: string; checked: string }>(
      "SELECT snapshot,status,checked FROM topik_sessions WHERE user_id=? AND (status='completed' OR checked<>'{}')",
      user.id,
    );
    const seen = new Set(
      completed.flatMap((s) =>
        questionsOf(JSON.parse(s.snapshot))
          .filter((q) => s.status === 'completed' || JSON.parse(s.checked || '{}')[q.id])
          .map((q) => q.id),
      ),
    );
    const saved = many<{ question_id: string }>(
      'SELECT question_id FROM topik_bookmarks WHERE user_id=?',
      user.id,
    ).map((b) => b.question_id);
    if (!ids.length) ids = options.dueOnly ? dueStudyIds(user.id, 'question') : saved;
    if (ids.some((qid) => !seen.has(qid)))
      throw new AppError(403, 'Faqat o‘zingiz yechgan savollarni qayta ishlashingiz mumkin.');
    const selected = new Set(ids);
    groups = groups.filter((g) => g.questions.some((q) => selected.has(q.id)));
    if (category !== 'all') groups = groups.filter((g) => g.category === category);
    if (!options.questionIds?.length) groups = practiceGroups(groups, requested);
  } else {
    if (options.grammarId)
      groups = groups.filter((g) =>
        g.questions.some((q) => q.grammarIds?.includes(options.grammarId!)),
      );
    if (category !== 'all') groups = groups.filter((g) => g.category === category);
    groups = practiceGroups(groups, requested);
  }
  if (!groups.length)
    throw new AppError(
      409,
      options.mode === 'review'
        ? 'Qayta yechish uchun savol saqlanmagan.'
        : 'Bu turdagi tekshirilgan savollar hali bazaga qo‘shilmagan.',
    );
  const total = questionsOf(groups).length;
  const intended = options.mode === 'mock' ? total : requested;
  const timestamp = now();
  const sessionId = id();
  const deadline =
    options.mode === 'mock' ? new Date(Date.now() + 70 * 60_000).toISOString() : null;
  const notice =
    options.mode === 'mock' && total === 48
      ? '42–43-savollarning matni manba PDFda berilmagan. Bu savollarni tashlab o‘ting. Ular baholanmaydi; qolgan 48 savolning har biri 2 ball (jami 96 ball).'
      : total !== intended
        ? `Bir matnga bog‘langan savollar birga saqlanadi. Bu mashqda ${total} ta savol bor (tanlangan: ${intended}).`
        : null;
  run(
    'INSERT INTO topik_sessions(id,user_id,mode,category,form_id,requested_count,actual_count,snapshot,started_at,deadline,notice) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    sessionId,
    user.id,
    options.mode,
    category,
    formId,
    intended,
    total,
    JSON.stringify(groups),
    timestamp,
    deadline,
    notice,
  );
  const seen: Record<string, boolean> = { _tracked: true };
  for (const prior of many<SessionRow>(
    'SELECT * FROM topik_sessions WHERE user_id=? AND id<>?',
    user.id,
    sessionId,
  )) {
    const priorChoices = JSON.parse(prior.choices),
      priorTime = JSON.parse(prior.timings || '{}');
    for (const q of questionsOf(JSON.parse(prior.snapshot)))
      if (prior.status === 'completed' || priorChoices[q.id] !== undefined || priorTime[q.id] > 0)
        seen[q.id] = true;
  }
  run('UPDATE topik_sessions SET seen_before=? WHERE id=?', JSON.stringify(seen), sessionId);
  return getTopikSession(user, sessionId);
}

export function answerTopikSession(
  user: User,
  sessionId: string,
  questionId: string,
  choice: number,
): TopikSession {
  if (!Number.isInteger(choice) || choice < 0 || choice > 3)
    throw new AppError(400, 'Javob variantini tanlang.');
  return transaction(() => {
    const row = expire(ownSession(user, sessionId));
    if (row.status !== 'active') return sessionView(row);
    if (!questionsOf(JSON.parse(row.snapshot)).some((q) => q.id === questionId))
      throw new AppError(400, 'Savol bu mashqqa tegishli emas.');
    if (JSON.parse(row.checked || '{}')[questionId])
      throw new AppError(
        409,
        'Tekshirilgan javobni o‘zgartirib bo‘lmaydi. Yana mashq qilish uchun yangi urinish boshlang.',
      );
    const choices: Record<string, number> = JSON.parse(row.choices);
    choices[questionId] = choice;
    run('UPDATE topik_sessions SET choices=? WHERE id=?', JSON.stringify(choices), row.id);
    return sessionView(ownSession(user, sessionId));
  });
}
export function finishTopikSession(user: User, sessionId: string): TopikSession {
  return transaction(() => {
    const row = ownSession(user, sessionId);
    return sessionView(finalize(row, !!row.deadline && row.deadline <= now()));
  });
}
function historyItem(row: SessionRow): TopikHistoryItem {
  return {
    id: row.id,
    mode: row.mode,
    category: row.category,
    formId: row.form_id,
    status: row.status,
    actualCount: row.actual_count,
    startedAt: row.started_at,
    deadline: row.deadline,
    completedAt: row.completed_at,
    score: row.status === 'completed' ? row.score : null,
    percent: row.status === 'completed' ? Math.round((row.score / row.actual_count) * 100) : null,
  };
}
function hydrateTopikReviews(user: User) {
  const key = `topik_review_history:${user.id}`;
  if (one('SELECT key FROM app_meta WHERE key=?', key)) return;
  // Import prior completed attempts into the review history exactly once.
  transaction(() => {
    for (const row of many<SessionRow>(
      "SELECT * FROM topik_sessions WHERE user_id=? AND status='completed' ORDER BY completed_at",
      user.id,
    )) {
      const choices = JSON.parse(row.choices),
        uncertain = JSON.parse(row.uncertain || '{}');
      for (const q of questionsOf(JSON.parse(row.snapshot)))
        recordStudy(
          user.id,
          'question',
          q.id,
          choices[q.id] === q.answer,
          !!uncertain[q.id],
          `topik:${row.id}:${q.id}`,
          row.completed_at!,
        );
    }
    run('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)', key, now());
  });
}
export function topikCatalog(user: User): TopikCatalog {
  requireTopikAccess(user);
  hydrateTopikReviews(user);
  const groups = topikGroups();
  const categories = TOPIK_CATEGORIES.map((c) => {
    const pool = groups.filter((g) => g.category === c.id);
    return {
      ...c,
      available: questionsOf(pool).length,
      official: questionsOf(pool.filter((g) => g.origin === 'official')).length,
      generated: questionsOf(pool.filter((g) => g.origin === 'generated')).length,
    };
  });
  const plan = JSON.parse(
    one<{ value: string }>('SELECT value FROM app_meta WHERE key=?', 'topik_mock_plan')?.value ||
      JSON.stringify({
        requestedForms: 12,
        readyForms: 0,
        questionCount: 48,
        skippedNumbers: [42, 43],
        shortages: planTopikMocks([]).shortages,
      }),
  );
  const forms = many<{ id: string; number: number }>(
    'SELECT id,number FROM topik_mock_forms WHERE current=1 ORDER BY number',
  );
  const reviewable = new Set(reviewGroups(user).flatMap((g) => g.questions.map((q) => q.id)));
  const rows = many<SessionRow>(
    'SELECT * FROM topik_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 100',
    user.id,
  ).map((row) => transaction(() => expire(row)));
  return {
    categories,
    total: questionsOf(groups).length,
    official: categories.reduce((n, c) => n + c.official, 0),
    generated: categories.reduce((n, c) => n + c.generated, 0),
    excluded:
      one<{ n: number }>('SELECT COUNT(*) n FROM topik_questions WHERE current=1 AND servable=0')
        ?.n || 0,
    corpusVersion:
      one<{ value: string }>('SELECT value FROM app_meta WHERE key=?', 'topik_corpus_version')
        ?.value || null,
    mock: {
      ...plan,
      minutes: 70,
      forms: Array.from({ length: 12 }, (_, i) => ({
        id: forms.find((f) => f.number === i + 1)?.id || `pending-${i + 1}`,
        number: i + 1,
        title: `한강 TOPIK 제 ${i + 1}회`,
        questionCount: plan.questionCount || 50,
        ready: forms.some((f) => f.number === i + 1),
      })),
    },
    activeSessions: rows.filter((s) => s.status === 'active').map(historyItem),
    history: rows.filter((s) => s.status === 'completed').map(historyItem),
    // Keep the badge consistent with the usable saved list after a corpus
    // revision revokes a passage. The bookmark itself remains for restoration.
    savedCount: topikBookmarks(user).length,
    dueQuestions: dueStudyIds(user.id, 'question').filter((qid) => reviewable.has(qid)).length,
    dueWords: studySummary(user.id).words,
  };
}
export function setTopikBookmark(user: User, questionId: string, saved: boolean) {
  if (!saved) {
    run('DELETE FROM topik_bookmarks WHERE user_id=? AND question_id=?', user.id, questionId);
    return { ok: true };
  }
  const seen = many<{ snapshot: string }>(
    "SELECT snapshot FROM topik_sessions WHERE user_id=? AND status='completed'",
    user.id,
  ).some((s) => questionsOf(JSON.parse(s.snapshot)).some((q) => q.id === questionId));
  if (!seen) throw new AppError(403, 'Savolni mashq tugaganidan keyin saqlashingiz mumkin.');
  run(
    'INSERT INTO topik_bookmarks(user_id,question_id,saved_at) VALUES(?,?,?) ON CONFLICT(user_id,question_id) DO NOTHING',
    user.id,
    questionId,
    now(),
  );
  return { ok: true };
}
export function topikBookmarks(user: User): TopikBookmark[] {
  const groups = reviewGroups(user);
  return many<{ question_id: string; saved_at: string }>(
    'SELECT * FROM topik_bookmarks WHERE user_id=? ORDER BY saved_at DESC',
    user.id,
  ).flatMap((b) => {
    const group = groups.find((g) => g.questions.some((q) => q.id === b.question_id));
    return group
      ? [{ questionId: b.question_id, savedAt: b.saved_at, group: publicGroups([group])[0] }]
      : [];
  });
}
export function topikVocabulary(
  category = 'all',
  kind: 'word' | 'idiom' = 'word',
): TopikVocabulary[] {
  if (category !== 'all' && category !== '1-4' && !categoryById(category))
    throw new AppError(400, 'Lug‘at turini tanlang.');
  return scopeVocabulary(
    readingWords().filter((w) => w.section === 'reading' && w.kind === kind),
    category,
  ).map(({ section, origin, groupIds, revision, edited, label, ...word }) => word);
}

export function markTopikUncertain(
  user: User,
  sessionId: string,
  questionId: string,
  value: boolean,
) {
  return transaction(() => {
    const row = expire(ownSession(user, sessionId));
    if (row.status !== 'active') return sessionView(row);
    if (!questionsOf(JSON.parse(row.snapshot)).some((q) => q.id === questionId))
      throw new AppError(400, 'Savol bu mashqqa tegishli emas.');
    if (JSON.parse(row.checked || '{}')[questionId])
      throw new AppError(409, 'Bu javob tekshirilgan.');
    const uncertain = JSON.parse(row.uncertain || '{}');
    uncertain[questionId] = value;
    run('UPDATE topik_sessions SET uncertain=? WHERE id=?', JSON.stringify(uncertain), row.id);
    return sessionView(ownSession(user, sessionId));
  });
}

export function trackTopikTime(
  user: User,
  sessionId: string,
  questionId: string,
  eventId: string,
  seconds: number,
) {
  return transaction(() => {
    const row = ownSession(user, sessionId);
    if (row.status !== 'active') return { ok: true };
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 60)
      throw new AppError(400, 'Vaqt oralig‘i yaroqsiz.');
    if (!questionsOf(JSON.parse(row.snapshot)).some((q) => q.id === questionId))
      throw new AppError(400, 'Savol bu mashqqa tegishli emas.');
    const timings: Record<string, number> = JSON.parse(row.timings || '{}');
    const elapsed = Math.max(
      0,
      Math.floor(
        (Math.min(Date.now(), row.deadline ? Date.parse(row.deadline) : Date.now()) -
          Date.parse(row.started_at)) /
          1000,
      ),
    );
    const counted = Object.values(timings).reduce((a, b) => a + b, 0);
    const accepted = Math.min(seconds, Math.max(0, elapsed - counted));
    const result = run(
      'INSERT OR IGNORE INTO topik_timing_events(session_id,event_id,question_id,seconds) VALUES(?,?,?,?)',
      row.id,
      eventId,
      questionId,
      accepted,
    );
    if (result.changes && accepted) {
      timings[questionId] = (timings[questionId] || 0) + accepted;
      run('UPDATE topik_sessions SET timings=? WHERE id=?', JSON.stringify(timings), row.id);
    }
    return { ok: true };
  });
}

export function checkTopikQuestion(
  user: User,
  sessionId: string,
  questionId: string,
): TopikSession {
  return transaction(() => {
    const row = expire(ownSession(user, sessionId));
    if (row.status === 'completed') return sessionView(row);
    if (row.mode === 'mock') throw new AppError(403, 'Mock javoblari imtihon yakunida ochiladi.');
    const question = questionsOf(JSON.parse(row.snapshot)).find((q) => q.id === questionId);
    if (!question) throw new AppError(404, 'Savol topilmadi.');
    const choices = JSON.parse(row.choices),
      checked = JSON.parse(row.checked || '{}');
    if (choices[questionId] === undefined) throw new AppError(400, 'Avval javobni tanlang.');
    checked[questionId] = true;
    run('UPDATE topik_sessions SET checked=? WHERE id=?', JSON.stringify(checked), row.id);
    recordStudy(
      user.id,
      'question',
      questionId,
      choices[questionId] === question.answer,
      !!JSON.parse(row.uncertain || '{}')[questionId],
      `topik:${row.id}:${questionId}`,
    );
    return sessionView(ownSession(user, sessionId));
  });
}
