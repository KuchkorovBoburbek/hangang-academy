import { matchWords } from '../lib/word-context';
import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { id, now, one, many, run, resetDbForTests } from '../lib/db';
import { ensureSeed } from '../lib/seed';
import { importTopikFiles, topikVocabulary } from '../lib/topik';
import { vocabulary } from '../lib/library';
import { allVocabulary, vocabularyList } from '../lib/vocabulary-data';
import {
  editVocabulary,
  createVocabularyWord,
  queueVocabularyJob,
  vocabularyJobs,
  retryVocabularyJob,
  type VocabularyJob,
} from '../lib/vocabulary';
import {
  processVocabularyJob,
  extractVocabulary,
  telegramVocabularyImage,
} from '../lib/vocabulary-ai';
import { handleVocabularyBot } from '../lib/vocabulary-bot';
import { rateStudyWord, studySummary } from '../lib/study';
import { topikTeachingReport, createTopikAssignment, studyAssignment } from '../lib/topik-teaching';
import type { User, Group } from '../lib/types';
import type { VocabularyInput } from '../lib/vocabulary-types';
let root: string, teacher: User, student: User, other: User, group: Group, otherGroup: string;
const word = (ko = '실험어'): VocabularyInput => ({
  ko,
  uz: 'sinov so‘zi',
  pos: 'Ot',
  example: `${ko}를 배워요.`,
  translation: 'Sinov so‘zini o‘rganaman.',
  kind: 'word',
  section: 'writing',
  categories: ['53'],
});
const settings = () => ({ section: 'writing', category: '53', groupIds: [group.id] });
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-vocabulary-'));
  process.env.DATA_DIR = root;
  process.env.DEMO_MODE = 'true';
  process.env.ADMIN_EMAIL = 'teacher@hangang.local';
  process.env.ADMIN_PASSWORD = 'HangangTeacher2026!';
  process.env.AI_PROVIDER = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-key';
  ensureSeed();
  importTopikFiles();
  teacher = one<User>("SELECT * FROM users WHERE role='teacher'")!;
  student = one<User>('SELECT * FROM users WHERE email=?', 'student@hangang.local')!;
  other = one<User>('SELECT * FROM users WHERE email=?', 'bekzod@hangang.local')!;
  group = one<Group>('SELECT * FROM groups')!;
  otherGroup = id();
  run(
    'INSERT INTO groups(id,name,level,invite_code,teacher_id,created_at) VALUES(?,?,?,?,?,?)',
    otherGroup,
    'Other',
    '2',
    'OTHER',
    teacher.id,
    now(),
  );
  run('UPDATE users SET group_id=? WHERE id=?', otherGroup, other.id);
  other.group_id = otherGroup;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});

