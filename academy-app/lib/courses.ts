import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { AppError, requireTeacher, teacherGroup } from './auth';
import { id, many, one, now, run, transaction } from './db';
import {
  COURSE_LEVELS,
  type CourseLevel,
  type CourseLesson,
  type LessonBody,
  type LessonRelease,
  type LessonMaterial,
  type TaskStatus,
  type CourseStudentState,
} from './course-types';
import type { User, Group, Submission } from './types';
import { GRAMMARS } from './content';
import { allVocabulary } from './vocabulary-data';
import { courseAccess } from './course-access';
import { youtubeVideoId } from './youtube';
const text = (max = 1000) => z.string().trim().max(max);
const question = z
  .object({
    id: z.string().uuid(),
    prompt: text(2000).min(1),
    options: z.array(text(400).min(1)).min(2).max(4),
    answer: z.number().int().min(0).max(3),
    explanation: text(2000).default(''),
  })
  .refine(
    (q) => q.answer < q.options.length && new Set(q.options).size === q.options.length,
    'Javob variantlari takrorlanmasin.',
  );
const material = z
  .object({
    id: z.string().uuid(),
    kind: z.enum([
      'vocabulary',
      'grammar',
      'reading',
      'listening',
      'writing',
      'speaking',
      'resource',
    ]),
    title: text(160).min(1),
    body: text(16000).default(''),
    url: text(2000)
      .default('')
      .refine((s) => !s || (/^https?:\/\//i.test(s) && !/[\s<>]/.test(s))),
    fileIds: z.array(z.string().uuid()).max(10).default([]),
    words: z
      .array(
        z.object({
          id: text(180).min(1),
          ko: text(100).min(1),
          uz: text(250).min(1),
          example: text(1000).default(''),
          translation: text(1000).default(''),
        }),
      )
      .max(100)
      .default([]),
    grammarIds: z.array(text(30)).max(30).default([]),
    topikCategory: text(20).default(''),
    task: z.enum(['none', 'self', 'quiz', 'text', 'upload', 'audio']).default('none'),
    required: z.boolean().default(true),
    questions: z.array(question).max(30).default([]),
  })
  .refine((m) => m.task !== 'quiz' || m.questions.length > 0, 'Quiz savollarini qo‘shing.');
export const lessonSchema = z.object({
  title: text(160).min(2),
  description: text(2000).default(''),
  youtubeUrl: text(2000)
    .default('')
    .refine((value) => !value || youtubeVideoId(value) !== null, {
      message: 'Faqat haqiqiy YouTube video havolasini kiriting.',
    }),
  materials: z.array(material).max(30),
  warmup: z.array(question).max(30).default([]),
});
function ownCourse(user: User, courseId: string) {
  requireTeacher(user);
  const course = one<{ id: string; teacher_id: string; level: CourseLevel; title: string }>(
    'SELECT * FROM courses WHERE id=? AND teacher_id=?',
    courseId,
    user.id,
  );
  if (!course) throw new AppError(404, 'Dastur topilmadi.');
  return course;
}
export function ownLesson(user: User, lessonId: string): CourseLesson {
  requireTeacher(user);
  const row = one<{
    id: string;
    course_id: string;
    position: number;
    revision: number;
    body: string;
    updated_at: string;
  }>(
    'SELECT l.* FROM course_lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=? AND c.teacher_id=?',
    lessonId,
    user.id,
  );
  if (!row) throw new AppError(404, 'Dars topilmadi.');
  return { ...row, ...lessonSchema.parse(JSON.parse(row.body)) };
}
export function ensureCourses(user: User) {
  requireTeacher(user);
  for (const level of COURSE_LEVELS)
    run(
      'INSERT OR IGNORE INTO courses(id,teacher_id,level,title,created_at) VALUES(?,?,?,?,?)',
      id(),
      user.id,
      level.id,
      level.label,
      now(),
    );
}
export function courseCatalog(user: User) {
  ensureCourses(user);
  return {
    courses: many<{ id: string; level: CourseLevel; title: string }>(
      "SELECT id,level,title FROM courses WHERE teacher_id=? ORDER BY CASE level WHEN 'hangul' THEN 0 WHEN 'topik34' THEN 1 ELSE 2 END",
      user.id,
    ).map((c) => ({
      ...c,
      lessons: many<{ id: string }>(
        'SELECT id FROM course_lessons WHERE course_id=? ORDER BY position,updated_at',
        c.id,
      ).map((l) => ownLesson(user, l.id)),
    })),
    groups: many<Group>('SELECT * FROM groups WHERE teacher_id=? ORDER BY created_at', user.id),
    releases: many<{ id: string; group_id: string; lesson_id: string; lesson_date: string }>(
      'SELECT r.id,r.group_id,r.lesson_id,r.lesson_date FROM course_releases r JOIN groups g ON g.id=r.group_id WHERE g.teacher_id=?',
      user.id,
    ),
  };
}
export function saveCourseGroup(user: User, input: unknown) {
  requireTeacher(user);
  const b = z
    .object({
      id: z.string().uuid().optional(),
      name: text(80).min(2),
      level: z.enum(['hangul', 'topik34', 'topik56']),
    })
    .parse(input);
  ensureCourses(user);
  const c = one<{ id: string }>(
    'SELECT id FROM courses WHERE teacher_id=? AND level=?',
    user.id,
    b.level,
  )!;
  const gid = b.id || id();
  if (b.id) {
    teacherGroup(user, b.id);
    const existing = one<Group>('SELECT * FROM groups WHERE id=?', b.id)!;
    if (
      existing.course_id &&
      existing.course_id !== c.id &&
      one('SELECT id FROM course_releases WHERE group_id=?', gid)
    )
      throw new AppError(
        409,
        'Darslari ochilgan guruhning darajasini almashtirib bo‘lmaydi. Yangi guruh oching.',
      );
    run(
      'UPDATE groups SET name=?,level=?,course_id=? WHERE id=?',
      b.name,
      COURSE_LEVELS.find((l) => l.id === b.level)!.label,
      c.id,
      gid,
    );
  } else
    run(
      'INSERT INTO groups(id,name,level,invite_code,teacher_id,course_id,created_at) VALUES(?,?,?,?,?,?,?)',
      gid,
      b.name,
      COURSE_LEVELS.find((l) => l.id === b.level)!.label,
      randomBytes(5).toString('hex').toUpperCase(),
      user.id,
      c.id,
      now(),
    );
  return { id: gid };
}
export function createLesson(user: User, courseId: string) {
  ownCourse(user, courseId);
  return transaction(() => {
    const position =
      (one<{ n: number }>('SELECT MAX(position) n FROM course_lessons WHERE course_id=?', courseId)
        ?.n || 0) + 1;
    const lid = id();
    run(
      'INSERT INTO course_lessons(id,course_id,position,body,updated_at) VALUES(?,?,?,?,?)',
      lid,
      courseId,
      position,
      JSON.stringify({
        title: `${position}-dars`,
        description: '',
        youtubeUrl: '',
        materials: [],
        warmup: [],
      }),
      now(),
    );
    return ownLesson(user, lid);
  });
}
export function saveLesson(user: User, lessonId: string, input: unknown) {
  const { revision, position, ...body } = z
    .object({
      revision: z.number().int().nonnegative(),
      position: z.number().int().min(1).max(1000),
      ...lessonSchema.shape,
    })
    .parse(input);
  const previous = ownLesson(user, lessonId);
  if (previous.revision !== revision)
    throw new AppError(409, 'Dars boshqa oynada o‘zgargan. Sahifani yangilang.');
  if (new Set(body.materials.map((m) => m.id)).size !== body.materials.length)
    throw new AppError(400, 'Materiallar takrorlangan.');
  const course = ownCourse(user, previous.course_id);
  const words = new Map(allVocabulary(user).map((w) => [w.id, w]));
  const categories = new Set(
    many<{ category: string }>('SELECT DISTINCT category FROM topik_groups WHERE current=1').map(
      (r) => r.category,
    ),
  );
  for (const m of body.materials) {
    if (
      new Set(m.words.map((w) => w.id)).size !== m.words.length ||
      new Set(m.questions.map((q) => q.id)).size !== m.questions.length
    )
      throw new AppError(400, 'So‘z yoki savol identifikatori takrorlangan.');
    if (m.grammarIds.some((g) => !GRAMMARS.some((v) => v.id === g)))
      throw new AppError(400, 'Grammatika topilmadi.');
    if (m.topikCategory && (course.level === 'hangul' || !categories.has(m.topikCategory)))
      throw new AppError(400, 'TOPIK mashqi darajaga mos emas.');
    if (
      m.fileIds.some(
        (f) => !one('SELECT id FROM course_files WHERE id=? AND lesson_id=?', f, lessonId),
      )
    )
      throw new AppError(400, 'Fayl shu darsga tegishli emas.');
    // Existing words must be shared with every group of this program. Lesson-local words never enter the global bank.
    m.words.forEach((w) => {
      const source = words.get(w.id);
      if (source?.groupIds.length)
        throw new AppError(400, 'Guruhga cheklangan so‘zni darsga yangi so‘z sifatida kiriting.');
      if (!source && !/^[a-f0-9-]{36}$/.test(w.id))
        throw new AppError(400, 'Lug‘at identifikatori yaroqsiz.');
    });
  }
  const changed = run(
    'UPDATE course_lessons SET body=?,position=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
    JSON.stringify(body),
    position,
    now(),
    lessonId,
    revision,
  );
  if (!changed.changes) throw new AppError(409, 'Dars o‘zgargan. Yangilang.');
  return ownLesson(user, lessonId);
}
export function openLesson(user: User, lessonId: string, input: unknown) {
  const b = z
    .object({ groupId: z.string().uuid(), date: z.iso.date(), dueAt: z.iso.datetime() })
    .parse(input);
  teacherGroup(user, b.groupId);
  const lesson = ownLesson(user, lessonId);
  const group = one<Group>('SELECT * FROM groups WHERE id=?', b.groupId)!;
  if (group.course_id !== lesson.course_id)
    throw new AppError(400, 'Guruh va dars bir dasturga tegishli bo‘lishi kerak.');
  if (!lesson.materials.length && !lesson.youtubeUrl)
    throw new AppError(400, 'Avval darsga material yoki YouTube video qo‘shing.');
  return transaction(() => {
    const existing = one<{ id: string }>(
      'SELECT id FROM course_releases WHERE group_id=? AND lesson_id=?',
      group.id,
      lessonId,
    );
    if (existing) return existing;
    const rid = id();
    const snapshot: LessonBody = {
      title: lesson.title,
      description: lesson.description,
      youtubeUrl: lesson.youtubeUrl,
      materials: lesson.materials,
      warmup: lesson.warmup,
    };
    run(
      'INSERT INTO course_releases(id,group_id,lesson_id,lesson_date,due_at,snapshot,opened_at) VALUES(?,?,?,?,?,?,?)',
      rid,
      group.id,
      lessonId,
      b.date,
      b.dueAt,
      JSON.stringify(snapshot),
      now(),
    );
    for (const m of lesson.materials.filter((m) => ['text', 'upload', 'audio'].includes(m.task))) {
      const aid = id();
      run(
        'INSERT INTO assignments(id,group_id,title,kind,prompt,topic_ids,due_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
        aid,
        group.id,
        `${lesson.title} · ${m.title}`,
        'writing',
        m.body || m.title,
        '[]',
        b.dueAt,
        user.id,
        now(),
      );
      run(
        'INSERT INTO course_assignments(release_id,material_id,assignment_id) VALUES(?,?,?)',
        rid,
        m.id,
        aid,
      );
    }
    return { id: rid };
  });
}
export function releaseAccess(user: User, releaseId: string): LessonRelease {
  const r = one<Omit<LessonRelease, 'snapshot'> & { snapshot: string; teacher_id: string }>(
    'SELECT r.*,g.teacher_id,l.position FROM course_releases r JOIN groups g ON g.id=r.group_id JOIN course_lessons l ON l.id=r.lesson_id WHERE r.id=?',
    releaseId,
  );
  if (!r || (user.role === 'teacher' ? r.teacher_id !== user.id : r.group_id !== user.group_id))
    throw new AppError(404, 'Dars topilmadi yoki hali ochilmagan.');
  const snapshot = lessonSchema.parse(JSON.parse(r.snapshot));
  return {
    id: r.id,
    group_id: r.group_id,
    lesson_id: r.lesson_id,
    lesson_date: r.lesson_date,
    due_at: r.due_at,
    opened_at: r.opened_at,
    position: r.position,
    title: snapshot.title,
    snapshot,
  };
}
export function releaseTasks(user: User, r: LessonRelease): TaskStatus[] {
  return r.snapshot.materials
    .filter((m) => m.task !== 'none')
    .map((m) => {
      const link = one<{ assignment_id: string }>(
        'SELECT assignment_id FROM course_assignments WHERE release_id=? AND material_id=?',
        r.id,
        m.id,
      );
      if (link) {
        const s = one<Submission>(
          'SELECT * FROM submissions WHERE assignment_id=? AND user_id=?',
          link.assignment_id,
          user.id,
        );
        return {
          materialId: m.id,
          title: m.title,
          kind: m.kind,
          required: m.required,
          assignmentId: link.assignment_id,
          status: s?.published_at ? 'done' : s ? 'submitted' : 'todo',
          feedback: s?.published_at ? s.feedback : null,
        };
      }
      const t = one<{ score: number; total: number }>(
        'SELECT * FROM course_tasks WHERE release_id=? AND material_id=? AND user_id=?',
        r.id,
        m.id,
        user.id,
      );
      return {
        materialId: m.id,
        title: m.title,
        kind: m.kind,
        required: m.required,
        status: t ? 'done' : 'todo',
        score: t?.score,
        total: t?.total,
      };
    });
}
export function studentCourses(user: User): CourseStudentState {
  const access = courseAccess(user);
  const group = one<Group>('SELECT * FROM groups WHERE id=?', user.group_id || '');
  const releases = many<{ id: string }>(
    'SELECT id FROM course_releases WHERE group_id=? ORDER BY lesson_date DESC,opened_at DESC',
    user.group_id || '',
  ).map((row) => {
    const r = releaseAccess(user, row.id);
    const { snapshot, ...summary } = r;
    return {
      ...summary,
      tasks: releaseTasks(user, r),
      materials: snapshot.materials.map(({ id, kind, title }) => ({ id, kind, title })),
      liveQuiz: !!one("SELECT id FROM course_live WHERE release_id=? AND status='open'", r.id),
    };
  });
  const points =
    one<{ n: number }>(
      'SELECT SUM(p.points) n FROM course_points p JOIN course_releases r ON r.id=p.release_id WHERE p.user_id=? AND r.group_id=?',
      user.id,
      user.group_id || '',
    )?.n || 0;
  return {
    managed: access.managed,
    level: access.level,
    groupName: group?.name || '',
    releases,
    points,
    gifts: many(
      'SELECT milestone FROM course_gifts WHERE user_id=? AND group_id=?',
      user.id,
      user.group_id || '',
    ).length,
  };
}
export function lessonView(user: User, releaseId: string) {
  const r = releaseAccess(user, releaseId);
  const qPublic = (q: LessonBody['warmup'][number]) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options,
  });
  return {
    ...r,
    snapshot: {
      ...r.snapshot,
      materials: r.snapshot.materials.map((m) => ({ ...m, questions: m.questions.map(qPublic) })),
      warmup: [],
    },
    tasks: releaseTasks(user, r),
    files: many<{ id: string; name: string; mime: string; size: number }>(
      'SELECT id,name,mime,size FROM course_files WHERE lesson_id=?',
      r.lesson_id,
    ).filter((f) => r.snapshot.materials.some((m) => m.fileIds.includes(f.id))),
    grammars: GRAMMARS.filter((g) => r.snapshot.materials.some((m) => m.grammarIds.includes(g.id))),
  };
}
export function completeLessonTask(user: User, releaseId: string, input: unknown) {
  if (user.role !== 'student') throw new AppError(403, 'O‘quvchi hisobidan bajaring.');
  const b = z
    .object({
      materialId: z.string().uuid(),
      answers: z.array(z.number().int().min(0).max(3)).max(30).default([]),
    })
    .parse(input);
  const r = releaseAccess(user, releaseId);
  const m = r.snapshot.materials.find((m) => m.id === b.materialId);
  if (!m || !['self', 'quiz'].includes(m.task))
    throw new AppError(400, 'Bu vazifa shu usulda topshirilmaydi.');
  if (
    m.task === 'quiz' &&
    (b.answers.length !== m.questions.length ||
      b.answers.some((a, i) => a >= m.questions[i].options.length))
  )
    throw new AppError(400, 'Barcha savollarga javob bering.');
  const score =
    m.task === 'quiz' ? m.questions.filter((q, i) => q.answer === b.answers[i]).length : 1;
  run(
    'INSERT OR IGNORE INTO course_tasks(release_id,material_id,user_id,score,total,completed_at) VALUES(?,?,?,?,?,?)',
    r.id,
    m.id,
    user.id,
    score,
    m.task === 'quiz' ? m.questions.length : 1,
    now(),
  );
  return {
    score,
    total: m.task === 'quiz' ? m.questions.length : 1,
    solutions: m.task === 'quiz' ? m.questions : [],
  };
}
export function courseAssignmentAccess(user: User, assignmentId: string) {
  const link = one<{ release_id: string; material_id: string }>(
    'SELECT * FROM course_assignments WHERE assignment_id=?',
    assignmentId,
  );
  if (!link) return null;
  return releaseAccess(user, link.release_id).snapshot.materials.find(
    (m) => m.id === link.material_id,
  )!;
}
export function courseBoard(user: User, groupId: string) {
  if (user.role === 'teacher') teacherGroup(user, groupId);
  else if (user.group_id !== groupId) throw new AppError(404, 'Guruh topilmadi.');
  const releases = many<{ id: string }>(
    'SELECT id FROM course_releases WHERE group_id=? ORDER BY lesson_date,opened_at',
    groupId,
  ).map((r) => releaseAccess(user, r.id));
  const students = many<User>(
    "SELECT * FROM users WHERE group_id=? AND role='student' ORDER BY name",
    groupId,
  )
    .map((s) => {
      const lessons = releases.map((r) => {
        const required = r.snapshot.materials.filter((m) => m.required && m.task !== 'none');
        const tasks = releaseTasks(s, r).filter((t) => required.some((m) => m.id === t.materialId));
        return {
          releaseId: r.id,
          status:
            tasks.length && tasks.every((t) => t.status === 'done')
              ? 'done'
              : tasks.some((t) => t.status === 'submitted')
                ? 'submitted'
                : tasks.some((t) => t.status === 'done')
                  ? 'partial'
                  : 'todo',
          points:
            one<{ points: number }>(
              'SELECT points FROM course_points WHERE release_id=? AND user_id=?',
              r.id,
              s.id,
            )?.points ?? null,
        };
      });
      const quiz = one<{ score: number; total: number }>(
        "SELECT COALESCE(SUM(a.score),0) score,COUNT(*) total FROM course_live_attempts a JOIN course_live l ON l.id=a.live_id JOIN course_releases r ON r.id=l.release_id WHERE r.group_id=? AND a.user_id=? AND a.completed_at IS NOT NULL AND l.status='closed'",
        groupId,
        s.id,
      )!;
      return {
        id: s.id,
        name: s.name,
        lessons,
        points: lessons.reduce((n, l) => n + (l.points || 0), 0),
        homework: lessons.filter((l) => l.status === 'done').length,
        quizScore: quiz.score,
        gifts: many<{ milestone: number }>(
          'SELECT milestone FROM course_gifts WHERE group_id=? AND user_id=?',
          groupId,
          s.id,
        ).map((g) => g.milestone),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.homework - a.homework ||
        b.quizScore - a.quizScore ||
        a.name.localeCompare(b.name),
    );
  return {
    releases: releases.map(({ id, title, lesson_date }) => ({ id, title, lesson_date })),
    students,
  };
}
export function setCoursePoints(user: User, releaseId: string, input: unknown) {
  const b = z
    .object({ userId: z.string().uuid(), points: z.number().int().min(0).max(10) })
    .parse(input);
  requireTeacher(user);
  const r = releaseAccess(user, releaseId);
  if (
    !one("SELECT id FROM users WHERE id=? AND group_id=? AND role='student'", b.userId, r.group_id)
  )
    throw new AppError(404, 'O‘quvchi topilmadi.');
  run(
    'INSERT INTO course_points(release_id,user_id,points,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(release_id,user_id) DO UPDATE SET points=excluded.points,updated_by=excluded.updated_by,updated_at=excluded.updated_at',
    r.id,
    b.userId,
    b.points,
    user.id,
    now(),
  );
  return { ok: true };
}
export function awardCourseGift(user: User, groupId: string, input: unknown) {
  teacherGroup(user, groupId);
  const b = z
    .object({
      userId: z.string().uuid(),
      milestone: z
        .number()
        .int()
        .positive()
        .refine((n) => n % 100 === 0),
    })
    .parse(input);
  const s = courseBoard(user, groupId).students.find((s) => s.id === b.userId);
  if (!s || s.points < b.milestone)
    throw new AppError(400, 'Sovg‘a uchun yetarli ball yig‘ilmagan.');
  run(
    'INSERT OR IGNORE INTO course_gifts(group_id,user_id,milestone,awarded_at) VALUES(?,?,?,?)',
    groupId,
    b.userId,
    b.milestone,
    now(),
  );
  return { ok: true };
}
export function liveQuiz(user: User, releaseId: string, action: string, input: unknown = {}) {
  const r = releaseAccess(user, releaseId);
  return transaction(() => {
    let live = one<{ id: string; status: string; questions: string }>(
      'SELECT * FROM course_live WHERE release_id=?',
      r.id,
    );
    if (action === 'open') {
      requireTeacher(user);
      if (!r.snapshot.warmup.length)
        throw new AppError(400, 'Darsni ochishdan oldin takrorlash quizini tayyorlang.');
      if (!live) {
        const lid = id();
        run(
          'INSERT INTO course_live(id,release_id,questions,opened_at) VALUES(?,?,?,?)',
          lid,
          r.id,
          JSON.stringify(r.snapshot.warmup),
          now(),
        );
        live = one('SELECT * FROM course_live WHERE id=?', lid)!;
      }
    }
    if (!live) return { status: 'waiting', questions: [], results: [], attempt: null };
    if (action === 'close') {
      requireTeacher(user);
      run("UPDATE course_live SET status='closed',closed_at=? WHERE id=?", now(), live.id);
      live.status = 'closed';
    }
    const questions = JSON.parse(live.questions) as LessonBody['warmup'];
    if (action === 'start' || action === 'submit') {
      if (user.role !== 'student') throw new AppError(403, 'O‘quvchi hisobidan bajaring.');
      if (live.status !== 'open') throw new AppError(409, 'Quiz yopilgan.');
      if (action === 'start')
        run(
          'INSERT OR IGNORE INTO course_live_attempts(live_id,user_id,started_at) VALUES(?,?,?)',
          live.id,
          user.id,
          now(),
        );
      else {
        const b = z
          .object({ answers: z.array(z.number().int().min(0).max(3)).max(30) })
          .parse(input);
        const attempt = one<{ started_at: string; completed_at: string | null }>(
          'SELECT * FROM course_live_attempts WHERE live_id=? AND user_id=?',
          live.id,
          user.id,
        );
        if (!attempt) throw new AppError(409, 'Avval quizni boshlang.');
        if (
          b.answers.length !== questions.length ||
          b.answers.some((a, i) => a >= questions[i].options.length)
        )
          throw new AppError(400, 'Barcha savollarga javob bering.');
        if (!attempt.completed_at)
          run(
            'UPDATE course_live_attempts SET completed_at=?,score=?,elapsed_ms=? WHERE live_id=? AND user_id=? AND completed_at IS NULL',
            now(),
            questions.filter((q, i) => q.answer === b.answers[i]).length,
            Math.max(0, Date.now() - Date.parse(attempt.started_at)),
            live.id,
            user.id,
          );
      }
    }
    const attempt =
      one<{ score: number | null; completed_at: string | null; elapsed_ms: number | null }>(
        'SELECT score,completed_at,elapsed_ms FROM course_live_attempts WHERE live_id=? AND user_id=?',
        live.id,
        user.id,
      ) || null;
    const started = !!one(
      'SELECT user_id FROM course_live_attempts WHERE live_id=? AND user_id=?',
      live.id,
      user.id,
    );
    return {
      id: live.id,
      status: live.status,
      total: questions.length,
      attempt,
      questions:
        user.role === 'teacher' || started
          ? questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }))
          : [],
      results:
        live.status === 'closed' || user.role === 'teacher'
          ? many<{ name: string; score: number; elapsed_ms: number }>(
              'SELECT u.name,a.score,a.elapsed_ms FROM course_live_attempts a JOIN users u ON u.id=a.user_id WHERE live_id=? AND completed_at IS NOT NULL ORDER BY score DESC,elapsed_ms,user_id',
              live.id,
            )
          : [],
    };
  });
}
