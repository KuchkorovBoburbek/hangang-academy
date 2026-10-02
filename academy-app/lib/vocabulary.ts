import { z } from 'zod';
import { id, now, run, one, many, transaction } from './db';
import { AppError, requireTeacher, teacherGroup, rateLimit } from './auth';
import { aiConfig } from './ai-config';
import { validateFile } from './files';
import { allVocabulary, visibleVocabularyWord } from './vocabulary-data';
import {
  bandLabel,
  type VocabularyInput,
  type VocabularyImportResult,
  type VocabularyJobView,
  type VocabularySection,
} from './vocabulary-types';
import type { User, Group } from './types';
import {
  scopeSchema,
  validateCategories,
  groupVocabularyLevel,
  openVocabularyTopics,
} from './vocabulary-access';
import { sameScope, scopeLabel, type VocabularyScope } from './vocabulary-types';

const text = (max: number) => z.string().trim().min(1).max(max);
export const vocabularySectionSchema = z.enum(['reading', 'writing', 'listening']);
export const vocabularyInputSchema = z
  .object({
    ko: text(100).refine((s) => /[가-힣]/u.test(s), 'Koreyscha so‘z kiriting.'),
    uz: text(250),
    pos: text(60),
    example: text(1000),
    translation: text(1000),
    kind: z.enum(['word', 'idiom']),
    section: vocabularySectionSchema,
    categories: z.array(text(20)).min(1).max(20),
    level: z.enum(['hangul', 'topik34', 'topik56']).default('topik34'),
    book: z.enum(['1A', '1B', '2A', '2B']).nullable().default(null),
  })
  .superRefine((w, ctx) => {
    try {
      scopeSchema.parse(w);
      validateCategories(w, w.categories);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Savollar diapazoni bo‘limga mos emas.',
        path: ['categories'],
      });
    }
  });
export const importSettingsSchema = z
  .object({
    section: vocabularySectionSchema,
    category: text(20),
    groupIds: z.array(z.uuid()).min(1).max(100),
    level: z.enum(['hangul', 'topik34', 'topik56']).default('topik34'),
    book: z.enum(['1A', '1B', '2A', '2B']).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    try {
      scopeSchema.parse(v);
      validateCategories(v, [v.category]);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Savollar diapazonini tanlang.',
        path: ['category'],
      });
    }
  });
