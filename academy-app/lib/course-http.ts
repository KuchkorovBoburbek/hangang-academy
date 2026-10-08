import { courseWordJobs, applyCourseWordJob } from './course-bot';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, rateLimit, requireTeacher } from './auth';
import {
  courseCatalog,
  createLesson,
  saveLesson,
  ownLesson,
  openLesson,
  studentCourses,
  lessonView,
  completeLessonTask,
  releaseAccess,
  courseBoard,
  setCoursePoints,
  awardCourseGift,
  liveQuiz,
  saveCourseGroup,
} from './courses';
import { one, many, id, now, run } from './db';
import {
  limitedBody,
  readFile,
  storeFile,
  removeFile,
  validateLessonFile,
  validateFile,
} from './files';
import { allVocabulary } from './vocabulary-data';
import { GRAMMARS } from './content';
import { aiConfig } from './ai-config';
import { extractVocabulary } from './vocabulary-ai';
import type { VocabularyJob } from './vocabulary';
import type { User } from './types';
import type { LessonBody } from './course-types';
const json = (data: unknown) =>
  NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
const body = async (req: Request) => {
  try {
    return JSON.parse((await limitedBody(req, 1000000)).toString());
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, 'So‘rov yaroqsiz.');
  }
};
export async function courseHttp(req: NextRequest, user: User, parts: string[]) {
  const p = parts.slice(1),
    method = req.method;
  if (p[0] === 'catalog' && method === 'GET') return json(courseCatalog(user));
  if (p[0] === 'mine' && method === 'GET') return json(studentCourses(user));
  if (p[0] === 'groups' && method === 'POST') return json(saveCourseGroup(user, await body(req)));
  if (p[0] === 'bank' && method === 'GET') {
    requireTeacher(user);
    return json({
      words: allVocabulary(user).filter((w) => !w.groupIds.length),
      grammars: GRAMMARS,
      questions: many<{
        id: string;
        topic_id: string;
        prompt: string;
        options: string;
        answer: number;
        explanation: string;
      }>(
        "SELECT id,topic_id,prompt,options,answer,explanation FROM questions WHERE kind='grammar'",
      ).map((q) => ({ ...q, options: JSON.parse(q.options) })),
      categories: many<{ category: string }>(
        'SELECT DISTINCT category FROM topik_groups WHERE current=1',
      ).map((c) => c.category),
    });
  }
  if (p[0] === 'lessons' && method === 'POST' && !p[1]) {
    const b = z.object({ courseId: z.string().uuid() }).parse(await body(req));
    return json(createLesson(user, b.courseId));
  }
  if (p[0] === 'lessons' && p[1]) {
    const lesson = ownLesson(user, p[1]);
    if (p.length === 2 && method === 'GET')
      return json({
        ...lesson,
        files: many('SELECT id,name,mime,size FROM course_files WHERE lesson_id=?', lesson.id),
      });
    if (p.length === 2 && method === 'POST')
      return json(saveLesson(user, lesson.id, await body(req)));
    if (p[2] === 'word-jobs' && p[3] && p[4] === 'apply' && method === 'POST')
      return json(applyCourseWordJob(user, lesson.id, p[3], await body(req)));
    if (p[2] === 'word-jobs' && method === 'GET')
      return json({ jobs: courseWordJobs(user, lesson.id) });
    if (p[2] === 'open' && method === 'POST')
      return json(openLesson(user, lesson.id, await body(req)));
    if (p[2] === 'files' && method === 'POST') {
      const form = await new Response(await limitedBody(req, 21 * 1024 * 1024), {
        headers: { 'content-type': req.headers.get('content-type') || '' },
      }).formData();
      const f = form.get('file');
      if (!(f instanceof File)) throw new AppError(400, 'Fayl tanlang.');
      if (
        (one<{ n: number }>('SELECT COUNT(*) n FROM course_files WHERE lesson_id=?', lesson.id)
          ?.n || 0) >= 60
      )
        throw new AppError(400, 'Bir darsda ko‘pi bilan 60 ta fayl.');
      const bytes = Buffer.from(await f.arrayBuffer());
      validateLessonFile(bytes, f.type);
      const fid = id(),
        disk = storeFile(bytes);
      try {
        run(
          'INSERT INTO course_files(id,lesson_id,name,mime,size,disk_name,created_at) VALUES(?,?,?,?,?,?,?)',
          fid,
          lesson.id,
          f.name.slice(0, 180),
          f.type,
          bytes.length,
          disk,
          now(),
        );
      } catch (e) {
        removeFile(disk);
        throw e;
      }
      return json({ id: fid, name: f.name.slice(0, 180), mime: f.type, size: bytes.length });
    }
    if (p[2] === 'ai-words' && method === 'POST') {
      rateLimit(`course-ai:${user.id}`, 20, 3600000);
      const config = aiConfig();
      if (!config.enabled)
        throw new AppError(503, 'AI hali ulanmagan. So‘zlarni qo‘lda kiritishingiz mumkin.');
      const form = await new Response(await limitedBody(req, 6 * 1024 * 1024), {
        headers: { 'content-type': req.headers.get('content-type') || '' },
      }).formData();
      const text = z
        .string()
        .trim()
        .max(12000)
        .parse(form.get('text') || '');
      const image = form.get('image');
      let bytes: Buffer | undefined;
      if (image instanceof File && image.size) {
        bytes = Buffer.from(await image.arrayBuffer());
        validateFile(bytes, image.type);
        if (!image.type.startsWith('image/')) throw new AppError(400, 'Rasm yuboring.');
      }
      if (!text && !bytes) throw new AppError(400, 'So‘z yozing yoki rasm qo‘shing.');
      // Reuse the existing structured extractor, but never publish a draft or notify students here.
      const job = {
        provider: config.provider,
        model: config.model,
        section: 'reading',
        category: 'general',
        input_text: text,
        image_data: bytes?.toString('base64') || null,
        image_mime: image instanceof File ? image.type : null,
        telegram_file_id: null,
      } as VocabularyJob;
      try {
        return json(await extractVocabulary(job));
      } catch {
        throw new AppError(
          502,
          'AI natijasi olinmadi. Saqlash amalga oshmadi; qayta urinib ko‘ring.',
        );
      }
    }
  }
  if (p[0] === 'files' && p[1] && method === 'GET') {
    const f = one<{ id: string; lesson_id: string; name: string; mime: string; disk_name: string }>(
      'SELECT * FROM course_files WHERE id=?',
      p[1],
    );
    if (!f) throw new AppError(404, 'Fayl topilmadi.');
    if (user.role === 'teacher') ownLesson(user, f.lesson_id);
    else {
      const r = one<{ id: string; snapshot: string }>(
        'SELECT id,snapshot FROM course_releases WHERE lesson_id=? AND group_id=?',
        f.lesson_id,
        user.group_id || '',
      );
      const material = r
        ? (JSON.parse(r.snapshot) as LessonBody).materials.find((m) => m.fileIds.includes(f.id))
        : undefined;
      if (
        !r ||
        !material ||
        !one(
          'SELECT item_id FROM course_release_items WHERE release_id=? AND item_id=? AND available_at<=?',
          r.id,
          material.id,
          now(),
        )
      )
        throw new AppError(404, 'Fayl ochilmagan.');
    }
    return new NextResponse(new Uint8Array(readFile(f.disk_name)), {
      headers: {
        'Content-Type': f.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      },
    });
  }
  if (p[0] === 'releases' && p[1]) {
    releaseAccess(user, p[1]);
    if (p.length === 2 && method === 'GET') return json(lessonView(user, p[1]));
    if (p[2] === 'complete' && method === 'POST')
      return json(completeLessonTask(user, p[1], await body(req)));
    if (p[2] === 'points' && method === 'POST')
      return json(setCoursePoints(user, p[1], await body(req)));
    if (p[2] === 'live' && method === 'GET') return json(liveQuiz(user, p[1], 'view'));
    if (p[2] === 'live' && method === 'POST') {
      const b = z
        .object({
          action: z.enum(['open', 'close', 'start', 'submit']),
          answers: z.array(z.number()).optional(),
        })
        .parse(await body(req));
      return json(liveQuiz(user, p[1], b.action, b));
    }
  }
  if (p[0] === 'board' && p[1] && method === 'GET') return json(courseBoard(user, p[1]));
  if (p[0] === 'board' && p[1] && p[2] === 'gift' && method === 'POST')
    return json(awardCourseGift(user, p[1], await body(req)));
  throw new AppError(404, 'Dars sahifasi topilmadi.');
}
