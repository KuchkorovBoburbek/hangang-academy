import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { one, run, id, now, resetDbForTests } from '../lib/db';
import { ensureSeed } from '../lib/seed';
import { saveCourseGroup } from '../lib/courses';
import { allVocabulary, vocabularyCatalog, vocabularyList } from '../lib/vocabulary-data';
import {
  createVocabularyWord,
  editVocabulary,
  queueVocabularyJob,
  completeVocabularyJob,
  type VocabularyJob,
} from '../lib/vocabulary';
import { saveVocabularyAccess } from '../lib/vocabulary-access';
import { startVocabularyQuiz } from '../lib/vocabulary-quiz';
import { answerQuiz, getQuestion, getSession } from '../lib/learning';
import { studySummary } from '../lib/study';
import type { User } from '../lib/types';
import type { VocabularyInput, VocabularyScope } from '../lib/vocabulary-types';

let root: string,
  teacher: User,
  student: User,
  other: User,
  hangul: string,
  second: string,
  topik: string;
const scope: VocabularyScope = { level: 'hangul', book: '1A', section: 'reading' };
const input = (
  ko: string,
  topic: string,
  book: VocabularyScope['book'] = '1A',
): VocabularyInput => ({
  ko,
  uz: `${ko} ma’nosi`,
  pos: 'Ot',
  example: `${ko}입니다.`,
  translation: 'Bu misol.',
  kind: 'word',
  ...scope,
  book,
  categories: [topic],
});
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-curriculum-'));
  process.env.DATA_DIR = root;
  process.env.DEMO_MODE = 'true';
  process.env.ADMIN_EMAIL = 'teacher@hangang.local';
  process.env.ADMIN_PASSWORD = 'HangangTeacher2026!';
  process.env.AI_PROVIDER = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-only';
  ensureSeed();
  teacher = one<User>("SELECT * FROM users WHERE role='teacher'")!;
  student = one<User>("SELECT * FROM users WHERE email='student@hangang.local'")!;
  other = one<User>("SELECT * FROM users WHERE email='bekzod@hangang.local'")!;
  hangul = saveCourseGroup(teacher, { name: 'Seoulte morning', level: 'hangul' }).id;
  second = saveCourseGroup(teacher, { name: 'Seoulte evening', level: 'hangul' }).id;
  topik = saveCourseGroup(teacher, { name: 'TOPIK advanced', level: 'topik56' }).id;
  for (const [user, group] of [
    [student, hangul],
    [other, second],
  ] as const) {
    run('UPDATE users SET group_id=? WHERE id=?', group, user.id);
    user.group_id = group;
  }
});
afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});

it('starts groups closed and gives beginners four books with eight distinct topics each', () => {
  expect(allVocabulary(student)).toEqual([]);
  const catalog = vocabularyCatalog(student);
  expect(catalog.level).toBe('hangul');
  expect(catalog.scopes.map((s) => s.book)).toEqual(['1A', '1B', '2A', '2B']);
  expect(catalog.scopes.every((s) => s.topics.length === 8 && s.topics.every((t) => !t.open))).toBe(
    true,
  );
});

it('separates books, topics and groups, including the same word repeated in another topic', () => {
  expect(() => createVocabularyWord(teacher, input('교실', 'unit-1'), [], id())).toThrow(
    'Seoulte 1A',
  );
  createVocabularyWord(teacher, input('학교', 'unit-1'), [hangul], id());
  createVocabularyWord(teacher, input('학생', 'unit-1'), [hangul], id());
  createVocabularyWord(teacher, input('학교', 'unit-2'), [hangul], id());
  createVocabularyWord(teacher, input('친구', 'unit-2'), [hangul], id());
  createVocabularyWord(teacher, input('사람', 'unit-1', '1B'), [hangul], id());
  expect(vocabularyList(student, 'reading', 'unit-1', 'word', scope)).toHaveLength(2);
  expect(vocabularyList(student, 'reading', 'all', 'word', scope)).toHaveLength(4);
  expect(allVocabulary(other)).toEqual([]);
  expect(() => createVocabularyWord(teacher, input('금지', 'unit-9'), [hangul], id())).toThrow();
  expect(() => createVocabularyWord(teacher, input('금지', 'unit-1'), [topik], id())).toThrow(
    'daraja',
  );
});