export type ImportSettings = z.infer<typeof importSettingsSchema>;
export const normalizedWord = (s: string) =>
  s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function validateVocabularyGroups(user: User, groupIds: string[], scope?: VocabularyScope) {
  requireTeacher(user);
  if (!groupIds.length)
    throw new AppError(
      400,
      scope
        ? `${scopeLabel(scope)} uchun shu darajaga mos guruhni tanlang.`
        : 'Kamida bitta guruhni tanlang.',
    );
  for (const groupId of new Set(groupIds)) {
    teacherGroup(user, groupId);
    if (
      scope &&
      groupVocabularyLevel(one<Group>('SELECT * FROM groups WHERE id=?', groupId)!) !== scope.level
    )
      throw new AppError(400, 'Tanlangan guruhlar lug‘at darajasiga mos bo‘lishi kerak.');
  }
}
export function vocabularyNotification(
  userId: string,
  body: string,
  key: string,
  markup?: unknown,
  section: VocabularySection = 'reading',
) {
  if (!markup && process.env.APP_URL?.startsWith('https://'))
    markup = {
      inline_keyboard: [
        [
          {
            text: 'Lug‘atni ochish',
            web_app: { url: new URL('/vocabulary/' + section, process.env.APP_URL).href },
          },
        ],
      ],
    };
  run(
    'INSERT OR IGNORE INTO notifications(id,user_id,kind,body,dedupe_key,created_at,telegram_markup) VALUES(?,?,?,?,?,?,?)',
    id(),
    userId,
    'vocabulary',
    body,
    key,
    now(),
    markup ? JSON.stringify(markup) : null,
  );
}
function notifyStudents(user: User, settings: ImportSettings, count: number, key: string) {
  if (!count) return;
  for (const student of many<{ id: string; group_id: string }>(
    "SELECT id,group_id FROM users WHERE role='student'",
  )) {
    if (settings.groupIds.includes(student.group_id))
      vocabularyNotification(
        student.id,
        `${user.name} ${count} ta yangi so‘z qo‘shdi. O‘rganib oling! 🌱\n${scopeLabel(settings)} · ${bandLabel(settings.category)}\nLug‘at bo‘limida ma’no, misollar va mashq kartalari tayyor.`,
        `${key}:student:${student.id}`,
        undefined,
        settings.section,
      );
  }
}
export function editVocabulary(user: User, wordId: string, input: unknown, revision: number) {
  requireTeacher(user);
  const body = vocabularyInputSchema.parse(input);
  return transaction(() => {
    const word = visibleVocabularyWord(user, wordId);
    if (!word) throw new AppError(404, 'So‘z topilmadi.');
    if (word.revision !== revision)
      throw new AppError(409, 'So‘z boshqa oynada o‘zgartirilgan. Yangilab, qayta urinib ko‘ring.');
    const next = revision + 1;
    run(
      'INSERT INTO vocabulary_edits(word_id,body,revision,edited_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(word_id) DO UPDATE SET body=excluded.body,revision=excluded.revision,edited_by=excluded.edited_by,updated_at=excluded.updated_at',
      wordId,
      JSON.stringify(body),
      next,
      user.id,
      now(),
    );
    run(
      'INSERT INTO vocabulary_revisions(id,word_id,body,revision,edited_by,created_at) VALUES(?,?,?,?,?,?)',
      id(),
      wordId,
      JSON.stringify(body),
      next,
      user.id,
      now(),
    );
    return { ...word, ...body, revision: next, edited: true };
  });
}
// Called inside a transaction so publication and notifications commit together.
function insertWords(
  user: User,
  settings: ImportSettings,
  inputs: VocabularyInput[],
  key: string,
  skipped: string[] = [],
): VocabularyImportResult {
  validateVocabularyGroups(user, settings.groupIds, settings);
  const all = allVocabulary(user);
  for (const groupId of settings.groupIds)
    openVocabularyTopics(groupId, settings, [settings.category]);
  const result: VocabularyImportResult = { added: 0, duplicates: 0, skipped, words: [] };
  for (const raw of inputs) {
    const word = vocabularyInputSchema.parse(raw);
    const exists = all.find(
      (w) =>
        sameScope(w, word) &&
        word.categories.every((c) => w.categories.includes(c)) &&
        normalizedWord(w.ko) === normalizedWord(word.ko) &&
        (!w.createdBy || w.createdBy === user.id),
    );
    if (exists) {
      result.duplicates++;
      continue;
    }
    const wid = 'W' + id();
    run(
      'INSERT INTO vocabulary_entries(id,body,normalized_ko,section,group_ids,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
      wid,
      JSON.stringify(word),
      normalizedWord(word.ko),
      word.section,
      JSON.stringify([...new Set(settings.groupIds)]),
      user.id,
      now(),
    );
    all.push({
      ...word,
      id: wid,
      groupIds: settings.groupIds,
      origin: 'teacher',
      revision: 0,
      edited: false,
      frequency: 0,
      sourceQuestionIds: [],
      createdBy: user.id,
    });
    result.words.push({ id: wid, ko: word.ko, uz: word.uz });
    result.added++;
  }
  notifyStudents(user, settings, result.added, key);
  return result;
}
export function createVocabularyWord(
  user: User,
  input: unknown,
  groupIds: string[],
  requestKey: string,
) {
  requireTeacher(user);
  const word = vocabularyInputSchema.parse(input);
  validateVocabularyGroups(user, groupIds, word);
  return transaction(() => {
    const result = insertWords(
      user,
      {
        section: word.section,
        level: word.level,
        book: word.book,
        category: word.categories[0],
        groupIds,
      },
      [word],
      `manual-word:${user.id}:${requestKey}`,
    );
    for (const groupId of groupIds) openVocabularyTopics(groupId, word, word.categories);
    if (!result.added)
      throw new AppError(409, 'Bu so‘z shu bo‘limda mavjud. Uni tahrirlashingiz mumkin.');
    return { id: result.words[0].id };
  });
}
export type VocabularyJob = {
  id: string;
  requested_by: string;
  source: 'web' | 'telegram';
  request_key: string;
  section: VocabularySection;
  category: string;
  group_ids: string;
  input_text: string;
  image_data: string | null;
  image_mime: string | null;
  telegram_file_id: string | null;
  status: VocabularyJobView['status'];
  model: string;
  provider: 'openai' | 'openrouter';
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  level: VocabularyScope['level'];
  book: VocabularyScope['book'];
};
export function jobView(job: VocabularyJob): VocabularyJobView {
  return {
    id: job.id,
    source: job.source,
    section: job.section,
    category: job.category,
    status: job.status,
    result: job.result ? JSON.parse(job.result) : null,
    error: job.error,
    createdAt: job.created_at,
    level: job.level,
    book: job.book,
  };
}
export function vocabularyJobs(user: User) {
  requireTeacher(user);
  return many<VocabularyJob>(
    'SELECT * FROM vocabulary_jobs WHERE requested_by=? ORDER BY created_at DESC LIMIT 20',
    user.id,
  ).map(jobView);
}
export function queueVocabularyJob(
  user: User,
  rawSettings: unknown,
  input: {
    text: string;
    requestKey: string;
    source: 'web' | 'telegram';
    image?: { bytes: Buffer; mime: string };
    telegramFileId?: string;
  },
) {
  requireTeacher(user);
  const settings = importSettingsSchema.parse(rawSettings);
  validateVocabularyGroups(user, settings.groupIds, settings);
  const content = z.string().trim().max(10000).parse(input.text);
  const key = `${user.id}:${text(180).parse(input.requestKey)}`;
  const config = aiConfig();
  if (!config.enabled)
    throw new AppError(503, 'AI yordamchi hali ulanmagan. So‘zni qo‘lda qo‘shishingiz mumkin.');
  if (!content && !input.image && !input.telegramFileId)
    throw new AppError(400, 'Koreyscha so‘zlarni yozing yoki rasm yuboring.');
  if (input.image) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.image.mime))
      throw new AppError(400, 'JPG, PNG yoki WebP rasm yuboring.');
    validateFile(input.image.bytes, input.image.mime);
  }
  if (input.telegramFileId) text(300).parse(input.telegramFileId);
  return transaction(() => {
    const existing = one<VocabularyJob>('SELECT * FROM vocabulary_jobs WHERE request_key=?', key);
    if (existing) return jobView(existing);
    if (
      (one<{ n: number }>(
        "SELECT count(*) n FROM vocabulary_jobs WHERE requested_by=? AND status IN ('queued','running')",
        user.id,
      )?.n || 0) >= 2
    )
      throw new AppError(
        429,
        'Avvalgi lug‘at tayyorlanishini kuting. Bir vaqtda 2 ta so‘rov yuborish mumkin.',
      );
    rateLimit(`vocabulary-ai:${user.id}`, 30, 86400000);
    const jid = id(),
      time = now();
    run(
      'INSERT INTO vocabulary_jobs(id,requested_by,source,request_key,section,category,group_ids,input_text,image_data,image_mime,telegram_file_id,model,provider,created_at,updated_at,level,book) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      jid,
      user.id,
      input.source,
      key,
      settings.section,
      settings.category,
      JSON.stringify(settings.groupIds),
      content,
      input.image?.bytes.toString('base64') || null,
      input.image?.mime || null,
      input.telegramFileId || null,
      config.model,
      config.provider,
      time,
      time,
      settings.level,
      settings.book,
    );
    return jobView(one<VocabularyJob>('SELECT * FROM vocabulary_jobs WHERE id=?', jid)!);
  });
}
export function retryVocabularyJob(user: User, jobId: string) {
  requireTeacher(user);
  return transaction(() => {
    const job = one<VocabularyJob>(
      'SELECT * FROM vocabulary_jobs WHERE id=? AND requested_by=?',
      jobId,
      user.id,
    );
    if (!job) throw new AppError(404, 'So‘rov topilmadi.');
    if (job.status !== 'failed')
      throw new AppError(409, 'Faqat tugamagan so‘rovni qayta yuborish mumkin.');
    validateVocabularyGroups(user, JSON.parse(job.group_ids), job);
    if (!job.input_text && !job.image_data && !job.telegram_file_id)
      throw new AppError(400, 'Rasm saqlash muddati tugagan. Qayta yuboring.');
    if (!aiConfig(job.provider).enabled) throw new AppError(503, 'AI kaliti sozlanmagan.');
    if (
      (one<{ n: number }>(
        "SELECT count(*) n FROM vocabulary_jobs WHERE requested_by=? AND status IN ('queued','running')",
        user.id,
      )?.n || 0) >= 2
    )
      throw new AppError(429, 'Avvalgi so‘rovni kuting.');
    rateLimit(`vocabulary-ai:${user.id}`, 30, 86400000);
    run(
      "UPDATE vocabulary_jobs SET status='queued',error=NULL,updated_at=? WHERE id=?",
      now(),
      job.id,
    );
    return { ok: true };
  });
}
export function completeVocabularyJob(
  job: VocabularyJob,
  inputs: VocabularyInput[],
  skipped: string[],
) {
  return transaction(() => {
    const live = one<VocabularyJob>('SELECT * FROM vocabulary_jobs WHERE id=?', job.id);
    if (live?.status !== 'running') return;
    const user = one<User>('SELECT * FROM users WHERE id=?', job.requested_by);
    if (!user || user.role !== 'teacher') throw new AppError(403, 'Ustoz huquqi topilmadi.');
    const settings = importSettingsSchema.parse({
      section: job.section,
      category: job.category,
      groupIds: JSON.parse(job.group_ids),
      level: job.level,
      book: job.book,
    });
    const result = insertWords(
      user,
      settings,
      inputs.map((w) => ({
        ...w,
        level: settings.level,
        book: settings.book,
        section: settings.section,
        categories: [settings.category],
      })),
      `vocabulary-job:${job.id}`,
      skipped,
    );
    run(
      "UPDATE vocabulary_jobs SET status='completed',result=?,error=NULL,image_data=NULL,telegram_file_id=NULL,updated_at=? WHERE id=?",
      JSON.stringify(result),
      now(),
      job.id,
    );
    const lines = [
      `Lug‘at tayyor ✅\n${scopeLabel(job)} · ${bandLabel(job.category)}\n${result.added} ta yangi so‘z saqlandi. ${result.duplicates} ta mavjud so‘z o‘zgartirilmadi.`,
      ...result.words.map((w) => `${w.ko} — ${w.uz}`),
      ...skipped.map((note) => `Aniqlashtirish kerak: ${note}`),
    ];
    const chunks = [''];
    for (const line of lines) {
      if (chunks.at(-1)!.length + line.length + 1 > 3300) chunks.push('Lug‘at natijasi (davomi):');
      chunks[chunks.length - 1] += (chunks.at(-1) ? '\n' : '') + line;
    }
    chunks.forEach((chunk, index) =>
      vocabularyNotification(
        user.id,
        chunk,
        `vocabulary-job:${job.id}:result:${index}`,
        undefined,
        job.section,
      ),
    );
    return result;
  });
}
