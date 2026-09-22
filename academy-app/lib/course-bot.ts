import { z } from 'zod';
import { id, one, many, run, transaction, now } from './db';
import { rateLimit, AppError } from './auth';
import { courseCatalog, ownLesson, saveLesson } from './courses';
import { aiConfig } from './ai-config';
import { vocabularyNotification } from './vocabulary';
import { extractVocabulary } from './vocabulary-ai';
import type { VocabularyJob } from './vocabulary';
import type { User } from './types';
const sender = z.object({ id: z.number().int(), is_bot: z.boolean().optional() });
const room = z.object({ id: z.number().int(), type: z.string() });
const file = z.object({
  file_id: z.string().max(300),
  file_size: z.number().optional(),
  mime_type: z.string().optional(),
});
const schema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      from: sender.optional(),
      chat: room,
      text: z.string().max(10000).optional(),
      caption: z.string().max(10000).optional(),
      photo: z.array(file).max(20).optional(),
      document: file.optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string().max(200),
      from: sender,
      data: z.string().max(64).optional(),
      message: z.object({ chat: room }).optional(),
    })
    .optional(),
});
export function courseWordJobs(user: User, lessonId: string) {
  ownLesson(user, lessonId);
  return many<{
    id: string;
    status: string;
    result: string | null;
    error: string | null;
    created_at: string;
  }>(
    'SELECT id,status,result,error,created_at FROM course_word_jobs WHERE lesson_id=? ORDER BY created_at DESC LIMIT 10',
    lessonId,
  ).map((j) => ({ ...j, result: j.result ? JSON.parse(j.result) : null }));
}
export async function handleCourseBot(raw: unknown) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return false;
  const u = parsed.data,
    cb = u.callback_query,
    msg = u.message,
    actor = cb?.from || msg?.from,
    chat = cb?.message?.chat || msg?.chat;
  if (!actor || actor.is_bot || chat?.type !== 'private' || chat.id !== actor.id) return false;
  if (cb && !cb.data?.startsWith('c:')) return false;
  const command = (msg?.text || '').split(/\s/)[0].split('@')[0].toLowerCase();
  const user = one<User>('SELECT * FROM users WHERE telegram_id=?', String(actor.id));
  if (!user || user.role !== 'teacher') return false;
  const state = one<{ lesson_id: string; updated_at: string }>(
    'SELECT * FROM course_bot_state WHERE user_id=?',
    user.id,
  );
  if (command === '/lugat' || command === '/vocabulary' || command === '/start') {
    run('DELETE FROM course_bot_state WHERE user_id=?', user.id);
    return false;
  }
  const active = state && Date.parse(state.updated_at) > Date.now() - 86400000;
  if (command !== '/dars' && !cb && !active) return false;
  if (one('SELECT update_id FROM vocabulary_bot_updates WHERE update_id=?', u.update_id))
    return true;
  rateLimit(`course-bot:${user.id}`, 60, 60000);
  if (cb && process.env.TELEGRAM_BOT_TOKEN)
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id }),
        signal: AbortSignal.timeout(5000),
      },
    ).catch(() => undefined);
  const key = `course-bot:${u.update_id}`;
  try {
    transaction(() => {
      if (one('SELECT update_id FROM vocabulary_bot_updates WHERE update_id=?', u.update_id))
        return;
      if (command === '/bekor' || command === '/cancel' || cb?.data === 'c:cancel') {
        run('DELETE FROM course_bot_state WHERE user_id=?', user.id);
        vocabularyNotification(
          user.id,
          'Darsga so‘z kiritish tugatildi. Qayta boshlash: /dars.',
          key,
        );
      } else if (command === '/dars') {
        run('DELETE FROM vocabulary_bot_state WHERE user_id=?', user.id);
        run(
          'INSERT INTO course_bot_state(user_id,updated_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET lesson_id=NULL,updated_at=excluded.updated_at',
          user.id,
          now(),
        );
        const catalog = courseCatalog(user);
        vocabularyNotification(
          user.id,
          'Dars lug‘ati 🌿\nDarajani tanlang. AI natijasini saytda ko‘rib, dars qoralamasiga qo‘shasiz.',
          key,
          {
            inline_keyboard: [
              ...catalog.courses.map((c) => [{ text: c.title, callback_data: `c:course:${c.id}` }]),
              [{ text: 'Bekor qilish', callback_data: 'c:cancel' }],
            ],
          },
        );
      } else if (cb?.data?.startsWith('c:course:')) {
        const course = courseCatalog(user).courses.find((c) => c.id === cb.data!.slice(9));
        if (!course) throw new AppError(404, 'Dastur topilmadi.');
        vocabularyNotification(
          user.id,
          course.lessons.length
            ? 'Qaysi darsga so‘z tayyorlaymiz?'
            : 'Avval saytda shu dasturga dars qo‘shing. Keyin /dars yuboring.',
          key,
          {
            inline_keyboard: [
              ...course.lessons
                .slice(0, 80)
                .map((l) => [
                  {
                    text: `${l.position}. ${l.title}`.slice(0, 60),
                    callback_data: `c:lesson:${l.id}`,
                  },
                ]),
              [{ text: 'Bekor qilish', callback_data: 'c:cancel' }],
            ],
          },
        );
      } else if (cb?.data?.startsWith('c:lesson:')) {
        const lesson = ownLesson(user, cb.data.slice(9));
        run(
          'INSERT INTO course_bot_state(user_id,lesson_id,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET lesson_id=excluded.lesson_id,updated_at=excluded.updated_at',
          user.id,
          lesson.id,
          now(),
        );
        vocabularyNotification(
          user.id,
          `${lesson.title}\n\nKoreyscha so‘zlarni yozing yoki rasm yuboring (5 MB gacha). AI tarjima va misollar tayyorlaydi. Natijani saytdagi dars qoralamasida tasdiqlaysiz; o‘quvchilarga hali ochilmaydi.\n\nTugatish: /bekor.`,
          key,
        );
      } else if (active && state.lesson_id && msg) {
        ownLesson(user, state.lesson_id);
        const config = aiConfig();
        if (!config.enabled) throw new AppError(503, 'AI hali ulanmagan.');
        const photo = msg.photo?.at(-1) || msg.document;
        if (
          photo &&
          ((photo.file_size || 0) > 5 * 1024 * 1024 ||
            (msg.document &&
              !['image/jpeg', 'image/png', 'image/webp'].includes(msg.document.mime_type || '')))
        )
          throw new AppError(400, 'JPG, PNG yoki WebP rasm yuboring, 5 MB gacha.');
        const text = msg.text || msg.caption || '';
        if (!text && !photo) throw new AppError(400, 'So‘z yoki rasm yuboring.');
        if (
          (one<{ n: number }>(
            "SELECT COUNT(*) n FROM course_word_jobs WHERE requested_by=? AND status IN ('queued','running')",
            user.id,
          )?.n || 0) >= 2
        )
          throw new AppError(429, 'Avvalgi so‘rovlar tugashini kuting.');
        const today = new Date(Date.now() - 86400000).toISOString();
        if (
          (one<{ n: number }>(
            'SELECT COUNT(*) n FROM course_word_jobs WHERE requested_by=? AND created_at>?',
            user.id,
            today,
          )?.n || 0) >= 30
        )
          throw new AppError(429, 'Bir kunda 30 ta so‘rovgacha.');
        run(
          'INSERT INTO course_word_jobs(id,lesson_id,requested_by,request_key,input_text,telegram_file_id,provider,model,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          id(),
          state.lesson_id,
          user.id,
          key,
          text,
          photo?.file_id || null,
          config.provider,
          config.model,
          now(),
          now(),
        );
        vocabularyNotification(
          user.id,
          'So‘zlar AI navbatiga qo‘shildi. Natija tayyor bo‘lgach shu yerga xabar keladi.',
          key,
        );
      } else vocabularyNotification(user.id, 'Darsni tanlash uchun /dars yuboring.', key);
      run(
        'INSERT OR IGNORE INTO vocabulary_bot_updates(update_id,created_at) VALUES(?,?)',
        u.update_id,
        now(),
      );
    });
  } catch (e) {
    vocabularyNotification(
      user.id,
      e instanceof AppError ? e.message : 'So‘rov bajarilmadi. /dars orqali qayta boshlang.',
      key,
    );
  }
  return true;
}
export async function processCourseWordJob() {
  const job = transaction(() => {
    const j = one<{
      id: string;
      lesson_id: string;
      requested_by: string;
      input_text: string;
      telegram_file_id: string | null;
      provider: VocabularyJob['provider'];
      model: string;
    }>("SELECT * FROM course_word_jobs WHERE status='queued' ORDER BY created_at LIMIT 1");
    if (j) run("UPDATE course_word_jobs SET status='running',updated_at=? WHERE id=?", now(), j.id);
    return j;
  });
  if (!job) return;
  try {
    const user = one<User>('SELECT * FROM users WHERE id=?', job.requested_by);
    if (!user) throw new Error('Ustoz topilmadi.');
    ownLesson(user, job.lesson_id);
    const result = await extractVocabulary({
      ...job,
      section: 'reading',
      category: 'general',
      image_data: null,
      image_mime: null,
    } as unknown as VocabularyJob);
    transaction(() => {
      ownLesson(user, job.lesson_id);
      const done = run(
        "UPDATE course_word_jobs SET status='completed',result=?,telegram_file_id=NULL,updated_at=? WHERE id=? AND status='running'",
        JSON.stringify(result),
        now(),
        job.id,
      );
      if (!done.changes) return;
      const lines = result.words.map((w) => `${w.ko} — ${w.uz}`).join('\n');
      vocabularyNotification(
        user.id,
        `Dars lug‘ati tayyor: ${result.words.length} so‘z.\n${lines.slice(0, 2600)}\n\nNatijani saytda tekshirib, darsga qo‘shing.`,
        `course-ready:${job.id}`,
        process.env.APP_URL?.startsWith('https://')
          ? {
              inline_keyboard: [
                [
                  {
                    text: 'Dars qoralamasini ochish',
                    url: `${process.env.APP_URL}/courses?lesson=${job.lesson_id}`,
                  },
                ],
              ],
            }
          : undefined,
      );
    });
  } catch {
    run(
      "UPDATE course_word_jobs SET status='failed',error=?,telegram_file_id=NULL,updated_at=? WHERE id=? AND status='running'",
      'AI natijasi olinmadi. /dars orqali qayta yuboring.',
      now(),
      job.id,
    );
    vocabularyNotification(
      job.requested_by,
      'Dars lug‘ati tayyorlanmadi. /dars orqali qayta yuboring.',
      `course-failed:${job.id}`,
    );
  }
}

