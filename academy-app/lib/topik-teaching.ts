import { allVocabulary } from './vocabulary-data';
import { many, one, run, id, now } from './db';
import { AppError, requireTeacher, teacherGroup } from './auth';
import { topikProgress } from './progress';
import { getTopikSession, startTopikSession, topikVocabulary } from './topik';
import { TOPIK_CATEGORIES } from './topik-types';
import type { User, Group, Assignment } from './types';
export function topikTeachingReport(user: User) {
  requireTeacher(user);
  return many<Group>('SELECT * FROM groups WHERE teacher_id=?', user.id).map((group) => {
    const students = many<{ id: string; name: string }>(
      "SELECT id,name FROM users WHERE group_id=? AND role='student'",
      group.id,
    );
    const categories = new Map<
      string,
      {
        category: string;
        total: number;
        wrong: number;
        questions: Set<string>;
        learners: Set<string>;
      }
    >();
    for (const student of students)
      for (const answer of topikProgress(student.id).answers.filter(
        (a) => Date.parse(a.at) >= Date.now() - 30 * 86400000,
      )) {
        const row = categories.get(answer.category) || {
          category: answer.category,
          total: 0,
          wrong: 0,
          questions: new Set<string>(),
          learners: new Set<string>(),
        };
        row.total++;
        row.wrong += +!answer.correct;
        row.questions.add(answer.question_id);
        if (!answer.correct) row.learners.add(student.name);
        categories.set(answer.category, row);
      }
    const vocabulary = new Map(
      allVocabulary(user)
        .filter((w) => !w.groupIds.length || w.groupIds.includes(group.id))
        .map((w) => [w.id, w]),
    );
    const words = many<{ id: string; wrong: number; total: number }>(
      `SELECT e.item_id id,SUM(CASE WHEN e.correct=0 THEN 1 ELSE 0 END) wrong,COUNT(*) total FROM study_events e JOIN users u ON u.id=e.user_id WHERE u.group_id=? AND e.kind='word' AND e.at>=? GROUP BY e.item_id HAVING wrong>0 ORDER BY wrong DESC`,
      group.id,
      new Date(Date.now() - 30 * 86400000).toISOString(),
    )
      .filter((w) => vocabulary.has(w.id))
      .slice(0, 12)
      .map((w) => ({ ...w, ko: vocabulary.get(w.id)!.ko, uz: vocabulary.get(w.id)!.uz }));
    return {
      groupId: group.id,
      name: group.name,
      students: students.length,
      categories: [...categories.values()]
        .filter((c) => c.wrong)
        .map((c) => ({
          category: c.category,
          total: c.total,
          wrong: c.wrong,
          enough: c.questions.size >= 4,
          learners: [...c.learners],
        }))
        .sort((a, b) => b.wrong / b.total - a.wrong / a.total),
      words,
      assignments: many<{ id: string; title: string; kind: string }>(
        "SELECT id,title,kind FROM assignments WHERE group_id=? AND kind IN ('topik','topik_words') ORDER BY created_at DESC LIMIT 10",
        group.id,
      ).map((a) => ({
        ...a,
        completed: students.filter((s) => assignmentComplete(s.id, a.id)).length,
      })),
    };
  });
}
export function createTopikAssignment(
  user: User,
  groupId: string,
  category: string | undefined,
  wordIds: string[] | undefined,
  dueAt: string,
) {
  requireTeacher(user);
  teacherGroup(user, groupId);
  const words = allVocabulary(user).filter(
    (w) => !w.groupIds.length || w.groupIds.includes(groupId),
  );
  if (
    category
      ? !TOPIK_CATEGORIES.some((c) => c.id === category && c.id !== '42-43')
      : !wordIds?.length || wordIds.some((id) => !words.some((w) => w.id === id))
  )
    throw new AppError(400, 'Mavjud savol turi yoki so‘zlarni tanlang.');
  const aid = id(),
    title = category ? `읽기 ${category} · Mustahkamlash` : 'TOPIK lug‘ati · Takrorlash';
  run(
    'INSERT INTO assignments(id,group_id,title,kind,skill,prompt,topic_ids,due_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    aid,
    groupId,
    title,
    category ? 'topik' : 'topik_words',
    'reading',
    category
      ? 'Savol turidan 10 ta mashqni bajaring.'
      : 'Belgilangan so‘zlarni misoli bilan eslang.',
    JSON.stringify(category ? [category] : [...new Set(wordIds)]),
    dueAt,
    user.id,
    now(),
  );
  return { id: aid, title };
}
export function assignmentComplete(userId: string, assignmentId: string) {
  const assignment = one<Assignment>('SELECT * FROM assignments WHERE id=?', assignmentId);
  if (!assignment) return false;
  if (assignment.kind === 'topik')
    return !!one(
      "SELECT s.id FROM topik_assignment_attempts a JOIN topik_sessions s ON s.id=a.session_id WHERE a.user_id=? AND a.assignment_id=? AND s.status='completed'",
      userId,
      assignmentId,
    );
  if (assignment.kind === 'topik_words')
    return (JSON.parse(assignment.topic_ids) as string[]).every((wordId) =>
      one(
        'SELECT event_key FROM study_events WHERE user_id=? AND event_key=?',
        userId,
        `word:assignment:${assignment.id}:${wordId}`,
      ),
    );
  return false;
}
export function studyAssignment(user: User, assignmentId: string, start = false) {
  const assignment = one<Assignment>(
    "SELECT * FROM assignments WHERE id=? AND group_id=? AND kind IN ('topik','topik_words')",
    assignmentId,
    user.group_id || '',
  );
  if (!assignment || user.role !== 'student') throw new AppError(404, 'Topshiriq topilmadi.');
  const targets = JSON.parse(assignment.topic_ids) as string[];
  let link = one<{ session_id: string }>(
    'SELECT session_id FROM topik_assignment_attempts WHERE user_id=? AND assignment_id=?',
    user.id,
    assignmentId,
  );
  if (start && assignment.kind === 'topik' && !link) {
    const session = startTopikSession(user, { mode: 'practice', category: targets[0], count: 10 });
    run(
      'INSERT INTO topik_assignment_attempts(user_id,assignment_id,session_id) VALUES(?,?,?)',
      user.id,
      assignmentId,
      session.id,
    );
    link = { session_id: session.id };
  }
  const words =
    assignment.kind === 'topik_words'
      ? allVocabulary(user).filter((w) => targets.includes(w.id))
      : [];
  const reviewed = words
    .filter((w) =>
      one(
        'SELECT event_key FROM study_events WHERE user_id=? AND event_key=?',
        user.id,
        `word:assignment:${assignmentId}:${w.id}`,
      ),
    )
    .map((w) => w.id);
  return {
    assignment,
    words,
    reviewed,
    session: link ? getTopikSession(user, link.session_id) : null,
    complete: assignmentComplete(user.id, assignmentId),
  };
}
export type TopikTeachingReport = ReturnType<typeof topikTeachingReport>;
export type StudyAssignment = ReturnType<typeof studyAssignment>;