it('unifies existing words while preserving IDs, meanings and TOPIK frequency filters', () => {
  expect(topikVocabulary()).toHaveLength(291);
  expect(allVocabulary(student).find((w) => w.id === 'V01')).toBeTruthy();
  expect(
    vocabularyList(student, 'reading', '1-4').every((w) =>
      w.categories.some((c) => ['1-2', '3-4', '1-4'].includes(c)),
    ),
  ).toBe(true);
  expect(vocabularyList(student, 'writing')).toHaveLength(0);
});
it('teachers edit base and imported words; student edits, stale versions and invalid sections are rejected', () => {
  const target = topikVocabulary()[0];
  expect(() => editVocabulary(student, target.id, { ...target, section: 'reading' }, 0)).toThrow(
    'o‘qituvchilar',
  );
  editVocabulary(teacher, target.id, { ...target, section: 'reading', uz: 'Tahrir saqlanadi' }, 0);
  expect(() => editVocabulary(teacher, target.id, { ...target, section: 'reading' }, 0)).toThrow(
    'boshqa oynada',
  );
  importTopikFiles();
  expect(topikVocabulary().find((w) => w.id === target.id)?.uz).toBe('Tahrir saqlanadi');
  editVocabulary(teacher, target.id, { ...target, section: 'reading', ko: '완전히다른말' }, 1);
  const renamed = topikVocabulary().find((w) => w.id === target.id)!;
  expect(matchWords(target.ko, [renamed])).toHaveLength(0);

  const base = allVocabulary(teacher).find((w) => w.id === 'V01')!;
  editVocabulary(teacher, base.id, { ...base, uz: 'Asosiy so‘z tahriri' }, base.revision);
  expect(vocabulary(student).find((w) => w.id === base.id)?.uz).toBe('Asosiy so‘z tahriri');
  expect(() =>
    editVocabulary(teacher, target.id, { ...target, section: 'writing', categories: ['1-4'] }, 1),
  ).toThrow();
});
it('new words are scoped, studyable, and notify only selected students after a successful commit', () => {
  const result = createVocabularyWord(teacher, word(), [group.id], id());
  expect(vocabularyList(student, 'writing', '53').some((w) => w.id === result.id)).toBe(true);
  expect(vocabularyList(other, 'writing').some((w) => w.id === result.id)).toBe(false);
  expect(vocabulary(other).some((w) => w.id === result.id)).toBe(false);
  expect(() => rateStudyWord(other, result.id, true, id())).toThrow('topilmadi');
  rateStudyWord(student, result.id, false, 'new-word');
  expect(studySummary(student.id).items.some((r) => r.item_id === result.id)).toBe(true);
  const report = topikTeachingReport(teacher).find((g) => g.groupId === group.id)!;
  expect(report.words.some((w) => w.id === result.id)).toBe(true);
  const assignment = createTopikAssignment(
    teacher,
    group.id,
    undefined,
    [result.id],
    new Date(Date.now() + 86400000).toISOString(),
  );
  expect(studyAssignment(student, assignment.id).words[0].id).toBe(result.id);
  expect(() =>
    createTopikAssignment(teacher, otherGroup, undefined, [result.id], new Date().toISOString()),
  ).toThrow();
  const notices = many<{ user_id: string }>(
    "SELECT user_id FROM notifications WHERE dedupe_key LIKE 'manual-word:%'",
  );
  expect(notices.some((n) => n.user_id === student.id)).toBe(true);
  expect(notices.some((n) => n.user_id === other.id)).toBe(false);
  expect(() => createVocabularyWord(teacher, word(), [group.id], id())).toThrow('mavjud');
});
it('queues once per request key, blocks student/foreign group/image misuse, and does not notify before success', () => {
  expect(() =>
    queueVocabularyJob(student, settings(), { text: '도전', requestKey: id(), source: 'web' }),
  ).toThrow();
  expect(() =>
    queueVocabularyJob(
      teacher,
      { ...settings(), groupIds: [id()] },
      { text: '도전', requestKey: id(), source: 'web' },
    ),
  ).toThrow();
  expect(() =>
    queueVocabularyJob(teacher, settings(), {
      text: '',
      requestKey: id(),
      source: 'web',
      image: { bytes: Buffer.from('wrong'), mime: 'image/png' },
    }),
  ).toThrow();
  const key = id();
  const job = queueVocabularyJob(teacher, settings(), {
    text: '도전',
    requestKey: key,
    source: 'web',
  });
  expect(
    queueVocabularyJob(teacher, settings(), { text: '도전', requestKey: key, source: 'web' }).id,
  ).toBe(job.id);
  expect(
    one(
      'SELECT id FROM notifications WHERE dedupe_key LIKE ?',
      `vocabulary-job:${job.id}:student:%`,
    ),
  ).toBeUndefined();
  run("UPDATE vocabulary_jobs SET status='failed' WHERE id=?", job.id);
});
it('AI worker publishes validated words atomically, skips uncertain items, and sends the teacher the complete result', async () => {
  const job = queueVocabularyJob(teacher, settings(), {
    text: '발돋움 흐릿한',
    requestKey: id(),
    source: 'web',
  });
  const output = {
    words: [
      { ...word('발돋움'), certainty: 'clear', note: '' },
      { ...word('흐릿한'), certainty: 'uncertain', note: 'Rasmni tiniqroq yuboring.' },
    ],
    skipped: [],
  };
  const fetcher = vi.fn(async (_url, options) => {
    const request = JSON.parse(options.body);
    expect(request.model).toBeTruthy();
    expect(request.response_format.json_schema.strict).toBe(true);
    return Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }],
    });
  });
  vi.stubGlobal('fetch', fetcher);
  await processVocabularyJob();
  const done = vocabularyJobs(teacher).find((j) => j.id === job.id)!;
  expect(done.status).toBe('completed');
  expect(done.result?.added).toBe(1);
  expect(done.result?.skipped).toHaveLength(1);
  expect(vocabularyList(student, 'writing').some((w) => w.ko === '흐릿한')).toBe(false);
  expect(
    one<{ body: string }>(
      'SELECT body FROM notifications WHERE dedupe_key=?',
      `vocabulary-job:${job.id}:result:0`,
    )?.body,
  ).toContain('발돋움');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await processVocabularyJob();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('incomplete AI output cannot publish or notify students; only owner can retry', async () => {
  const job = queueVocabularyJob(teacher, settings(), {
    text: '재도약',
    requestKey: id(),
    source: 'web',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    ),
  );
  await processVocabularyJob();
  expect(vocabularyJobs(teacher).find((j) => j.id === job.id)?.status).toBe('failed');
  expect(
    one(
      'SELECT id FROM notifications WHERE dedupe_key=?',
      `vocabulary-job:${job.id}:student:${student.id}`,
    ),
  ).toBeUndefined();
  expect(() => retryVocabularyJob(student, job.id)).toThrow();
  retryVocabularyJob(teacher, job.id);
  run("UPDATE vocabulary_jobs SET status='failed' WHERE id=?", job.id);
});
it('sends uploaded image bytes to the pinned provider without sending them to an unrelated endpoint', async () => {
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM9sAAAAASUVORK5CYII=',
    'base64',
  );
  const job = queueVocabularyJob(teacher, settings(), {
    text: '',
    image: { bytes: image, mime: 'image/png' },
    requestKey: id(),
    source: 'web',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opts) => {
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(opts.body);
      expect(body.messages[1].content[1].image_url.url).toBe(
        `data:image/png;base64,${image.toString('base64')}`,
      );
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: JSON.stringify({ words: [], skipped: ['Rasmda so‘z yo‘q.'] }) },
          },
        ],
      });
    }),
  );
  await extractVocabulary(one<VocabularyJob>('SELECT * FROM vocabulary_jobs WHERE id=?', job.id)!);
  run("UPDATE vocabulary_jobs SET status='failed' WHERE id=?", job.id);
});
it('Telegram private teacher wizard supports groups/text/photos and deduplicates retried updates', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot';
  run('UPDATE users SET telegram_id=? WHERE id=?', '123456', teacher.id);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ ok: true })),
  );
  let sequence = 900;
  const msg = (text: string) => ({
    update_id: sequence++,
    message: { from: { id: 123456 }, chat: { id: 123456, type: 'private' }, text },
  });
  const callback = (data: string) => ({
    update_id: sequence++,
    callback_query: {
      id: String(sequence),
      from: { id: 123456 },
      message: { chat: { id: 123456, type: 'private' } },
      data,
    },
  });
  await handleVocabularyBot(msg('/lugat'));
  await handleVocabularyBot(callback('v:section:listening'));
  await handleVocabularyBot(callback('v:band:1-5'));
  const toggle = callback(`v:group:${group.id}`);
  await handleVocabularyBot(toggle);
  await handleVocabularyBot(toggle);
  expect(
    JSON.parse(
      one<{ group_ids: string }>(
        'SELECT group_ids FROM vocabulary_bot_state WHERE user_id=?',
        teacher.id,
      )!.group_ids,
    ),
  ).toEqual([group.id]);
  await handleVocabularyBot(callback('v:ready'));
  const input = msg('듣다 들리다');
  await handleVocabularyBot(input);
  await handleVocabularyBot(input);
  const jobs = many<VocabularyJob>("SELECT * FROM vocabulary_jobs WHERE source='telegram'");
  expect(jobs).toHaveLength(1);
  expect(jobs[0].section).toBe('listening');
  await handleVocabularyBot({
    update_id: sequence++,
    message: {
      from: { id: 123456 },
      chat: { id: 123456, type: 'private' },
      photo: [{ file_id: 'a-photo', file_size: 500 }],
    },
  });
  expect(
    many<VocabularyJob>(
      "SELECT * FROM vocabulary_jobs WHERE source='telegram' AND telegram_file_id='a-photo'",
    ),
  ).toHaveLength(1);
  expect(
    await handleVocabularyBot({
      update_id: sequence++,
      message: { from: { id: 123456 }, chat: { id: -123, type: 'group' }, text: '비밀' },
    }),
  ).toBe(false);
});
it('Telegram image download rejects paths outside the Telegram file endpoint and oversize files', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ ok: true, result: { file_path: '../token', file_size: 100 } }),
    ),
  );
  await expect(telegramVocabularyImage('fake')).rejects.toThrow('olinmadi');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        ok: true,
        result: { file_path: 'photos/file.jpg', file_size: 6 * 1024 * 1024 },
      }),
    ),
  );
  await expect(telegramVocabularyImage('fake')).rejects.toThrow('5 MB');
});
