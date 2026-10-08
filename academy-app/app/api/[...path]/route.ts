import { handleCourseBot } from '@/lib/course-bot';
import { courseHttp } from '@/lib/course-http';
import { requireTopikAccess, courseAccess } from '@/lib/course-access';
import { courseAssignmentAccess, saveCourseGroup } from '@/lib/courses';
import { handleVocabularyBot } from '@/lib/vocabulary-bot';
import { vocabularyList, vocabularyCatalog, visibleVocabularyWord } from '@/lib/vocabulary-data';
import {
  scopeSchema,
  validateCategories,
  saveVocabularyAccess,
  vocabularyGrants,
} from '@/lib/vocabulary-access';
import { startVocabularyQuiz } from '@/lib/vocabulary-quiz';
import { VOCABULARY_BANDS } from '@/lib/vocabulary-types';
import {
  vocabularySectionSchema,
  editVocabulary,
  createVocabularyWord,
  queueVocabularyJob,
  vocabularyJobs,
  retryVocabularyJob,
} from '@/lib/vocabulary';
import {
  getTopikSolution,
  saveTopikSolutionNote,
  listSolutionEditor,
  solutionEditorDetail,
  editTopikSolution,
} from '@/lib/topik-solutions';
import { saveNote, organizeNote } from '@/lib/notebook';
import { solutionSchema } from '@/lib/solution-schema';
import { topikTeachingReport, createTopikAssignment, studyAssignment } from '@/lib/topik-teaching';
import { wordCloze } from '@/lib/word-context';
import { dailyPlan, dailyStep } from '@/lib/daily';
import { studySummary, rateStudyWord, saveStudyWord } from '@/lib/study';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { ensureSeed } from '@/lib/seed';
import { one, many, run, id, now, transaction } from '@/lib/db';
import {
  AppError,
  requireUser,
  requireTeacher,
  teacherGroup,
  safeUser,
  signIn,
  signOut,
  checkPassword,
  hashPassword,
  enforceOrigin,
  rateLimit,
  verifyTelegram,
  hashToken,
} from '@/lib/auth';
import {
  studentState,
  teacherState,
  startQuiz,
  answerQuiz,
  getSession,
  viewSession,
  submissionAccess,
  enqueueNotification,
  withSubmissionDetails,
} from '@/lib/learning';
import {
  limitedBody,
  validateFile,
  validateAudio,
  storeFile,
  readFile,
  removeFile,
} from '@/lib/files';
import { sendTelegram } from '@/lib/telegram';
import { aiConfig } from '@/lib/ai-config';
import { GRAMMARS } from '@/lib/content';
import { vocabulary } from '@/lib/library';
import {
  checkTopikQuestion,
  trackTopikTime,
  markTopikUncertain,
  topikCatalog,
  startTopikSession,
  getTopikSession,
  answerTopikSession,
  finishTopikSession,
  setTopikBookmark,
  topikBookmarks,
  topikVocabulary,
} from '@/lib/topik';
import type { User, Group, Assignment, Submission, Attachment } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const body = async (req: Request) => {
  try {
    return JSON.parse((await limitedBody(req, 100_000)).toString());
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, 'So‘rov ma’lumoti yaroqsiz.');
  }
};
const str = (min = 1, max = 200) => z.string().trim().min(min).max(max);
const safeTopics = (topics: string[], kind: string) =>
  topics.filter((t) => (kind === 'vocabulary' ? vocabulary() : GRAMMARS).some((g) => g.id === t));
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    ensureSeed();
    const parts = (await ctx.params).path;
    const endpoint = parts.join('/');
    const method = req.method;
    if (endpoint === 'health') return json({ ok: true, service: 'HangangAcademy' });
    if (endpoint === 'telegram/webhook') {
      if (method !== 'POST') throw new AppError(405, 'Noto‘g‘ri usul.');
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret)
        throw new AppError(403, 'Telegram tasdig‘i yo‘q.');
      const data = await body(req);
      if (await handleCourseBot(data)) return json({ ok: true });
      if (await handleVocabularyBot(data)) return json({ ok: true });
      const message = data.message;
      if (
        message?.chat?.type === 'private' &&
        typeof message.text === 'string' &&
        message.text.startsWith('/start')
      ) {
        const tid = String(message.from?.id || '');
        const link = message.text.split(' ')[1];
        if (link?.startsWith('link_')) {
          const record = one<{ user_id: string; expires_at: string }>(
            'SELECT * FROM telegram_links WHERE token_hash=?',
            hashToken(link.slice(5)),
          );
          if (record && record.expires_at > now()) {
            const used = one<User>('SELECT id FROM users WHERE telegram_id=?', tid);
            if (!used) {
              transaction(() => {
                run('UPDATE users SET telegram_id=? WHERE id=?', tid, record.user_id);
                run('DELETE FROM telegram_links WHERE token_hash=?', hashToken(link.slice(5)));
              });
              enqueueNotification(
                record.user_id,
                'linked',
                'Telegram hisobingiz HangangAcademy bilan bog‘landi. Eslatmalarni ilovadagi sozlamalardan yoqishingiz mumkin.',
                `tg-link-${data.update_id}`,
              );
            }
          }
        }
        const user = one<User>('SELECT * FROM users WHERE telegram_id=?', tid);
        if (user)
          enqueueNotification(
            user.id,
            'welcome',
            user.role === 'teacher'
              ? 'HangangAcademy’ga xush kelibsiz! So‘z yoki rasmdan lug‘at qo‘shish uchun /lugat yuboring.'
              : 'HangangAcademy’ga xush kelibsiz! Bugungi mashqingiz tayyor.',
            `tg-start-${data.update_id}`,
          );
        else if (/^\d+$/.test(tid)) {
          rateLimit(`tg-start:${tid}`, 5, 60000);
          await sendTelegram(
            tid,
            'HangangAcademy’ga xush kelibsiz! Ilovani oching va ustozingiz bergan guruh kodi bilan ro‘yxatdan o‘ting. Hisobingiz mavjud bo‘lsa, uni ilovadagi Sozlamalar orqali Telegram bilan bog‘lang.',
          );
        }
      }
      return json({ ok: true });
    }
    if (method !== 'GET') enforceOrigin(req);
    if (endpoint === 'config' && method === 'GET')
      return json({
        demo: process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production',
      });
    if (endpoint === 'login' && method === 'POST') {
      const b = z
        .object({ email: z.email().max(200), password: str(1, 200) })
        .parse(await body(req));
      rateLimit(`login:${b.email.toLowerCase()}`, 10, 15 * 60000);
      const user = one<User & { password_hash: string }>(
        'SELECT * FROM users WHERE email=?',
        b.email.toLowerCase(),
      );
      const valid = checkPassword(
        b.password,
        user?.password_hash || '$2b$12$CmTO5cRH.LHu.hFLTlHrDeUxBYh.qczhKVLi.dDrciUgXuXSkuypG',
      );
      if (!user || !valid) throw new AppError(401, 'Email yoki parol noto‘g‘ri.');
      await signIn(user.id);
      return json({ user: safeUser(user) });
    }
    if (endpoint === 'register' && method === 'POST') {
      rateLimit('register', 500, 3600000);
      const b = z
        .object({
          name: str(2, 80),
          email: z.email().max(200),
          password: str(10, 200),
          invite: str(4, 40),
        })
        .parse(await body(req));
      const group = one<Group>('SELECT * FROM groups WHERE invite_code=?', b.invite.toUpperCase());
      if (!group) throw new AppError(400, 'Guruh kodi topilmadi. Ustozingizdan kodni tekshiring.');
      if (one('SELECT id FROM users WHERE email=?', b.email.toLowerCase()))
        throw new AppError(409, 'Bu email bilan hisob mavjud. Hisobingizga kiring.');
      const uid = id();
      run(
        'INSERT INTO users(id,name,email,password_hash,role,group_id,created_at) VALUES(?,?,?,?,?,?,?)',
        uid,
        b.name,
        b.email.toLowerCase(),
        hashPassword(b.password),
        'student',
        group.id,
        now(),
      );
      await signIn(uid);
      return json({ ok: true });
    }
    if (endpoint === 'telegram/auth' && method === 'POST') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token)
        throw new AppError(503, 'Telegram orqali kirish hali ulanmagan. Email orqali kiring.');
      const b = z
        .object({ initData: str(1, 10000), invite: z.string().max(40).optional() })
        .parse(await body(req));
      const tg = verifyTelegram(b.initData, token);
      let user = one<User>('SELECT * FROM users WHERE telegram_id=?', String(tg.id));
      if (!user) {
        if (!b.invite) return json({ needsInvite: true });
        const group = one<Group>(
          'SELECT * FROM groups WHERE invite_code=?',
          b.invite.toUpperCase(),
        );
        if (!group) throw new AppError(400, 'Guruh kodi topilmadi.');
        const uid = id();
        run(
          'INSERT INTO users(id,name,email,password_hash,role,group_id,telegram_id,created_at) VALUES(?,?,?,?,?,?,?,?)',
          uid,
          `${tg.first_name} ${tg.last_name || ''}`.trim(),
          `tg-${tg.id}@telegram.local`,
          hashPassword(randomBytes(32).toString('hex')),
          'student',
          group.id,
          String(tg.id),
          now(),
        );
        user = one<User>('SELECT * FROM users WHERE id=?', uid)!;
      }
      await signIn(user.id);
      return json({ user: safeUser(user) });
    }
    const user = await requireUser();
    rateLimit(`api:${user.id}`, 180, 60000);
    if (parts[0] === 'courses') return await courseHttp(req, user, parts);
    if (
      parts[0] === 'topik' ||
      parts[0] === 'daily' ||
      (parts[0] === 'study' && parts[1] === 'daily')
    )
      requireTopikAccess(user);
    if (endpoint === 'vocabulary' && method === 'GET') {
      const q = z
        .object({
          section: vocabularySectionSchema.default('reading'),
          category: str(1, 20).default('all'),
          kind: z.enum(['word', 'idiom']).default('word'),
        })
        .parse(Object.fromEntries(req.nextUrl.searchParams));
      const scope = req.nextUrl.searchParams.has('level')
        ? scopeSchema.parse({
            level: req.nextUrl.searchParams.get('level'),
            book: req.nextUrl.searchParams.get('book'),
            section: q.section,
          })
        : undefined;
      validateCategories(
        scope || { level: 'topik34', book: null, section: q.section },
        [q.category],
        true,
      );
      return json({ items: vocabularyList(user, q.section, q.category, q.kind, scope) });
    }
    if (endpoint === 'vocabulary/catalog' && method === 'GET') return json(vocabularyCatalog(user));
    if (endpoint === 'vocabulary/quiz' && method === 'POST')
      return json(startVocabularyQuiz(user, await body(req)));
    if (endpoint === 'teacher/vocabulary/access' && method === 'GET') {
      const groupId = z.uuid().parse(req.nextUrl.searchParams.get('groupId'));
      teacherGroup(user, groupId);
      return json({ grants: vocabularyGrants(groupId) });
    }
    if (endpoint === 'teacher/vocabulary/access' && method === 'POST')
      return json(saveVocabularyAccess(user, await body(req)));
    if (endpoint === 'teacher/vocabulary/word' && method === 'POST') {
      requireTeacher(user);
      const b = z
        .object({
          id: str(1, 180).optional(),
          revision: z.number().int().nonnegative().default(0),
          input: z.unknown(),
          groupIds: z.array(z.uuid()).default([]),
          requestKey: str(1, 180).optional(),
        })
        .parse(await body(req));
      return json(
        b.id
          ? editVocabulary(user, b.id, b.input, b.revision)
          : createVocabularyWord(user, b.input, b.groupIds, b.requestKey || id()),
      );
    }
    if (endpoint === 'teacher/vocabulary/jobs' && method === 'GET')
      return json({ items: vocabularyJobs(user) });
    if (
      parts[0] === 'teacher' &&
      parts[1] === 'vocabulary' &&
      parts[2] === 'jobs' &&
      parts.length === 5 &&
      parts[4] === 'retry' &&
      method === 'POST'
    )
      return json(retryVocabularyJob(user, z.uuid().parse(parts[3])));
    if (endpoint === 'teacher/vocabulary/import' && method === 'POST') {
      requireTeacher(user);
      const raw = await limitedBody(req, 5 * 1024 * 1024 + 100000);
      const form = await new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': req.headers.get('content-type') || '' },
        body: new Uint8Array(raw),
      }).formData();
      const image = form.get('image');
      const settings = {
        section: form.get('section'),
        category: form.get('category'),
        groupIds: form.getAll('groupIds'),
        level: form.get('level') || 'topik34',
        book: form.get('book') || null,
      };
      const job = queueVocabularyJob(user, settings, {
        text: z
          .string()
          .max(10000)
          .parse(form.get('text') || ''),
        source: 'web',
        requestKey: z.uuid().parse(form.get('requestKey')),
        ...(image instanceof File && image.size > 0
          ? { image: { bytes: Buffer.from(await image.arrayBuffer()), mime: image.type } }
          : {}),
      });
      return json(job, 202);
    }
    if (endpoint === 'topik/check' && method === 'POST') {
      const b = z.object({ sessionId: str(1, 50), questionId: str(1, 180) }).parse(await body(req));
      return json(checkTopikQuestion(user, b.sessionId, b.questionId));
    }
    if (endpoint === 'topik/solution' && method === 'GET') {
      const b = z
        .object({ sessionId: str(1, 50), questionId: str(1, 180) })
        .parse(Object.fromEntries(req.nextUrl.searchParams));
      return json(getTopikSolution(user, b.sessionId, b.questionId));
    }
    if (endpoint === 'topik/solution/save' && method === 'POST') {
      const b = z.object({ sessionId: str(1, 50), questionId: str(1, 180) }).parse(await body(req));
      return json(saveTopikSolutionNote(user, b.sessionId, b.questionId));
    }
    if (endpoint === 'teacher/solutions' && method === 'GET') {
      const b = z
        .object({
          category: str(1, 20).default('all'),
          search: z.string().max(200).default(''),
          page: z.coerce.number().int().min(1).max(100).default(1),
        })
        .parse(Object.fromEntries(req.nextUrl.searchParams));
      return json(listSolutionEditor(user, b.category, b.search, b.page));
    }
    if (parts[0] === 'teacher' && parts[1] === 'solutions' && parts.length === 3) {
      if (method === 'GET') return json(solutionEditorDetail(user, parts[2]));
      if (method === 'POST') {
        const b = z
          .object({
            content: solutionSchema,
            revision: z.number().int().nonnegative(),
            sourceHash: str(64, 64),
          })
          .parse(await body(req));
        return json(editTopikSolution(user, parts[2], b.content, b.revision, b.sourceHash));
      }
    }
    if (endpoint === 'teacher/topik-report' && method === 'GET')
      return json(topikTeachingReport(user));
    if (endpoint === 'teacher/topik-assignment' && method === 'POST') {
      const b = z
        .object({
          groupId: str(1, 50),
          category: str(1, 20).optional(),
          wordIds: z.array(str(1, 180)).min(1).max(30).optional(),
          dueAt: z.iso.datetime(),
        })
        .parse(await body(req));
      return json(createTopikAssignment(user, b.groupId, b.category, b.wordIds, b.dueAt));
    }
    if (
      parts[0] === 'study' &&
      parts[1] === 'assignment' &&
      parts.length === 3 &&
      ['GET', 'POST'].includes(method)
    )
      return json(studyAssignment(user, parts[2], method === 'POST'));
    if (endpoint === 'study/daily' && method === 'POST') {
      const b = z
        .object({ minutes: z.union([z.literal(10), z.literal(20), z.literal(30)]) })
        .parse(await body(req));
      return json(dailyPlan(user, b.minutes));
    }
    if (endpoint === 'study/daily/step' && method === 'POST') {
      const b = z
        .object({ planId: str(1, 50), step: z.number().int().min(0).max(2) })
        .parse(await body(req));
      return json(dailyStep(user, b.planId, b.step));
    }
    if (endpoint === 'study/reviews' && method === 'GET') return json(studySummary(user.id));
    if (endpoint === 'study/word/save' && method === 'POST') {
      const b = z.object({ wordId: str(1, 180) }).parse(await body(req));
      return json(saveStudyWord(user, b.wordId));
    }
    if (endpoint === 'study/cloze' && method === 'POST') {
      const b = z
        .object({ wordId: str(1, 180), answer: str(1, 300), eventKey: str(1, 180) })
        .parse(await body(req));
      const word = visibleVocabularyWord(user, b.wordId);
      const cloze = word && wordCloze(word);
      if (!cloze) throw new AppError(404, 'Bu so‘z uchun gap mashqi topilmadi.');
      const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, '');
      const correct = normalize(b.answer) === normalize(cloze.answer);
      rateStudyWord(user, b.wordId, correct, `cloze:${b.eventKey}`);
      return json({ correct, answer: cloze.answer });
    }
    if (endpoint === 'study/word' && method === 'POST') {
      const b = z
        .object({ wordId: str(1, 180), remembered: z.boolean(), eventKey: str(1, 180) })
        .parse(await body(req));
      return json(rateStudyWord(user, b.wordId, b.remembered, b.eventKey));
    }
    if (endpoint === 'topik/time' && method === 'POST') {
      const b = z
        .object({
          sessionId: str(1, 50),
          questionId: str(1, 180),
          eventId: str(1, 100),
          seconds: z.number().int().min(1).max(60),
        })
        .parse(await body(req));
      return json(trackTopikTime(user, b.sessionId, b.questionId, b.eventId, b.seconds));
    }
    if (endpoint === 'topik/uncertain' && method === 'POST') {
      const b = z
        .object({ sessionId: str(1, 50), questionId: str(1, 180), value: z.boolean() })
        .parse(await body(req));
      return json(markTopikUncertain(user, b.sessionId, b.questionId, b.value));
    }
    if (endpoint === 'topik/catalog' && method === 'GET') return json(topikCatalog(user));
    if (endpoint === 'topik/start' && method === 'POST') {
      const b = z
        .object({
          mode: z.enum(['practice', 'mock', 'review']),
          category: str(1, 20).optional(),
          grammarId: z.enum(GRAMMARS.map((g) => g.id) as [string, ...string[]]).optional(),
          count: z.number().int().min(1).max(15).optional(),
          formId: str(1, 180).optional(),
          questionIds: z.array(str(1, 180)).max(50).optional(),
          dueOnly: z.boolean().optional(),
        })
        .parse(await body(req));
      return json(startTopikSession(user, b));
    }
    if (parts[0] === 'topik' && parts[1] === 'sessions' && parts.length === 3 && method === 'GET')
      return json(getTopikSession(user, parts[2]));
    if (endpoint === 'topik/answer' && method === 'POST') {
      const b = z
        .object({
          sessionId: str(1, 50),
          questionId: str(1, 180),
          choice: z.number().int().min(0).max(3),
        })
        .parse(await body(req));
      return json(answerTopikSession(user, b.sessionId, b.questionId, b.choice));
    }
    if (endpoint === 'topik/finish' && method === 'POST') {
      const b = z.object({ sessionId: str(1, 50) }).parse(await body(req));
      return json(finishTopikSession(user, b.sessionId));
    }
    if (endpoint === 'topik/bookmarks' && method === 'GET')
      return json({ items: topikBookmarks(user) });
    if (endpoint === 'topik/bookmarks' && method === 'POST') {
      const b = z.object({ questionId: str(1, 180), saved: z.boolean() }).parse(await body(req));
      return json(setTopikBookmark(user, b.questionId, b.saved));
    }
    if (endpoint === 'topik/vocabulary' && method === 'GET') {
      const query = z
        .object({
          category: str(1, 20).default('all'),
          kind: z.enum(['word', 'idiom']).default('word'),
        })
        .parse(Object.fromEntries(req.nextUrl.searchParams));
      return json({
        items: vocabularyList(user, 'reading', query.category, query.kind),
      });
    }
    if (endpoint === 'logout' && method === 'POST') {
      await signOut();
      return json({ ok: true });
    }
    if (endpoint === 'state' && method === 'GET')
      return json({
        user: safeUser(user),
        demo: process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production',
        integrations: {
          ai: aiConfig().enabled,
          telegram: !!process.env.TELEGRAM_BOT_TOKEN,
          model: aiConfig().model,
          provider: aiConfig().label,
        },
        ...(user.role === 'teacher' ? teacherState(user) : studentState(user)),
      });
    if (endpoint === 'quiz/start' && method === 'POST') {
      const b = z
        .object({
          kind: z.enum(['grammar', 'vocabulary', 'review']),
          mode: z.enum(['practice', 'test']).default('practice'),
          topicId: str(1, 30).optional(),
          assignmentId: str(1, 50).optional(),
        })
        .parse(await body(req));
      return json(startQuiz(user, b.kind, b.mode, b.topicId, b.assignmentId));
    }
    if (endpoint === 'quiz/answer' && method === 'POST') {
      const b = z
        .object({
          sessionId: str(1, 50),
          questionId: str(1, 50),
          choice: z.number().int().min(0).max(3),
        })
        .parse(await body(req));
      return json(answerQuiz(user, b.sessionId, b.questionId, b.choice));
    }
    if (parts[0] === 'quiz' && parts[1] && method === 'GET')
      return json(viewSession(getSession(parts[1], user)));
    if (endpoint === 'notes' && method === 'POST') return json(saveNote(user, await body(req)));
    if (parts[0] === 'notes' && parts[1] && method === 'PATCH') {
      const b = z
        .object({
          pinned: z.boolean().optional(),
          archived: z.boolean().optional(),
          folder: z.string().trim().max(50).optional(),
        })
        .parse(await body(req));
      return json(organizeNote(user, parts[1], b));
    }
    if (parts[0] === 'notes' && parts[1] && method === 'DELETE') {
      run('DELETE FROM notes WHERE id=? AND user_id=?', parts[1], user.id);
      return json({ ok: true });
    }
    if (endpoint === 'settings' && method === 'POST') {
      const b = z
        .object({
          name: str(2, 80),
          timezone: str(1, 80),
          reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          reminder_enabled: z.boolean(),
        })
        .parse(await body(req));
      try {
        new Intl.DateTimeFormat('en', { timeZone: b.timezone }).format();
      } catch {
        throw new AppError(400, 'Vaqt mintaqasini tanlang.');
      }
      if (b.reminder_enabled && !user.telegram_id)
        throw new AppError(400, 'Avval Telegram hisobingizni ulang.');
      run(
        'UPDATE users SET name=?,timezone=?,reminder_time=?,reminder_enabled=? WHERE id=?',
        b.name,
        b.timezone,
        b.reminder_time,
        b.reminder_enabled ? 1 : 0,
        user.id,
      );
      return json({ ok: true });
    }
    if (endpoint === 'telegram/link' && method === 'POST') {
      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_BOT_USERNAME)
        throw new AppError(503, 'Telegram bot hali sozlanmagan.');
      const token = randomBytes(24).toString('hex');
      run('DELETE FROM telegram_links WHERE user_id=? OR expires_at<?', user.id, now());
      run(
        'INSERT INTO telegram_links(token_hash,user_id,expires_at) VALUES(?,?,?)',
        hashToken(token),
        user.id,
        new Date(Date.now() + 10 * 60000).toISOString(),
      );
      return json({ url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=link_${token}` });
    }
    if (endpoint === 'submissions' && method === 'POST') {
      if (user.role !== 'student')
        throw new AppError(403, 'Yozma ish o‘quvchi hisobidan yuboriladi.');
      const buf = await limitedBody(req, 24 * 1024 * 1024);
      const form = await new Response(buf, {
        headers: { 'content-type': req.headers.get('content-type') || '' },
      }).formData();
      const aid = z.string().uuid().parse(form.get('assignmentId'));
      const text = z
        .string()
        .trim()
        .max(16000)
        .parse(form.get('body') || '');
      const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length > 3)
        throw new AppError(400, 'Bir topshiriqqa ko‘pi bilan 3 ta fayl qo‘shing.');
      if (!text && files.length === 0) throw new AppError(400, 'Matn yozing yoki fayl qo‘shing.');
      const assignment = one<Assignment>(
        'SELECT * FROM assignments WHERE id=? AND group_id=? AND kind=?',
        aid,
        user.group_id || '',
        'writing',
      );
      if (!assignment) throw new AppError(404, 'Topshiriq topilmadi.');
      const lessonMaterial = courseAssignmentAccess(user, aid);
      if (
        lessonMaterial?.task === 'audio' &&
        !files.some((f) => f.type.startsWith('audio/') || f.type === 'application/ogg')
      )
        throw new AppError(400, 'Ovozli javob faylini qo‘shing.');
      if (lessonMaterial?.task === 'upload' && !files.length)
        throw new AppError(400, 'Rasm yoki PDF qo‘shing.');
      if (lessonMaterial?.task === 'text' && !text)
        throw new AppError(400, 'Javob matnini yozing.');
      const previous = one<Submission>(
        'SELECT * FROM submissions WHERE assignment_id=? AND user_id=?',
        aid,
        user.id,
      );
      if (previous && previous.review_outcome !== 'fail')
        throw new AppError(
          409,
          'Bu topshiriq yuborilgan. Natijani yozma ishlar bo‘limidan ko‘ring.',
        );
      const prepared: { name: string; mime: string; size: number; bytes: Buffer }[] = [];
      for (const file of files) {
        const bytes = Buffer.from(await file.arrayBuffer());
        if (lessonMaterial?.task === 'audio') validateAudio(bytes, file.type);
        else validateFile(bytes, file.type);
        prepared.push({ name: file.name.slice(0, 200), mime: file.type, size: file.size, bytes });
      }
      const saved: string[] = [];
      const sid = previous?.id || id();
      const oldFiles = previous
        ? many<{ disk_name: string }>(
            'SELECT disk_name FROM attachments WHERE submission_id=?',
            sid,
          )
        : [];
      try {
        transaction(() => {
          if (previous) {
            run('DELETE FROM ai_jobs WHERE submission_id=?', sid);
            run('DELETE FROM attachments WHERE submission_id=?', sid);
            run(
              "UPDATE submissions SET body=?,status='submitted',review_outcome=NULL,feedback=NULL,score=NULL,published_at=NULL,attempt=attempt+1,updated_at=? WHERE id=?",
              text,
              now(),
              sid,
            );
          } else
            run(
              'INSERT INTO submissions(id,assignment_id,user_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)',
              sid,
              aid,
              user.id,
              text,
              now(),
              now(),
            );
          for (const f of prepared) {
            const disk = storeFile(f.bytes);
            saved.push(disk);
            run(
              'INSERT INTO attachments(id,submission_id,name,mime,size,disk_name) VALUES(?,?,?,?,?,?)',
              id(),
              sid,
              f.name,
              f.mime,
              f.size,
              disk,
            );
          }
          enqueueNotification(
            assignment.created_by,
            'submission',
            `${user.name} “${assignment.title}” vazifasini ${previous ? 'qayta ' : ''}topshirdi. Tekshirish bo‘limida ko‘ring.`,
            `submission-${sid}-${(previous?.attempt || 0) + 1}`,
          );
        });
        oldFiles.forEach((file) => removeFile(file.disk_name));
      } catch (e) {
        saved.forEach(removeFile);
        throw e;
      }
      return json({ id: sid });
    }
    if (parts[0] === 'files' && parts[1] && method === 'GET') {
      const f = one<Attachment & { submission_id: string; disk_name: string }>(
        'SELECT * FROM attachments WHERE id=?',
        parts[1],
      );
      if (!f) throw new AppError(404, 'Fayl topilmadi.');
      submissionAccess(user, f.submission_id);
      const bytes = readFile(f.disk_name);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': f.mime,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
        },
      });
    }
    if (parts[0] === 'submissions' && parts[1] && method === 'GET') {
      const s = submissionAccess(user, parts[1]);
      return json(withSubmissionDetails(s, user.role === 'teacher'));
    }
    if (endpoint === 'teacher/groups' && method === 'POST') {
      requireTeacher(user);
      const groupInput = await body(req);
      if (['hangul', 'topik34', 'topik56'].includes(groupInput.level))
        return json(saveCourseGroup(user, groupInput));
      const b = z
        .object({
          id: str(1, 50).optional(),
          name: str(2, 80),
          level: str(1, 50),
          grammarIds: z.array(str(1, 30)).max(200),
          vocabularyIds: z.array(str(1, 30)).max(1000),
        })
        .parse(groupInput);
      const gids = JSON.stringify(safeTopics(b.grammarIds, 'grammar'));
      const vids = JSON.stringify(safeTopics(b.vocabularyIds, 'vocabulary'));
      if (b.id) {
        teacherGroup(user, b.id);
        run(
          'UPDATE groups SET name=?,level=?,grammar_ids=?,vocabulary_ids=? WHERE id=?',
          b.name,
          b.level,
          gids,
          vids,
          b.id,
        );
      } else
        run(
          'INSERT INTO groups(id,name,level,invite_code,teacher_id,grammar_ids,vocabulary_ids,created_at) VALUES(?,?,?,?,?,?,?,?)',
          id(),
          b.name,
          b.level,
          randomBytes(5).toString('hex').toUpperCase(),
          user.id,
          gids,
          vids,
          now(),
        );
      return json({ ok: true });
    }
    if (endpoint === 'teacher/assignments' && method === 'POST') {
      requireTeacher(user);
      const b = z
        .object({
          groupId: str(1, 50),
          title: str(2, 140),
          kind: z.enum(['grammar', 'vocabulary', 'writing']),
          skill: z.enum(['listening', 'reading', 'writing', 'speaking']).optional(),
          prompt: str(5, 5000),
          topicIds: z.array(str(1, 30)).max(100).default([]),
          dueAt: z.iso.datetime(),
        })
        .parse(await body(req));
      teacherGroup(user, b.groupId);
      if (b.kind !== 'writing') {
        const g = one<Group>('SELECT * FROM groups WHERE id=?', b.groupId)!;
        const allowed: string[] = JSON.parse(
          b.kind === 'grammar' ? g.grammar_ids : g.vocabulary_ids,
        );
        if (b.topicIds.some((t) => !allowed.includes(t)))
          throw new AppError(400, 'Vazifa mavzularini avval guruh uchun oching.');
        const selected = b.topicIds.length ? b.topicIds : allowed;
        const available = many<{ topic_id: string }>(
          'SELECT DISTINCT topic_id FROM questions WHERE kind=?',
          b.kind,
        );
        if (!available.some((q) => selected.includes(q.topic_id)))
          throw new AppError(400, 'Tanlangan mavzularga avval quiz savollari qo‘shing.');
      }
      if (new Date(b.dueAt).getTime() < Date.now())
        throw new AppError(400, 'Kelajakdagi muddatni tanlang.');
      run(
        'INSERT INTO assignments(id,group_id,title,kind,skill,prompt,topic_ids,due_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        id(),
        b.groupId,
        b.title,
        b.kind,
        b.skill || (b.kind === 'writing' ? 'writing' : 'reading'),
        b.prompt,
        JSON.stringify(b.topicIds),
        b.dueAt,
        user.id,
        now(),
      );
      return json({ ok: true });
    }
    if (endpoint === 'teacher/words' && method === 'POST') {
      requireTeacher(user);
      const b = z
        .object({
          ko: str(1, 100),
          uz: str(1, 250),
          category: str(1, 80),
          example: str(2, 1000),
          translation: str(2, 1000),
        })
        .parse(await body(req));
      if (vocabulary().some((w) => w.ko === b.ko))
        throw new AppError(409, 'Bu so‘z lug‘atda mavjud. Unga quiz savoli qo‘shishingiz mumkin.');
      const wid = 'V' + randomBytes(10).toString('hex');
      run(
        'INSERT INTO custom_words(id,ko,uz,category,example,translation,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
        wid,
        b.ko,
        b.uz,
        b.category,
        b.example,
        b.translation,
        user.id,
        now(),
      );
      return json({ id: wid });
    }
    if (endpoint === 'teacher/questions' && method === 'POST') {
      requireTeacher(user);
      const b = z
        .object({
          kind: z.enum(['grammar', 'vocabulary']),
          topicId: str(1, 30),
          prompt: str(5, 2000),
          options: z.array(str(1, 300)).length(4),
          answer: z.number().int().min(0).max(3),
          explanation: str(10, 2000),
          translation: z.string().max(2000).default(''),
        })
        .parse(await body(req));
      if (!safeTopics([b.topicId], b.kind).length) throw new AppError(400, 'Mavzuni tanlang.');
      if (new Set(b.options).size !== 4)
        throw new AppError(400, 'Javob variantlari bir-biridan farq qilishi kerak.');
      run(
        'INSERT INTO questions(id,kind,topic_id,prompt,options,answer,explanation,translation,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
        id(),
        b.kind,
        b.topicId,
        b.prompt,
        JSON.stringify(b.options),
        b.answer,
        b.explanation,
        b.translation,
        user.id,
      );
      return json({ ok: true });
    }
    if (endpoint === 'teacher/feedback' && method === 'POST') {
      requireTeacher(user);
      const b = z
        .object({
          submissionId: str(1, 50),
          feedback: str(10, 12000),
          score: z.number().int().min(0).max(100),
          outcome: z.enum(['success', 'fail']),
        })
        .parse(await body(req));
      const s = submissionAccess(user, b.submissionId);
      teacherGroup(user, s.group_id);
      run(
        'UPDATE submissions SET feedback=?,score=?,status=?,review_outcome=?,published_at=?,updated_at=? WHERE id=?',
        b.feedback,
        b.score,
        'reviewed',
        b.outcome,
        now(),
        now(),
        s.id,
      );
      enqueueNotification(
        s.user_id,
        'feedback',
        `“${s.assignment_title}” vazifangiz ${b.outcome === 'success' ? 'Success' : 'Fail — qayta topshiring'} deb baholandi. Ustoz izohini ilovada o‘qing.`,
        `feedback-${s.id}-${now()}`,
      );
      return json({ ok: true });
    }
    if (endpoint === 'teacher/ai-review' && method === 'POST') {
      requireTeacher(user);
      rateLimit(`ai:${user.id}`, 20, 3600000);
      const b = z.object({ submissionId: str(1, 50) }).parse(await body(req));
      const s = submissionAccess(user, b.submissionId);
      teacherGroup(user, s.group_id);
      if (
        many<{ mime: string }>('SELECT mime FROM attachments WHERE submission_id=?', s.id).some(
          (f) => f.mime.startsWith('audio/') || f.mime === 'application/ogg',
        )
      )
        throw new AppError(
          400,
          'Ovozli javobni ustoz tinglab baholaydi. AI tekshiruvi matn va rasmlar uchun.',
        );
      const ai = aiConfig();
      if (!ai.enabled)
        throw new AppError(
          503,
          'AI ustoz hali ulanmagan. AI xizmatining API kaliti kiritilgach tekshirish ishga tushadi.',
        );
      if (
        one(
          'SELECT id FROM ai_jobs WHERE submission_id=? AND status IN (?,?)',
          s.id,
          'queued',
          'running',
        )
      )
        throw new AppError(409, 'Bu ish allaqachon AI tekshiruviga yuborilgan.');
      const jid = id();
      run(
        'INSERT INTO ai_jobs(id,submission_id,requested_by,model,provider,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
        jid,
        s.id,
        user.id,
        ai.model,
        ai.provider,
        now(),
        now(),
      );
      return json({ id: jid, status: 'queued' });
    }
    throw new AppError(404, 'Sahifa topilmadi.');
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        { error: 'Maydonlarni tekshiring: bo‘sh, juda uzun yoki noto‘g‘ri qiymat bor.' },
        400,
      );
    console.error('API request failed:', e instanceof Error ? e.message : 'Unknown error');
    return json({ error: 'So‘rovni bajarib bo‘lmadi. Qayta urinib ko‘ring.' }, 500);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
