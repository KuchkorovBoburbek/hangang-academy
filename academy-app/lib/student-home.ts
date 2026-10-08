import type { CourseStudentState, LessonMaterial, TaskStatus } from './course-types';
import type { Assignment, HomeworkSkill, Submission } from './types';

export const HOME_SKILLS = [
  { id: 'reading', ko: '읽기', label: 'O‘qish' },
  { id: 'listening', ko: '듣기', label: 'Tinglash' },
  { id: 'speaking', ko: '말하기', label: 'Gapirish' },
  { id: 'writing', ko: '쓰기', label: 'Yozish' },
] as const;
export type HomeSkill = HomeworkSkill;
export type HomeTask = {
  id: string;
  title: string;
  kind: HomeSkill;
  status: TaskStatus['status'];
  source: 'lesson' | 'extra';
  required: boolean;
  lesson: string;
  dueAt: string;
  path?: string;
  assignment?: Assignment;
};

export function homeworkSkill(
  kind: LessonMaterial['kind'] | Assignment['kind'],
  saved?: HomeworkSkill,
): HomeSkill {
  if (saved) return saved;
  if (kind === 'listening' || kind === 'writing' || kind === 'speaking') return kind;
  return 'reading';
}
type HomeData = {
  courses: CourseStudentState;
  assignments: Assignment[];
  submissions: Submission[];
  completedAssignments: string[];
};

// Include older open lessons too: a new lesson must not hide unfinished homework.
export function homeTasks(data: HomeData): HomeTask[] {
  const linked = new Set(
    data.courses.releases.flatMap((r) =>
      r.tasks.flatMap((t) => (t.assignmentId ? [t.assignmentId] : [])),
    ),
  );
  const courseTasks: HomeTask[] = data.courses.releases.flatMap((r) =>
    r.tasks.map((t) => ({
      id: `${r.id}-${t.materialId}`,
      title: t.title,
      kind: homeworkSkill(t.kind),
      status: t.status,
      source: 'lesson' as const,
      required: t.required,
      lesson: `${r.position}-dars · ${r.title}`,
      dueAt: t.dueAt || r.due_at,
      path: `/lessons/${r.id}#material-${t.materialId}`,
    })),
  );
  const legacy: HomeTask[] = data.assignments
    .filter((a) => !linked.has(a.id))
    .map((a) => {
      const submission = data.submissions.find((s) => s.assignment_id === a.id);
      const outcome = submission?.review_outcome || (submission?.published_at ? 'success' : null);
      return {
        id: a.id,
        title: a.title,
        kind: homeworkSkill(a.kind, a.skill),
        status:
          a.kind === 'writing'
            ? outcome === 'success'
              ? 'done'
              : submission && outcome !== 'fail'
                ? 'submitted'
                : 'todo'
            : data.completedAssignments.includes(a.id)
              ? 'done'
              : 'todo',
        source: 'extra' as const,
        required: true,
        lesson: 'Qo‘shimcha vazifa',
        dueAt: a.due_at,
        path:
          a.kind === 'writing'
            ? `/writing?assignment=${a.id}`
            : a.kind === 'topik' || a.kind === 'topik_words'
              ? `/assignment/${a.id}`
              : undefined,
        assignment: a,
      };
    });
  const priority = { todo: 0, submitted: 1, done: 2 };
  return [...courseTasks, ...legacy].sort(
    (a, b) => priority[a.status] - priority[b.status] || a.dueAt.localeCompare(b.dueAt),
  );
}

export function taskSummary(tasks: Pick<HomeTask, 'status'>[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const todo = tasks.filter((t) => t.status === 'todo').length;
  const submitted = total - done - todo;
  const status: TaskStatus['status'] | 'empty' = !total
    ? 'empty'
    : todo
      ? 'todo'
      : submitted
        ? 'submitted'
        : 'done';
  const label = {
    empty: 'Vazifa yo‘q',
    todo: 'Bajarish kerak',
    submitted: 'Tekshirilmoqda',
    done: 'Bajarilgan',
  }[status];
  return { total, done, todo, submitted, status, label };
}
