import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { many, one, resetDbForTests, run } from '../lib/db';
import {
  answerTopikSession,
  finishTopikSession,
  getTopikSession,
  importTopikCorpus,
  planTopikMocks,
  setTopikBookmark,
  startTopikSession,
  topikBookmarks,
  topikCatalog,
  topikVocabulary,
} from '../lib/topik';
import { TOPIK_CATEGORIES, type TopikGroup, type TopikVocabulary } from '../lib/topik-types';
import type { User } from '../lib/types';

const student = { id: 'topik-student' } as User;
const other = { id: 'topik-other' } as User;
const bulkReviewer = { id: 'topik-bulk-reviewer' } as User;
const retiredReviewer = { id: 'topik-retired-reviewer' } as User;
let root: string;
const shared = new Set(['19-20', '21-22', '23-24', '42-43', '44-45', '46-47', '48-50']);
function corpus(exams = 12): TopikGroup[] {
  return Array.from({ length: exams }, (_, i) => i + 1).flatMap((exam) =>
    TOPIK_CATEGORIES.flatMap((c) => {
      const numbers = Array.from({ length: c.end - c.start + 1 }, (_, i) => c.start + i);
      return (shared.has(c.id) ? [numbers] : numbers.map((n) => [n])).map((slots) => ({
        id: `exam-${exam}-group-${slots[0]}`,
        category: c.id,
        origin: 'official' as const,
        source: { exam, file: `exam-${exam}.pdf`, pages: [Math.ceil(slots[0] / 3)] },
        instruction: '다음을 읽고 알맞은 것을 고르십시오.',
        passage: '함께 읽는 지문입니다.',
        blocks: [{ type: 'box' as const, text: '함께 읽는 지문입니다.' }],
        questions: slots.map((n) => ({
          id: `exam-${exam}-q-${n}`,
          number: n,
          prompt: `문제 ${n}`,
          options: ['가', '나', '다', '라'],
          answer: n % 4,
          explanation: `PRIVATE: answer ${n % 4}`,
          translation: 'PRIVATE translation',
        })),
      }));
    }),
  );
}
const full = corpus();
const words: TopikVocabulary[] = [
  {
    id: 'word-test',
    ko: '참여하다',
    uz: 'ishtirok etmoq',
    pos: '동사',
    example: '활동에 참여합니다.',
    translation: 'Faoliyatda ishtirok etadi.',
    categories: ['1-2', '3-4'],
    sourceQuestionIds: ['exam-1-q-1', 'exam-1-q-3'],
    frequency: 9,
    categoryFrequencies: { '1-2': 2, '3-4': 7 },
    categoryQuestionIds: { '1-2': ['exam-1-q-1'], '3-4': ['exam-1-q-3'] },
    kind: 'word',
  },
];

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-topik-test-'));
  resetDbForTests();
  process.env.DATA_DIR = root;
  for (const user of [student, other, bulkReviewer, retiredReviewer])
    run(
      'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      user.id,
      user.id,
      `${user.id}@test.local`,
      'unused',
      'student',
      new Date().toISOString(),
    );
  importTopikCorpus(full, words);
});
afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('TOPIK paper planning', () => {
  it('builds 12 stable, disjoint, complete papers while preserving each shared passage', () => {
    const plan = planTopikMocks(full, 'fixture');
    expect(plan.readyForms).toBe(12);
    expect(plan.shortages).toEqual([]);
    const questionIds = plan.forms.flatMap((form) =>
      form.flatMap((g) => g.questions.map((q) => q.id)),
    );
    expect(questionIds).toHaveLength(600);
    expect(new Set(questionIds).size).toBe(600);
    expect(planTopikMocks(full, 'fixture').forms.map((f) => f.map((g) => g.id))).toEqual(
      plan.forms.map((f) => f.map((g) => g.id)),
    );
    expect(planTopikMocks(full, 'other').forms[0].map((g) => g.id)).not.toEqual(
      plan.forms[0].map((g) => g.id),
    );
    for (const form of plan.forms) {
      let slot = 1;
      expect(form.flatMap((g) => g.questions)).toHaveLength(50);
      for (const group of form) {
        const category = TOPIK_CATEGORIES.find((c) => c.id === group.category)!;
        expect(slot).toBeGreaterThanOrEqual(category.start);
        expect(slot).toBeLessThanOrEqual(category.end);
        if (group.questions.length > 1)
          expect(group.questions.map((q) => q.number)).toEqual(
            Array.from({ length: group.questions.length }, (_, i) => slot + i),
          );
        slot += group.questions.length;
      }
    }
  });
  it('reuses real passages between forms when needed, but never repeats inside one form', () => {
    const sparse = full.filter((g) => g.id !== 'exam-1-group-48');
    const plan = planTopikMocks(sparse);
    expect(plan.readyForms).toBe(12);
    expect(plan.shortages).toEqual([]);
    const ids = plan.forms.flatMap((form) => form.flatMap((g) => g.questions.map((q) => q.id)));
    expect(ids).toHaveLength(600);
    expect(new Set(ids).size).toBe(597);
    for (const form of plan.forms) {
      const ids = form.flatMap((g) => g.questions.map((q) => q.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(plan.forms.every((f) => f.flatMap((g) => g.questions).length === 50)).toBe(true);
    expect(planTopikMocks(full.filter((g) => g.category !== '5-8')).readyForms).toBe(0);
  });
  it('does not use generated questions to fill missing official categories', () => {
    const generated = full.map((g) =>
      g.category === '5-8' ? { ...g, origin: 'generated' as const } : g,
    );
    expect(planTopikMocks(generated).readyForms).toBe(0);
    const plan = planTopikMocks(
      full.map((g) => (g.category === '42-43' ? { ...g, origin: 'generated' as const } : g)),
    );
    expect(plan.readyForms).toBe(12);
    expect(plan.skippedNumbers).toEqual([42, 43]);
    expect(plan.forms.every((form) => form.every((g) => g.origin === 'official'))).toBe(true);
  });
});

describe('TOPIK learning boundaries', () => {
  it('keeps answer keys private through saving and resuming, and grades only on finish', () => {
    const session = startTopikSession(student, { mode: 'practice', category: '1-2', count: 10 });
    expect(session.actualCount).toBe(10);
    expect(session.results).toBeUndefined();
    expect(JSON.stringify(session)).not.toContain('PRIVATE');
    const question = session.groups[0].questions[0];
    expect(question).not.toHaveProperty('answer');
    expect(question).not.toHaveProperty('explanation');
    const answer = one<{ answer: number }>(
      'SELECT answer FROM topik_questions WHERE id=?',
      question.id,
    )!.answer;
    const saved = answerTopikSession(student, session.id, question.id, answer);
    expect(saved.choices[question.id]).toBe(answer);
    expect(saved.score).toBeNull();
    expect(saved.results).toBeUndefined();
    expect(getTopikSession(student, session.id).choices[question.id]).toBe(answer);
    expect(() => getTopikSession(other, session.id)).toThrow('topilmadi');
    expect(() => answerTopikSession(other, session.id, question.id, answer)).toThrow('topilmadi');
    expect(() => answerTopikSession(student, session.id, 'unrelated', 0)).toThrow('tegishli');
    expect(() => answerTopikSession(student, session.id, question.id, 9)).toThrow('variantini');
    expect(() => setTopikBookmark(student, question.id, true)).toThrow('tugaganidan');
    const complete = finishTopikSession(student, session.id);
    expect(complete.score).toBe(1);
    expect(complete.results).toHaveLength(10);
    expect(complete.results![0].correct).toBe(true);
    expect(complete.results![1].choice).toBeNull();
    expect(finishTopikSession(student, session.id).score).toBe(1);
    expect(
      answerTopikSession(student, session.id, question.id, (answer + 1) % 4).choices[question.id],
    ).toBe(answer);
    setTopikBookmark(student, question.id, true);
    setTopikBookmark(student, question.id, true);
    expect(topikBookmarks(student)).toHaveLength(1);
    expect(topikBookmarks(other)).toHaveLength(0);
    expect(() => startTopikSession(other, { mode: 'review', questionIds: [question.id] })).toThrow(
      'o‘zingiz',
    );
    const retry = startTopikSession(student, { mode: 'review', questionIds: [question.id] });
    expect(retry.id).not.toBe(session.id);
    expect(retry.choices).toEqual({});
    expect(retry.results).toBeUndefined();
  });
  it('never splits shared passages and clearly reports the nearest compatible practice length', () => {
    const session = startTopikSession(student, { mode: 'practice', category: '48-50', count: 10 });
    expect(session.actualCount).toBe(9);
    expect(session.notice).toContain('9');
    expect(session.groups.every((g) => g.questions.length === 3)).toBe(true);
    const completed = finishTopikSession(student, session.id);
    const qid = completed.groups[0].questions[1].id;
    const retry = startTopikSession(student, { mode: 'review', questionIds: [qid] });
    expect(retry.actualCount).toBe(3);
  });
  it('enforces a server deadline and ignores answers submitted after expiry', () => {
    const form = topikCatalog(student).mock.forms.find((f) => f.ready)!;
    const session = startTopikSession(student, { mode: 'mock', formId: form.id });
    expect(session.actualCount).toBe(50);
    expect(
      new Date(session.deadline!).getTime() - new Date(session.startedAt).getTime(),
    ).toBeCloseTo(70 * 60_000, -2);
    run('UPDATE topik_sessions SET deadline=? WHERE id=?', '2000-01-01T00:00:00.000Z', session.id);
    const expired = answerTopikSession(student, session.id, session.groups[0].questions[0].id, 0);
    expect(expired.status).toBe('completed');
    expect(expired.timedOut).toBe(true);
    expect(expired.choices).toEqual({});
    expect(expired.score).toBe(0);
  });
  it('supports vocabulary category bands and keeps generated and official source labels explicit', () => {
    expect(topikVocabulary('1-4')).toEqual(words);
    expect(topikVocabulary('3-4')[0].frequency).toBe(7);
    expect(topikVocabulary('3-4')[0].sourceQuestionIds).toEqual(['exam-1-q-3']);
    expect(topikVocabulary('1-2')[0].frequency).toBe(2);
    expect(topikVocabulary('5-8')).toEqual([]);
    expect(topikVocabulary('all', 'idiom')).toEqual([]);
    expect(topikCatalog(student).official).toBe(600);
  });
  it('samples a bounded bulk review when a student has more than 50 saved questions', () => {
    for (const form of topikCatalog(bulkReviewer)
      .mock.forms.filter((f) => f.ready)
      .slice(0, 2)) {
      const session = startTopikSession(bulkReviewer, { mode: 'mock', formId: form.id });
      const completed = finishTopikSession(bulkReviewer, session.id);
      for (const group of completed.groups)
        for (const question of group.questions) setTopikBookmark(bulkReviewer, question.id, true);
    }
    expect(topikBookmarks(bulkReviewer)).toHaveLength(100);
    // The UI sends category/count, not an explicit list that bypasses sampling
    // or exceeds the API's per-request questionIds limit.
    const review = startTopikSession(bulkReviewer, { mode: 'review', count: 15 });
    expect(review.actualCount).toBe(15);
    expect(review.results).toBeUndefined();
    expect(new Set(review.groups.flatMap((g) => g.questions.map((q) => q.id))).size).toBe(15);
    const filtered = startTopikSession(bulkReviewer, {
      mode: 'review',
      category: '48-50',
      count: 15,
    });
    expect(filtered.groups.every((g) => g.category === '48-50' && g.questions.length === 3)).toBe(
      true,
    );
    expect(filtered.actualCount).toBe(6);
  });
});

describe('TOPIK corpus imports', () => {
  it('is idempotent, retains attempts and saves, and excludes an entire unverified passage', () => {
    const attempts = many('SELECT id FROM topik_sessions').length;
    const bookmarks = many('SELECT * FROM topik_bookmarks').length;
    expect(importTopikCorpus(full, words).unchanged).toBe(true);
    expect(many('SELECT id FROM topik_questions')).toHaveLength(600);
    const revised = structuredClone(full);
    revised.find((g) => g.id === 'exam-1-group-48')!.questions[1].answer = null;
    const result = importTopikCorpus(revised, words);
    expect(result.servable).toBe(597);
    expect(result.mockForms).toBe(12);
    expect(topikCatalog(student).excluded).toBe(3);
    expect(many('SELECT id FROM topik_sessions')).toHaveLength(attempts);
    expect(many('SELECT * FROM topik_bookmarks')).toHaveLength(bookmarks);
    const old = one<{ id: string }>(
      "SELECT id FROM topik_sessions WHERE status='completed' AND actual_count=50",
    )!;
    expect(getTopikSession(student, old.id).results).toHaveLength(50);
    expect(() => importTopikCorpus([...full, full[0]], words)).toThrow('Duplicate');
    expect(topikCatalog(student).excluded).toBe(3);
  });
  it('retakes retired saved questions from their owned snapshot and hides revoked bookmark counts', () => {
    importTopikCorpus(full, words);
    const form = topikCatalog(retiredReviewer).mock.forms.find((f) => f.ready)!;
    const session = startTopikSession(retiredReviewer, { mode: 'mock', formId: form.id });
    const completed = finishTopikSession(retiredReviewer, session.id);
    const saved = completed.groups.find((g) => g.category === '48-50')!;
    const questionId = saved.questions[1].id;
    setTopikBookmark(retiredReviewer, questionId, true);
    expect(topikCatalog(retiredReviewer).savedCount).toBe(1);

    importTopikCorpus(
      full.filter((g) => g.id !== saved.id),
      words,
    );
    expect(topikBookmarks(retiredReviewer)).toHaveLength(1);
    const retry = startTopikSession(retiredReviewer, { mode: 'review', questionIds: [questionId] });
    expect(retry.actualCount).toBe(3);
    expect(retry.groups[0].questions.map((q) => q.id)).toEqual(saved.questions.map((q) => q.id));
    expect(retry.results).toBeUndefined();

    const revoked = structuredClone(full);
    revoked.find((g) => g.id === saved.id)!.questions[0].verified = false;
    importTopikCorpus(revoked, words);
    expect(topikBookmarks(retiredReviewer)).toEqual([]);
    expect(topikCatalog(retiredReviewer).savedCount).toBe(0);
    expect(many('SELECT * FROM topik_bookmarks WHERE user_id=?', retiredReviewer.id)).toHaveLength(
      1,
    );
    expect(() =>
      startTopikSession(retiredReviewer, { mode: 'review', questionIds: [questionId] }),
    ).toThrow('saqlanmagan');
    expect(getTopikSession(retiredReviewer, session.id).results).toHaveLength(50);

    importTopikCorpus(full, words);
    expect(topikCatalog(retiredReviewer).savedCount).toBe(1);
  });
  it('leaves 42–43 empty, preserves original mock numbering and grades only 48 questions', () => {
    const available = full.filter((g) => g.category !== '42-43');
    importTopikCorpus(available, words);
    const catalog = topikCatalog(student);
    expect(catalog.mock).toMatchObject({
      readyForms: 12,
      questionCount: 48,
      skippedNumbers: [42, 43],
    });
    const session = startTopikSession(student, { mode: 'mock', formId: catalog.mock.forms[0].id });
    expect(session.actualCount).toBe(48);
    expect(session.requestedCount).toBe(48);
    expect(session.skippedNumbers).toEqual([42, 43]);
    expect(session.notice).toContain('tashlab o‘ting');
    const numbers = Array.from({ length: 50 }, (_, i) => i + 1).filter((n) => n !== 42 && n !== 43);
    expect(session.groups.flatMap((g) => g.questions.map((q) => q.displayNumber))).toEqual(numbers);
    for (const q of session.groups.flatMap((g) => g.questions))
      answerTopikSession(student, session.id, q.id, q.number % 4);
    const finished = finishTopikSession(student, session.id);
    expect(finished.score).toBe(48);
    expect(finished.percent).toBe(100);
    expect(finished.results?.map((r) => r.number)).toEqual(numbers);
    importTopikCorpus(full, words);
    expect(getTopikSession(student, session.id).skippedNumbers).toEqual([42, 43]);
    expect(getTopikSession(student, session.id).score).toBe(48);
  });
});

describe('automatic TOPIK review', () => {
  it('schedules wrong and uncertain answers once, preserves confidence, and scopes ownership', async () => {
    const { markTopikUncertain } = await import('../lib/topik');
    const { studySummary, rateStudyWord, recordStudy } = await import('../lib/study');
    const { transaction } = await import('../lib/db');
    const session = startTopikSession(student, { mode: 'practice', category: '1-2', count: 10 });
    const question = session.groups[0].questions[0];
    expect(() => markTopikUncertain(other, session.id, question.id, true)).toThrow();
    markTopikUncertain(student, session.id, question.id, true);
    const answer = one<{ answer: number }>(
      'SELECT answer FROM topik_questions WHERE id=?',
      question.id,
    )!.answer;
    answerTopikSession(student, session.id, question.id, answer);
    expect(getTopikSession(student, session.id).uncertain[question.id]).toBe(true);
    finishTopikSession(student, session.id);
    const first = studySummary(student.id).items.find((r) => r.item_id === question.id)!;
    expect(first.stage).toBe(0);
    finishTopikSession(student, session.id);
    expect(studySummary(student.id).items.find((r) => r.item_id === question.id)).toEqual(first);
    rateStudyWord(student, 'word-test', false, 'unique-event');
    rateStudyWord(student, 'word-test', false, 'unique-event');
    expect(studySummary(student.id).items.find((r) => r.item_id === 'word-test')!.wrong_count).toBe(
      1,
    );
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    transaction(() =>
      recordStudy(student.id, 'word', 'word-test', true, false, 'tomorrow', tomorrow),
    );
    expect(studySummary(student.id).items.find((r) => r.item_id === 'word-test')!.stage).toBe(1);
    transaction(() =>
      recordStudy(student.id, 'word', 'word-test', true, false, 'same-day', tomorrow),
    );
    expect(studySummary(student.id).items.find((r) => r.item_id === 'word-test')!.stage).toBe(1);
    expect(studySummary(other.id).items.some((r) => r.item_id === 'word-test')).toBe(false);
  });
});

describe('daily learning path', () => {
  it('persists today’s plan, resumes its attempt, and rejects another learner', async () => {
    const { dailyPlan, dailyStep } = await import('../lib/daily');
    const plan = dailyPlan(student, 10);
    expect(dailyPlan(student, 10).id).toBe(plan.id);
    expect(plan.steps.map((s) => s.kind)).toEqual(['words', 'reading', 'grammar']);
    const session = dailyStep(student, plan.id, 1);
    expect(dailyStep(student, plan.id, 1).id).toBe(session.id);
    expect(() => dailyStep(other, plan.id, 1)).toThrow();
    expect(dailyPlan(student, 20).id).not.toBe(plan.id);
  });
});

describe('learning progress and mock analytics', () => {
  it('counts TOPIK without exposing answers before completion and deduplicates time', async () => {
    const { trackTopikTime } = await import('../lib/topik');
    const { topikProgress } = await import('../lib/progress');
    const session = startTopikSession(student, { mode: 'practice', category: '1-2' });
    const q = session.groups[0].questions[0];
    run(
      'UPDATE topik_sessions SET started_at=? WHERE id=?',
      new Date(Date.now() - 60000).toISOString(),
      session.id,
    );
    trackTopikTime(student, session.id, q.id, 'tick1', 12);
    trackTopikTime(student, session.id, q.id, 'tick1', 12);
    expect(() => trackTopikTime(other, session.id, q.id, 'foreign', 10)).toThrow();
    expect(getTopikSession(student, session.id).analytics).toBeUndefined();
    const result = finishTopikSession(student, session.id);
    expect(result.analytics!.seconds).toBe(12);
    expect(result.analytics!.first.total + result.analytics!.seen.total).toBe(result.actualCount);
    expect(topikProgress(student.id).rows.some((s) => s.id === session.id)).toBe(true);
  });
});

it('counts grammar mastery across days and resets it after an uncertain result', async () => {
  const { grammarMastery } = await import('../lib/progress');
  const group = structuredClone(full[0]);
  group.questions[0].grammarIds = ['A01'];
  for (let day = 3; day >= 1; day--) {
    const stamp = new Date(Date.now() - day * 86400000).toISOString();
    run(
      "INSERT INTO topik_sessions(id,user_id,mode,category,requested_count,actual_count,snapshot,choices,status,score,started_at,completed_at) VALUES(?,?,'practice','1-2',1,1,?,?,'completed',1,?,?)",
      `mastery-${day}`,
      other.id,
      JSON.stringify([group]),
      JSON.stringify({ [group.questions[0].id]: group.questions[0].answer }),
      stamp,
      stamp,
    );
  }
  expect(grammarMastery(other.id, 'Asia/Tashkent').A01).toBe(3);
  run(
    "INSERT INTO topik_sessions(id,user_id,mode,category,requested_count,actual_count,snapshot,choices,uncertain,status,score,started_at,completed_at) VALUES(?,?,'practice','1-2',1,1,?,?,?,'completed',1,?,?)",
    'mastery-uncertain',
    other.id,
    JSON.stringify([group]),
    JSON.stringify({ [group.questions[0].id]: group.questions[0].answer }),
    JSON.stringify({ [group.questions[0].id]: true }),
    new Date().toISOString(),
    new Date().toISOString(),
  );
  expect(grammarMastery(other.id, 'Asia/Tashkent').A01).toBe(0);
});
