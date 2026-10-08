import { expect, it } from 'vitest';
import { homeTasks, taskSummary } from '../lib/student-home';
import type { Assignment, Submission } from '../lib/types';
import type { CourseStudentState } from '../lib/course-types';
const assignment = (id: string, kind: Assignment['kind']): Assignment => ({
  id,
  kind,
  title: id,
  group_id: 'group',
  prompt: '',
  topic_ids: '[]',
  due_at: '2026-10-01',
  created_at: '',
  created_by: '',
});
const courses: CourseStudentState = {
  managed: false,
  level: null,
  groupName: '',
  releases: [],
  points: 0,
  gifts: 0,
};
const base = {
  courses,
  assignments: [] as Assignment[],
  submissions: [] as Submission[],
  completedAssignments: [] as string[],
};
it('distinguishes no task, unfinished, awaiting teacher review, and completed', () => {
  expect(taskSummary([])).toMatchObject({ status: 'empty', label: 'Vazifa yo‘q', total: 0 });
  expect(taskSummary([{ status: 'done' }])).toMatchObject({ status: 'done', label: 'Bajarilgan' });
  expect(taskSummary([{ status: 'done' }, { status: 'submitted' }])).toMatchObject({
    status: 'submitted',
    done: 1,
    submitted: 1,
  });
  expect(
    taskSummary([{ status: 'done' }, { status: 'submitted' }, { status: 'todo' }]),
  ).toMatchObject({ status: 'todo', done: 1, submitted: 1, todo: 1 });
});
it('legacy TOPIK belongs to reading, word quizzes remain vocabulary, and writing needs published feedback', () => {
  const tasks = homeTasks({
    ...base,
    assignments: [
      assignment('read', 'topik'),
      assignment('word', 'topik_words'),
      assignment('write', 'writing'),
    ],
    completedAssignments: ['read', 'write'],
    submissions: [{ assignment_id: 'write', published_at: null } as Submission],
  });
  expect(tasks.find((t) => t.id === 'read')).toMatchObject({
    kind: 'reading',
    status: 'done',
    source: 'extra',
    required: true,
    path: '/assignment/read',
  });
  expect(tasks.find((t) => t.id === 'word')).toMatchObject({ kind: 'vocabulary', status: 'todo' });
  expect(tasks.find((t) => t.id === 'write')).toMatchObject({
    kind: 'writing',
    status: 'submitted',
    path: '/writing?assignment=write',
  });
});
it('published teacher feedback changes legacy writing to done', () => {
  expect(
    homeTasks({
      ...base,
      assignments: [assignment('write', 'writing')],
      submissions: [{ assignment_id: 'write', published_at: '2026-09-22' } as Submission],
    })[0].status,
  ).toBe('done');
});
it('course speaking submissions are not double-counted as legacy writing assignments', () => {
  const tasks = homeTasks({
    ...base,
    assignments: [assignment('audio-assignment', 'writing')],
    courses: {
      ...courses,
      managed: true,
      releases: [
        {
          id: 'lesson',
          group_id: 'group',
          lesson_id: 'source',
          title: 'Oila',
          position: 1,
          lesson_date: '2026-09-22',
          due_at: '2026-09-25',
          opened_at: '',
          materials: [],
          liveQuiz: false,
          tasks: [
            {
              materialId: 'speech',
              title: 'Oilangiz haqida gapiring',
              kind: 'speaking',
              required: true,
              status: 'submitted',
              assignmentId: 'audio-assignment',
            },
          ],
        },
      ],
    },
  });
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({
    kind: 'speaking',
    status: 'submitted',
    source: 'lesson',
    required: true,
    path: '/lessons/lesson#material-speech',
  });
});
it('keeps optional lesson work separate from standalone extra assignments', () => {
  const tasks = homeTasks({
    ...base,
    assignments: [assignment('extra-writing', 'writing')],
    courses: {
      ...courses,
      managed: true,
      releases: [
        {
          id: 'lesson',
          group_id: 'group',
          lesson_id: 'source',
          title: 'Birinchi dars',
          position: 1,
          lesson_date: '2026-09-22',
          due_at: '2026-09-25',
          opened_at: '',
          materials: [],
          liveQuiz: false,
          tasks: [
            {
              materialId: 'optional-word-work',
              title: 'So‘zlarni takrorlash',
              kind: 'vocabulary',
              required: false,
              status: 'todo',
            },
          ],
        },
      ],
    },
  });
  expect(tasks.find((task) => task.id === 'lesson-optional-word-work')).toMatchObject({
    source: 'lesson',
    required: false,
    lesson: '1-dars · Birinchi dars',
  });
  expect(tasks.find((task) => task.id === 'extra-writing')).toMatchObject({
    source: 'extra',
    lesson: 'Qo‘shimcha vazifa',
  });
});
it('unfinished work from an older lesson remains ahead of completed new tasks', () => {
  const tasks = homeTasks({
    ...base,
    courses: {
      ...courses,
      releases: [2, 1].map((n) => ({
        id: String(n),
        group_id: 'group',
        lesson_id: String(n),
        title: `Dars ${n}`,
        position: n,
        lesson_date: `2026-09-${20 + n}`,
        due_at: `2026-09-${21 + n}`,
        opened_at: '',
        materials: [],
        liveQuiz: false,
        tasks: [
          {
            materialId: 'read',
            title: 'O‘qish',
            kind: 'reading',
            required: true,
            status: n === 2 ? 'done' : 'todo',
          },
        ],
      })),
    },
  });
  expect(tasks[0].lesson).toBe('1-dars · Dars 1');
  expect(taskSummary(tasks)).toMatchObject({ status: 'todo', total: 2, done: 1 });
});