it('opens a whole book including future words, while topic grants expose only selected topics', () => {
  saveVocabularyAccess(teacher, { groupId: second, scope, categories: ['unit-2'] });
  expect(allVocabulary(other).map((w) => w.categories)).toEqual([['unit-2'], ['unit-2']]);
  saveVocabularyAccess(teacher, { groupId: second, scope, categories: ['all'] });
  createVocabularyWord(teacher, input('선생님', 'unit-8'), [hangul], id());
  expect(vocabularyList(other, 'reading', 'all', 'word', scope)).toHaveLength(5);
  expect(allVocabulary(other).some((w) => w.book === '1B')).toBe(false);
  expect(() =>
    saveVocabularyAccess(student, { groupId: second, scope, categories: ['all'] }),
  ).toThrow();
  expect(() =>
    saveVocabularyAccess(teacher, {
      groupId: second,
      scope: { level: 'topik56', book: null, section: 'reading' },
      categories: ['all'],
    }),
  ).toThrow();
});

it('quizzes contain only selected authorized topics, hide answers, persist results and can be replayed', () => {
  const first = startVocabularyQuiz(student, {
    scope,
    categories: ['unit-1', 'unit-2'],
    count: 100,
  });
  expect(first.total).toBe(4);
  expect(first.question).not.toHaveProperty('answer');
  expect(first.results).toBeUndefined();
  const stored = getSession(first.id, student);
  const allowed = vocabularyList(student, 'reading', 'all', 'word', scope).filter((w) =>
    ['unit-1', 'unit-2'].some((c) => w.categories.includes(c)),
  );
  for (const qid of JSON.parse(stored.question_ids)) {
    const q = getQuestion(qid);
    expect(allowed.some((w) => w.id === q.topic_id)).toBe(true);
    answerQuiz(student, first.id, qid, q.answer);
  }
  expect(getSession(first.id, student).score).toBe(4);
  expect(studySummary(student.id).items.length).toBeGreaterThan(0);
  expect(startVocabularyQuiz(student, { scope, categories: ['unit-1'] }).total).toBe(2);
  expect(startVocabularyQuiz(student, { scope, categories: ['all'] }).id).not.toBe(first.id);
  expect(() => getSession(first.id, other)).toThrow();
});

it('revoking a topic also blocks in-progress quiz access and study reads', () => {
  saveVocabularyAccess(teacher, { groupId: second, scope, categories: ['unit-1'] });
  const quiz = startVocabularyQuiz(other, { scope, categories: ['unit-1'] });
  saveVocabularyAccess(teacher, { groupId: second, scope, categories: [] });
  expect(() => getSession(quiz.id, other)).toThrow('ochilmagan');
  expect(() => startVocabularyQuiz(other, { scope, categories: ['all'] })).toThrow('so‘z yo‘q');
  expect(allVocabulary(other)).toEqual([]);
});

it('keeps TOPIK 3/4 and 5/6 separate with question-type scopes and teacher ownership', () => {
  const topikScope: VocabularyScope = { level: 'topik56', book: null, section: 'reading' };
  const word = { ...input('학문', 'unit-1'), ...topikScope, categories: ['9-12'] };
  const created = createVocabularyWord(teacher, word, [topik], id());
  run('UPDATE users SET group_id=? WHERE id=?', topik, other.id);
  other.group_id = topik;
  expect(allVocabulary(other).map((w) => w.id)).toEqual([created.id]);
  expect(allVocabulary(student).some((w) => w.id === created.id)).toBe(false);
  expect(vocabularyCatalog(other).scopes.map((s) => s.section)).toEqual([
    'reading',
    'writing',
    'listening',
  ]);
  expect(startVocabularyQuiz(other, { scope: topikScope, categories: ['9-12'] }).total).toBe(1);
  const foreign = { ...teacher, id: id(), email: 'another@example.test' };
  run(
    'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    foreign.id,
    'Other teacher',
    foreign.email,
    'unused',
    'teacher',
    now(),
  );
  expect(() => editVocabulary(foreign, created.id, word, 0)).toThrow('topilmadi');
  expect(() =>
    saveVocabularyAccess(foreign, { groupId: topik, scope: topikScope, categories: ['all'] }),
  ).toThrow();
});

it('AI publication retains the requested book and topic and cannot choose its own target', () => {
  const job = queueVocabularyJob(
    teacher,
    { ...scope, book: '2B', category: 'unit-7', groupIds: [hangul] },
    { text: '나라', requestKey: id(), source: 'web' },
  );
  expect(job).toMatchObject({ level: 'hangul', book: '2B', category: 'unit-7' });
  run("UPDATE vocabulary_jobs SET status='running' WHERE id=?", job.id);
  completeVocabularyJob(
    one<VocabularyJob>('SELECT * FROM vocabulary_jobs WHERE id=?', job.id)!,
    [input('나라', 'unit-1')],
    [],
  );
  expect(
    vocabularyList(student, 'reading', 'unit-7', 'word', { ...scope, book: '2B' }).map((w) => w.ko),
  ).toEqual(['나라']);
});