export function applyCourseWordJob(user: User, lessonId: string, jobId: string, input: unknown) {
  const b = z
    .object({
      revision: z.number().int(),
      words: z
        .array(
          z.object({
            ko: z.string().trim().min(1).max(100),
            uz: z.string().trim().min(1).max(250),
            example: z.string().max(1000),
            translation: z.string().max(1000),
          }),
        )
        .min(1)
        .max(40),
    })
    .parse(input);
  return transaction(() => {
    const l = ownLesson(user, lessonId);
    const job = one<{ status: string }>(
      'SELECT status FROM course_word_jobs WHERE id=? AND lesson_id=?',
      jobId,
      lessonId,
    );
    if (!job || job.status !== 'completed')
      throw new AppError(409, 'Bu natija allaqachon qo‘shilgan yoki hali tayyor emas.');
    const saved = saveLesson(user, lessonId, {
      ...l,
      revision: b.revision,
      materials: [
        ...l.materials,
        {
          id: id(),
          kind: 'vocabulary',
          title: 'Dars lug‘ati',
          body: '',
          url: '',
          fileIds: [],
          words: b.words.map((w) => ({ ...w, id: id() })),
          grammarIds: [],
          topikCategory: '',
          task: 'none',
          required: true,
          questions: [],
        },
      ],
    });
    run("UPDATE course_word_jobs SET status='applied',updated_at=? WHERE id=?", now(), jobId);
    return saved;
  });
}
