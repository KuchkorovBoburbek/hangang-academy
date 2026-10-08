import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { ensureSeed } from '../lib/seed';
import { db, one, run, id, now, resetDbForTests } from '../lib/db';
import type { User, Group } from '../lib/types';
import {
  courseCatalog,
  saveCourseGroup,
  createLesson,
  saveLesson,
  openLesson,
  lessonView,
  studentCourses,
  completeLessonTask,
  courseBoard,
  setCoursePoints,
  awardCourseGift,
  liveQuiz,
} from '../lib/courses';
import { allVocabulary } from '../lib/vocabulary-data';
import { courseAccess, requireTopikAccess } from '../lib/course-access';
import { validateAudio } from '../lib/files';
import type { CourseLesson, LessonMaterial } from '../lib/course-types';
import { youtubeEmbedUrl, youtubeVideoId } from '../lib/youtube';
let root: string,
  teacher: User,
  student: User,
  other: User,
  gid: string,
  gid2: string,
  lesson: CourseLesson,
  release: string;
const makeMaterial = (kind: LessonMaterial['kind'] = 'vocabulary'): LessonMaterial => ({
  id: id(),
  kind,
  title: 'Oila',
  body: 'Oila mavzusini o‘rganing.',
  url: '',
  fileIds: [],
  words: [
    {
      id: id(),
      ko: '가족',
      uz: 'oila',
      example: '우리 가족이에요.',
      translation: 'Bu bizning oilamiz.',
    },
    { id: id(), ko: '동생', uz: 'uka yoki singil', example: '', translation: '' },
  ],
  grammarIds: ['A01'],
  topikCategory: '',
  task: 'self',
  required: true,
  questions: [],
});
it('accepts common YouTube links and rejects unrelated or malformed URLs', () => {
  expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
  );
  expect(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  expect(youtubeVideoId('javascript:alert(1)')).toBeNull();
});
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-courses-'));
  process.env.DATA_DIR = root;
  process.env.DEMO_MODE = 'true';
  process.env.ADMIN_EMAIL = 'teacher@hangang.local';
  process.env.ADMIN_PASSWORD = 'HangangTeacher2026!';
  ensureSeed();
  teacher = one<User>("SELECT * FROM users WHERE role='teacher'")!;
  student = one<User>("SELECT * FROM users WHERE email='student@hangang.local'")!;
  other = one<User>("SELECT * FROM users WHERE email='bekzod@hangang.local'")!;
});
afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});
it('adds three reusable programs without removing legacy groups or learning records', () => {
  const before = manyCounts();
  const cat = courseCatalog(teacher);
  expect(cat.courses.map((c) => c.level)).toEqual(['hangul', 'topik34', 'topik56']);
  expect(courseCatalog(teacher).courses).toHaveLength(3);
  expect(manyCounts()).toEqual(before);
  expect(courseAccess(student).managed).toBe(false);
});
function manyCounts() {
  return ['users', 'groups', 'submissions', 'assignments', 'quiz_sessions', 'questions'].map(
    (t) => one<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`)!.n,
  );
}
it('new groups automatically share a level program but drafts are private and paced independently', () => {
  gid = saveCourseGroup(teacher, { name: '한글 morning', level: 'hangul' }).id;
  gid2 = saveCourseGroup(teacher, { name: '한글 evening', level: 'hangul' }).id;
  const g = one<Group>('SELECT * FROM groups WHERE id=?', gid)!;
  expect(g.course_id).toBe(one<Group>('SELECT * FROM groups WHERE id=?', gid2)!.course_id);
  run('UPDATE users SET group_id=? WHERE id=?', gid, student.id);
  student.group_id = gid;
  run('UPDATE users SET group_id=? WHERE id=?', gid2, other.id);
  other.group_id = gid2;
  lesson = createLesson(teacher, g.course_id!);
  expect(allVocabulary(student)).toHaveLength(0);
  expect(studentCourses(student).releases).toHaveLength(0);
  expect(() => lessonView(student, lesson.id)).toThrow();
  expect(() => courseCatalog(student)).toThrow();
  const material = makeMaterial();
  const writing = { ...makeMaterial('writing'), words: [], task: 'text' as const };
  lesson = saveLesson(teacher, lesson.id, {
    ...lesson,
    title: 'Oila darsi',
    youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    materials: [material, writing],
    warmup: [
      { id: id(), prompt: '가족?', options: ['Oila', 'Maktab'], answer: 0, explanation: 'Oila.' },
    ],
  });
  release = openLesson(teacher, lesson.id, {
    groupId: gid,
    date: '2026-09-22',
    dueAt: '2026-10-01T12:00:00.000Z',
  }).id;
  expect(studentCourses(student).releases).toHaveLength(1);
  expect(studentCourses(other).releases).toHaveLength(0);
  expect(() => lessonView(other, release)).toThrow();
  expect(lessonView(student, release).snapshot.youtubeUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  expect(allVocabulary(student).map((w) => w.ko)).toEqual(['가족', '동생']);
  expect(allVocabulary(other)).toHaveLength(0);
  expect(() => requireTopikAccess(student)).toThrow();
});
it('publishes a video-only lesson without requiring an extra material card', () => {
  let videoLesson = createLesson(teacher, lesson.course_id);
  videoLesson = saveLesson(teacher, videoLesson.id, {
    ...videoLesson,
    title: 'Video dars',
    youtubeUrl: 'https://www.youtube.com/live/dQw4w9WgXcQ',
  });
  const videoRelease = openLesson(teacher, videoLesson.id, {
    groupId: gid,
    date: '2026-12-31',
    dueAt: '2027-01-02T12:00:00.000Z',
  }).id;
  expect(lessonView(student, videoRelease).snapshot.youtubeUrl).toBe(
    'https://www.youtube.com/live/dQw4w9WgXcQ',
  );
});
it('opens selected materials now, schedules later additions and queues scoped notifications', async () => {
  const group = one<Group>('SELECT * FROM groups WHERE id=?', gid2)!;
  let staged = createLesson(teacher, group.course_id!);
  const first = {
    ...makeMaterial('vocabulary'),
    title: 'Salomlashish',
    grammarIds: [],
    words: [
      { id: id(), ko: '안녕하세요', uz: 'salom', example: '', translation: '' },
      { id: id(), ko: '감사합니다', uz: 'rahmat', example: '', translation: '' },
    ],
  };
  const second = {
    ...makeMaterial('writing'),
    title: 'Uyga vazifa',
    words: [],
    grammarIds: [],
    task: 'text' as const,
  };
  staged = saveLesson(teacher, staged.id, {
    ...staged,
    title: 'Bosqichli dars',
    materials: [first, second],
  });
  const firstRelease = openLesson(teacher, staged.id, {
    groupId: gid2,
    availableAt: '2026-09-22T09:00:00.000Z',
    dueAt: '2027-01-10T09:00:00.000Z',
    materialIds: [first.id],
    includeVideo: false,
    notify: true,
  }).id;
  expect(lessonView(other, firstRelease).snapshot.materials.map((m) => m.title)).toEqual([
    'Salomlashish',
  ]);
  expect(lessonView(other, firstRelease).tasks).toHaveLength(1);
  expect(
    one<{ available_at: string }>(
      "SELECT available_at FROM notifications WHERE user_id=? AND kind='course-material'",
      other.id,
    )?.available_at,
  ).toBe('2026-09-22T09:00:00.000Z');

  staged = saveLesson(teacher, staged.id, {
    ...staged,
    materials: [{ ...staged.materials[0], body: 'SAQLANMAGAN GURUH TAHRIRI' }, staged.materials[1]],
  });
  openLesson(teacher, staged.id, {
    groupId: gid2,
    availableAt: '2099-01-01T09:00:00.000Z',
    dueAt: '2099-01-10T09:00:00.000Z',
    materialIds: [second.id],
    includeVideo: false,
    notify: true,
  });
  expect(lessonView(other, firstRelease).snapshot.materials.map((m) => m.title)).toEqual([
    'Salomlashish',
  ]);
  expect(JSON.stringify(lessonView(other, firstRelease))).not.toContain(
    'SAQLANMAGAN GURUH TAHRIRI',
  );
  const { studentState } = await import('../lib/learning');
  expect(
    studentState(other).assignments.some((assignment) => assignment.title.includes('Uyga vazifa')),
  ).toBe(false);
  expect(lessonView(teacher, firstRelease).snapshot.materials.map((m) => m.title)).toEqual([
    'Salomlashish',
    'Uyga vazifa',
  ]);
  expect(
    one<{ n: number }>(
      "SELECT COUNT(*) n FROM notifications WHERE user_id=? AND kind='course-material' AND available_at>'2098-01-01'",
      other.id,
    )!.n,
  ).toBe(1);
  run(
    'UPDATE course_release_items SET available_at=? WHERE release_id=? AND item_id=?',
    '2026-09-23T09:00:00.000Z',
    firstRelease,
    second.id,
  );
  expect(lessonView(other, firstRelease).snapshot.materials.map((m) => m.title)).toEqual([
    'Salomlashish',
    'Uyga vazifa',
  ]);
  expect(
    studentState(other).assignments.some((assignment) => assignment.title.includes('Uyga vazifa')),
  ).toBe(true);
  expect(
    lessonView(other, firstRelease).tasks.find((task) => task.materialId === second.id)?.dueAt,
  ).toBe('2099-01-10T09:00:00.000Z');
});
it('draft edits cannot change published materials, concurrent edits fail and opening is idempotent', () => {
  const stale = { ...lesson };
  lesson = saveLesson(teacher, lesson.id, {
    ...lesson,
    title: 'Yangi qoralama',
    materials: [{ ...lesson.materials[0], body: 'DRAFT SECRET' }, lesson.materials[1]],
  });
  expect(() => saveLesson(teacher, lesson.id, stale)).toThrow('boshqa oynada');
  expect(lessonView(student, release).title).toBe('Oila darsi');
  expect(JSON.stringify(lessonView(student, release))).not.toContain('DRAFT SECRET');
  expect(
    openLesson(teacher, lesson.id, {
      groupId: gid,
      date: '2026-10-02',
      dueAt: '2026-10-03T12:00:00.000Z',
    }).id,
  ).toBe(release);
  expect(
    one<{ n: number }>('SELECT COUNT(*) n FROM course_assignments WHERE release_id=?', release)!.n,
  ).toBe(1);
});
it('program boundaries, file references and level changes are checked server-side', () => {
  const advanced = saveCourseGroup(teacher, { name: 'Advanced', level: 'topik56' }).id;
  expect(() =>
    openLesson(teacher, lesson.id, {
      groupId: advanced,
      date: '2026-09-22',
      dueAt: '2026-10-01T12:00:00.000Z',
    }),
  ).toThrow('bir dastur');
  expect(() => saveCourseGroup(teacher, { id: gid, name: 'Changed', level: 'topik34' })).toThrow(
    'darajasini',
  );
  expect(() =>
    saveLesson(teacher, lesson.id, {
      ...lesson,
      materials: [{ ...lesson.materials[0], fileIds: [id()] }],
    }),
  ).toThrow('Fayl');
  expect(() =>
    saveLesson(teacher, lesson.id, {
      ...lesson,
      materials: [{ ...lesson.materials[0], url: 'javascript:alert(1)' }],
    }),
  ).toThrow();
  expect(() =>
    saveLesson(teacher, lesson.id, {
      ...lesson,
      youtubeUrl: 'https://example.com/not-youtube',
    }),
  ).toThrow('YouTube');
  expect(() => setCoursePoints(student, release, { userId: student.id, points: 10 })).toThrow();
});
it('homework remains pending until teacher publication; group board never leaks bodies or feedback', () => {
  const view = lessonView(student, release),
    word = view.snapshot.materials[0];
  completeLessonTask(student, release, { materialId: word.id });
  const task = view.tasks.find((t) => t.assignmentId)!;
  const sid = id();
  run(
    'INSERT INTO submissions(id,assignment_id,user_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)',
    sid,
    task.assignmentId!,
    student.id,
    'PRIVATE ANSWER',
    now(),
    now(),
  );
  expect(courseBoard(student, gid).students[0].lessons[0].status).toBe('submitted');
  run(
    "UPDATE submissions SET status='reviewed',published_at=?,feedback=? WHERE id=?",
    now(),
    'PRIVATE FEEDBACK',
    sid,
  );
  const board = courseBoard(student, gid);
  expect(board.students[0].lessons[0].status).toBe('done');
  expect(JSON.stringify(board)).not.toMatch(/PRIVATE|telegram|email/);
  expect(() => courseBoard(other, gid)).toThrow();
});
it('live quiz hides answers and student ranking until closed; repeat submissions do not inflate score', () => {
  expect(liveQuiz(student, release, 'view').status).toBe('waiting');
  expect(() => liveQuiz(student, release, 'open')).toThrow();
  liveQuiz(teacher, release, 'open');
  const start = liveQuiz(student, release, 'start');
  expect(start.questions[0]).not.toHaveProperty('answer');
  const done = liveQuiz(student, release, 'submit', { answers: [0] });
  expect(done.attempt?.score).toBe(1);
  expect(done.results).toHaveLength(0);
  expect(liveQuiz(student, release, 'submit', { answers: [1] }).attempt?.score).toBe(1);
  liveQuiz(teacher, release, 'close');
  expect(liveQuiz(student, release, 'view').results[0].score).toBe(1);
  expect(() => liveQuiz(student, release, 'submit', { answers: [0] })).toThrow('yopilgan');
});
it('points are bounded, idempotent and cannot be given across groups; gift requires earned points', () => {
  setCoursePoints(teacher, release, { userId: student.id, points: 8 });
  setCoursePoints(teacher, release, { userId: student.id, points: 9 });
  expect(studentCourses(student).points).toBe(9);
  expect(() => setCoursePoints(teacher, release, { userId: student.id, points: 101 })).toThrow();
  expect(() => setCoursePoints(teacher, release, { userId: other.id, points: 10 })).toThrow();
  expect(() => awardCourseGift(teacher, gid, { userId: student.id, milestone: 100 })).toThrow(
    'yetarli',
  );
  for (let i = 0; i < 10; i++) {
    let l = createLesson(teacher, lesson.course_id);
    l = saveLesson(teacher, l.id, { ...l, materials: [makeMaterial()] });
    const r = openLesson(teacher, l.id, {
      groupId: gid,
      date: '2026-09-22',
      dueAt: '2026-10-01T12:00:00.000Z',
    });
    setCoursePoints(teacher, r.id, { userId: student.id, points: 10 });
  }
  awardCourseGift(teacher, gid, { userId: student.id, milestone: 100 });
  awardCourseGift(teacher, gid, { userId: student.id, milestone: 100 });
  expect(studentCourses(student).gifts).toBe(1);
  expect(studentCourses(student).points).toBe(109);
});
it('lesson quizzes use server answers, malformed quiz cannot publish, first result is retained', () => {
  let l = createLesson(teacher, lesson.course_id);
  const m = {
    ...makeMaterial('grammar'),
    task: 'quiz' as const,
    questions: [
      { id: id(), prompt: 'Choose', options: ['Yes', 'No'], answer: 1, explanation: 'No' },
    ],
  };
  expect(() => saveLesson(teacher, l.id, { ...l, materials: [{ ...m, questions: [] }] })).toThrow();
  l = saveLesson(teacher, l.id, { ...l, materials: [m] });
  const r = openLesson(teacher, l.id, {
    groupId: gid,
    date: '2026-09-22',
    dueAt: '2026-10-01T12:00:00.000Z',
  });
  expect(lessonView(student, r.id).snapshot.materials[0].questions[0]).not.toHaveProperty('answer');
  expect(() => completeLessonTask(student, r.id, { materialId: m.id, answers: [] })).toThrow();
  expect(completeLessonTask(student, r.id, { materialId: m.id, answers: [0] }).score).toBe(0);
  completeLessonTask(student, r.id, { materialId: m.id, answers: [1] });
  expect(lessonView(student, r.id).tasks[0].score).toBe(0);
});
it('validates audio magic bytes and leaves database intact', () => {
  expect(() => validateAudio(Buffer.from('<html>bad</html>'), 'audio/mpeg')).toThrow();
  expect(() => validateAudio(Buffer.from('ID3valid-test'), 'audio/mpeg')).not.toThrow();
  expect(db().prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
  expect(db().prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
});

it('Telegram lesson words stay as teacher-reviewed drafts; duplicate updates and re-apply cannot publish twice', async () => {
  const { handleCourseBot, processCourseWordJob, courseWordJobs, applyCourseWordJob } =
    await import('../lib/course-bot');
  vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
  vi.stubEnv('AI_PROVIDER', 'openrouter');
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  run('UPDATE users SET telegram_id=? WHERE id=?', '991100', teacher.id);
  const message = (n: number, text: string) => ({
    update_id: n,
    message: { from: { id: 991100 }, chat: { id: 991100, type: 'private' }, text },
  });
  const callback = (n: number, data: string) => ({
    update_id: n,
    callback_query: {
      id: String(n),
      from: { id: 991100 },
      message: { chat: { id: 991100, type: 'private' } },
      data,
    },
  });
  await handleCourseBot(message(70001, '/dars'));
  await handleCourseBot(callback(70002, `c:lesson:${lesson.id}`));
  await handleCourseBot(message(70003, '선생님'));
  await handleCourseBot(message(70003, '선생님'));
  expect(courseWordJobs(teacher, lesson.id)).toHaveLength(1);
  const fetchMock = vi.fn(async () =>
    Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              words: [
                {
                  ko: '선생님',
                  uz: 'ustoz',
                  pos: 'Ot',
                  example: '선생님이 오세요.',
                  translation: 'Ustoz kelyapti.',
                  kind: 'word',
                  certainty: 'clear',
                  note: '',
                },
              ],
              skipped: [],
            }),
          },
        },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const before = studentCourses(student).releases.length;
  await processCourseWordJob();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const job = courseWordJobs(teacher, lesson.id)[0];
  expect(job.status).toBe('completed');
  expect(allVocabulary(student).some((w) => w.ko === '선생님')).toBe(false);
  lesson = applyCourseWordJob(teacher, lesson.id, job.id, {
    revision: lesson.revision,
    words: job.result.words,
  });
  expect(lesson.materials.at(-1)?.words[0].ko).toBe('선생님');
  expect(courseWordJobs(teacher, lesson.id)[0].status).toBe('applied');
  expect(() =>
    applyCourseWordJob(teacher, lesson.id, job.id, {
      revision: lesson.revision,
      words: job.result.words,
    }),
  ).toThrow();
  expect(studentCourses(student).releases).toHaveLength(before);
  expect(allVocabulary(student).some((w) => w.ko === '선생님')).toBe(false);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('opened lesson grammar and words also work in the existing practice library', async () => {
  const { studentState, startQuiz, answerQuiz } = await import('../lib/learning');
  const state = studentState(student);
  expect(JSON.parse(state.group!.grammar_ids)).toContain('A01');
  expect(state.grammars.every((g) => courseAccess(student).grammarIds.includes(g.id))).toBe(true);
  const quiz = startQuiz(student, 'vocabulary', 'practice');
  expect(quiz.question).toBeTruthy();
  expect(quiz.question).not.toHaveProperty('answer');
  expect(quiz.question!.options.length).toBeGreaterThan(1);
  expect(() => startQuiz(other, 'grammar', 'practice', 'A01')).toThrow();
});

it('backups include private lesson files as well as existing submissions', async () => {
  const { storeFile } = await import('../lib/files');
  const { createBackup } = await import('../lib/backup');
  const bytes = Buffer.from('%PDF-1.4\ncourse-backup-fixture');
  const disk = storeFile(bytes);
  run(
    'INSERT INTO course_files(id,lesson_id,name,mime,size,disk_name,created_at) VALUES(?,?,?,?,?,?,?)',
    id(),
    lesson.id,
    'lesson.pdf',
    'application/pdf',
    bytes.length,
    disk,
    now(),
  );
  const backup = createBackup(path.join(root, 'test-backups'));
  expect(fs.readFileSync(path.join(backup, 'uploads', disk))).toEqual(bytes);
  expect(
    JSON.parse(fs.readFileSync(path.join(backup, 'backup.json'), 'utf8')).files.some(
      (f: { file: string }) => f.file === `uploads/${disk}`,
    ),
  ).toBe(true);
});
