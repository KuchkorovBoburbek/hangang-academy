import { courseAccess } from './course-access';
import { studentCourses } from './courses';
import { assignmentComplete } from './topik-teaching';
import { topikProgress, topikGrammarCoverage, grammarMastery } from './progress';
import { studySummary, recordStudy } from './study';
import { randomInt, createHash } from 'node:crypto';
import { many, one, run, transaction, id, now } from './db';
import { AppError, teacherGroup } from './auth';
import type {
  User,
  Group,
  Question,
  QuizSession,
  QuizAnswer,
  QuizKind,
  Assignment,
  Submission,
  AIJob,
  Attachment,
} from './types';
import { GRAMMARS } from './content';
import { vocabulary, questionCoverage } from './library';
export function localDate(date: Date, timezone = 'Asia/Tashkent') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function getQuestion(qid: string): Question {
  const q = one<Omit<Question, 'options'> & { options: string }>(
    'SELECT * FROM questions WHERE id=?',
    qid,
  );
  if (!q) throw new AppError(404, 'Savol topilmadi.');
  return { ...q, options: JSON.parse(q.options) };
}
export function getSession(sid: string, user: User) {
  const s = one<QuizSession>('SELECT * FROM quiz_sessions WHERE id=? AND user_id=?', sid, user.id);
  if (!s) throw new AppError(404, 'Mashq topilmadi.');
  const access = courseAccess(user);
  const visibleWords = new Set(vocabulary(user).map((w) => w.id));
  if (
    (JSON.parse(s.question_ids) as string[]).some((qid) => {
      const q = getQuestion(qid);
      return q.kind === 'vocabulary' && !visibleWords.has(q.topic_id);
    })
  )
    throw new AppError(403, 'Bu lug‘at guruhingiz uchun ochilmagan.');
  if (access.managed) {
    const allowed = new Set([...access.grammarIds, ...vocabulary(user).map((w) => w.id)]);
    const topics = (JSON.parse(s.question_ids) as string[]).map((qid) => getQuestion(qid).topic_id);
    if (topics.some((t) => !allowed.has(t)))
      throw new AppError(403, 'Bu mashq guruhingiz uchun ochilmagan.');
  }
  return s;
}
export function viewSession(s: QuizSession) {
  const ids: string[] = JSON.parse(s.question_ids);
  const answers: QuizAnswer[] = JSON.parse(s.answers);
  const completed = s.status === 'completed';
  const question = completed ? null : getQuestion(ids[answers.length]);
  return {
    id: s.id,
    kind: s.kind,
    mode: s.mode,
    status: s.status,
    total: ids.length,
    index: answers.length,
    score: s.score,
    started_at: s.started_at,
    question: question
      ? {
          id: question.id,
          kind: question.kind,
          topic_id: question.topic_id,
          prompt: question.prompt,
          options: question.options,
        }
      : null,
    results: completed
      ? answers.map((a) => ({ ...a, question: getQuestion(a.question_id) }))
      : undefined,
  };
}
export function startQuiz(
  user: User,
  kind: QuizKind,
  mode: 'practice' | 'test',
  topicId?: string,
  assignmentId?: string,
  topicIds?: string[],
) {
  if (user.role !== 'student') throw new AppError(403, 'Mashq o‘quvchi hisobidan boshlanadi.');
  const group = one<Group>('SELECT * FROM groups WHERE id=?', user.group_id || '');
  if (!group) throw new AppError(400, 'Avval guruhga qo‘shiling.');
  let requested: string[] | null = null;
  if (assignmentId) {
    const a = one<Assignment>(
      'SELECT * FROM assignments WHERE id=? AND group_id=?',
      assignmentId,
      group.id,
    );
    if (!a || a.kind === 'writing' || a.kind !== kind)
      throw new AppError(400, 'Topshiriq mos emas.');
    requested = JSON.parse(a.topic_ids);
  }
  const active = one<QuizSession>(
    "SELECT * FROM quiz_sessions WHERE user_id=? AND kind=? AND mode=? AND status=? AND COALESCE(assignment_id,'')=? ORDER BY started_at DESC LIMIT 1",
    user.id,
    kind,
    mode,
    'active',
    assignmentId || '',
  );
  if (active && !topicId && !courseAccess(user).managed)
    return viewSession(getSession(active.id, user));
  const access = courseAccess(user);
  const allowed = access.managed
    ? [...access.grammarIds, ...vocabulary(user).map((w) => w.id)]
    : ([...JSON.parse(group.grammar_ids), ...JSON.parse(group.vocabulary_ids)] as string[]);
  const visible = vocabulary(user);
  const visibleWords = new Set(visible.map((w) => w.id));
  if (access.managed && kind === 'vocabulary') {
    for (const word of visible) {
      const distractors = [...new Set(visible.filter((w) => w.uz !== word.uz).map((w) => w.uz))]
        .sort()
        .slice(0, 3);
      if (!distractors.length) continue;
      const options = shuffle([word.uz, ...distractors]);
      const qid =
        'cw-' +
        createHash('sha256')
          .update(JSON.stringify([word.id, word.ko, word.uz, options]))
          .digest('hex')
          .slice(0, 32);
      run(
        'INSERT OR IGNORE INTO questions(id,kind,topic_id,prompt,options,answer,explanation,translation,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
        qid,
        'vocabulary',
        word.id,
        `“${word.ko}” tarjimasini tanlang.`,
        JSON.stringify(options),
        options.indexOf(word.uz),
        word.example || `${word.ko} — ${word.uz}`,
        word.translation || word.uz,
        group.teacher_id,
      );
    }
  }
  let questions = many<{ id: string; kind: string; topic_id: string }>(
    'SELECT id,kind,topic_id FROM questions',
  ).filter(
    (q) =>
      allowed.includes(q.topic_id) &&
      (q.kind !== 'vocabulary' || visibleWords.has(q.topic_id)) &&
      (kind === 'review' || q.kind === kind) &&
      (!topicId || q.topic_id === topicId) &&
      (!topicIds?.length || topicIds.includes(q.topic_id)) &&
      (!requested?.length || requested.includes(q.topic_id)),
  );
  const reviews = many<{ question_id: string; due_at: string; wrong_count: number }>(
    'SELECT * FROM reviews WHERE user_id=?',
    user.id,
  );
  const due = reviews.filter((r) => r.due_at <= now()).map((r) => r.question_id);
  if (kind === 'review') questions = questions.filter((q) => due.includes(q.id));
  const priority = shuffle(questions.filter((q) => due.includes(q.id))).slice(0, 4);
  const rest = shuffle(questions.filter((q) => !priority.some((p) => p.id === q.id)));
  const selected = [...priority, ...rest].slice(0, 10);
  if (!selected.length)
    throw new AppError(
      400,
      kind === 'review'
        ? 'Hozircha takrorlash uchun savol yo‘q. Avval lug‘at yoki grammatika mashqini bajaring.'
        : 'Bu mavzuga hali savol qo‘shilmagan.',
    );
  const sid = id();
  run(
    'INSERT INTO quiz_sessions(id,user_id,kind,mode,assignment_id,question_ids,started_at) VALUES(?,?,?,?,?,?,?)',
    sid,
    user.id,
    kind,
    mode,
    assignmentId || null,
    JSON.stringify(selected.map((q) => q.id)),
    now(),
  );
  return viewSession(getSession(sid, user));
}
export function answerQuiz(user: User, sid: string, qid: string, choice: number) {
  return transaction(() => {
    const s = getSession(sid, user);
    if (s.status !== 'active') throw new AppError(409, 'Mashq allaqachon yakunlangan.');
    const ids: string[] = JSON.parse(s.question_ids);
    const answers: QuizAnswer[] = JSON.parse(s.answers);
    if (ids[answers.length] !== qid)
      throw new AppError(409, 'Bu savolga javob berilgan. Davom etish uchun sahifani yangilang.');
    const q = getQuestion(qid);
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length)
      throw new AppError(400, 'Javobni tanlang.');
    const correct = choice === q.answer;
    const t = now();
    if (q.kind === 'vocabulary')
      recordStudy(user.id, 'word', q.topic_id, correct, false, `quiz:${sid}:${qid}`, t);
    answers.push({ question_id: qid, choice, correct, at: t });
    const complete = answers.length === ids.length;
    const score = answers.filter((a) => a.correct).length;
    run(
      'UPDATE quiz_sessions SET answers=?,score=?,status=?,completed_at=? WHERE id=?',
      JSON.stringify(answers),
      score,
      complete ? 'completed' : 'active',
      complete ? t : null,
      sid,
    );
    const previous = one<{ box: number }>(
      'SELECT box FROM reviews WHERE user_id=? AND question_id=?',
      user.id,
      qid,
    );
    const box = correct ? Math.min((previous?.box || 0) + 1, 5) : 0;
    const days = [1, 2, 4, 7, 14, 30][box];
    const due = new Date(Date.now() + days * 86400000).toISOString();
    run(
      'INSERT INTO reviews(user_id,question_id,box,due_at,correct_count,wrong_count,last_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,question_id) DO UPDATE SET box=excluded.box,due_at=excluded.due_at,correct_count=reviews.correct_count+excluded.correct_count,wrong_count=reviews.wrong_count+excluded.wrong_count,last_at=excluded.last_at',
      user.id,
      qid,
      box,
      due,
      correct ? 1 : 0,
      correct ? 0 : 1,
      t,
    );
    return {
      correct: s.mode === 'practice' ? correct : undefined,
      answer: s.mode === 'practice' ? q.answer : undefined,
      explanation: s.mode === 'practice' ? q.explanation : undefined,
      translation: s.mode === 'practice' ? q.translation : undefined,
      session: viewSession(getSession(sid, user)),
    };
  });
}
export function submissionAccess(user: User, sid: string) {
  const s = one<Submission & { teacher_id: string; group_id: string }>(
    'SELECT s.*,u.name AS student_name,a.title AS assignment_title,a.prompt,a.group_id,g.teacher_id FROM submissions s JOIN users u ON u.id=s.user_id JOIN assignments a ON a.id=s.assignment_id JOIN groups g ON g.id=a.group_id WHERE s.id=?',
    sid,
  );
  if (!s) throw new AppError(404, 'Yozma ish topilmadi.');
  if (s.user_id !== user.id && s.teacher_id !== user.id)
    throw new AppError(403, 'Bu yozma ishga kirish huquqi yo‘q.');
  return s;
}
export function withSubmissionDetails(s: Submission, teacher: boolean) {
  const attachments = many<Attachment>(
    'SELECT id,name,mime,size FROM attachments WHERE submission_id=?',
    s.id,
  );
  const ai = teacher
    ? one<AIJob>(
        'SELECT * FROM ai_jobs WHERE submission_id=? ORDER BY created_at DESC LIMIT 1',
        s.id,
      )
    : null;
  return {
    ...s,
    feedback: teacher || s.published_at ? s.feedback : null,
    score: teacher || s.published_at ? s.score : null,
    attachments,
    ai: ai || null,
  };
}
export function studentState(user: User) {
  const topik = topikProgress(user.id);
  const study = studySummary(user.id);
  const activity = [...topik.answers, ...topik.words];
  const access = courseAccess(user);
  const WORDS = vocabulary(user);
  const group = one<Group>('SELECT * FROM groups WHERE id=?', user.group_id || '');
  const sessions = many<QuizSession>(
    'SELECT * FROM quiz_sessions WHERE user_id=? ORDER BY started_at DESC',
    user.id,
  );
  const complete = sessions.filter((s) => s.status === 'completed');
  const today = localDate(new Date(), user.timezone);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000);
    const key = localDate(date, user.timezone);
    return {
      date: key,
      day: new Intl.DateTimeFormat('uz-Latn', { weekday: 'short', timeZone: user.timezone }).format(
        date,
      ),
      completed:
        complete.some((s) => localDate(new Date(s.completed_at!), user.timezone) === key) ||
        activity.some((a) => localDate(new Date(a.at), user.timezone) === key),
    };
  });
  const allAnswers = [
    ...sessions.flatMap((s) => JSON.parse(s.answers) as QuizAnswer[]),
    ...topik.answers,
  ];
  const todayAnswers = allAnswers.filter((a) => localDate(new Date(a.at), user.timezone) === today);
  const allowed = group
    ? [...JSON.parse(group.grammar_ids), ...JSON.parse(group.vocabulary_ids)]
    : [];
  const reviews = many<{
    question_id: string;
    box: number;
    due_at: string;
    wrong_count: number;
    correct_count: number;
    topic_id: string;
  }>(
    'SELECT r.*,q.topic_id FROM reviews r JOIN questions q ON q.id=r.question_id WHERE user_id=?',
    user.id,
  ).filter((r) => allowed.includes(r.topic_id));
  const assignments = many<Assignment>(
    'SELECT * FROM assignments WHERE group_id=? ORDER BY due_at',
    user.group_id || '',
  ).filter((assignment) => {
    const course = one<{ release_id: string; material_id: string }>(
      'SELECT release_id,material_id FROM course_assignments WHERE assignment_id=?',
      assignment.id,
    );
    return (
      !course ||
      !!one(
        'SELECT item_id FROM course_release_items WHERE release_id=? AND item_id=? AND available_at<=?',
        course.release_id,
        course.material_id,
        now(),
      )
    );
  });
  const submissions = many<Submission>(
    'SELECT s.*,a.title AS assignment_title FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.user_id=? ORDER BY s.created_at DESC',
    user.id,
  ).map((s) => withSubmissionDetails(s, false));
  return {
    completedAssignments: [
      ...new Set(complete.map((s) => s.assignment_id).filter((id): id is string => !!id)),
      ...assignments.filter((a) => assignmentComplete(user.id, a.id)).map((a) => a.id),
    ],
    group: group
      ? {
          id: group.id,
          name: group.name,
          level: group.level,
          grammar_ids: access.managed ? JSON.stringify(access.grammarIds) : group.grammar_ids,
          vocabulary_ids: access.managed
            ? JSON.stringify(WORDS.map((w) => w.id))
            : group.vocabulary_ids,
        }
      : null,
    assignments,
    submissions,
    notes: many('SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC', user.id),
    stats: {
      today:
        todayAnswers.length +
        topik.words.filter((a) => localDate(new Date(a.at), user.timezone) === today).length,
      accuracy: allAnswers.length
        ? Math.round((allAnswers.filter((a) => a.correct).length / allAnswers.length) * 100)
        : 0,
      completed: complete.length + topik.rows.length,
      topics: new Set([
        ...reviews.map((r) => r.topic_id),
        ...topik.answers.map((a) => `topik:${a.category}`),
        ...topik.answers.flatMap((a) => a.grammarIds),
      ]).size,
      due: reviews.filter((r) => r.due_at <= now()).length + study.questions + study.words,
      topikDue: study.questions,
      wordDue: study.words,
      weekDays: week.filter((w) => w.completed).length,
    },
    week,
    reviews,
    history: complete.slice(0, 15).map((s) => ({
      id: s.id,
      kind: s.kind,
      mode: s.mode,
      score: s.score,
      total: JSON.parse(s.question_ids).length,
      completed_at: s.completed_at,
      assignment_id: s.assignment_id,
    })),
    active: sessions
      .filter((s) => s.status === 'active')
      .map((s) => ({
        id: s.id,
        kind: s.kind,
        mode: s.mode,
        answered: JSON.parse(s.answers).length,
        total: JSON.parse(s.question_ids).length,
      })),
    topikCoverage: topikGrammarCoverage(),
    grammarMastery: grammarMastery(user.id, user.timezone),
    topikHistory: topik.rows.slice(0, 10).map((s) => ({
      id: s.id,
      score: s.score,
      total: s.actual_count,
      at: s.completed_at,
      mode: s.mode,
    })),
    coverage: questionCoverage(),
    courses: studentCourses(user),
    access,
    grammars: GRAMMARS.filter((g) => !access.managed || access.grammarIds.includes(g.id)),
    words: WORDS,
  };
}
export function teacherState(user: User) {
  const WORDS = vocabulary(user);
  const groups = many<Group>(
    'SELECT * FROM groups WHERE teacher_id=? ORDER BY created_at',
    user.id,
  );
  const students = many<
    Pick<User, 'id' | 'name' | 'email' | 'group_id' | 'created_at'> & { group_name: string }
  >(
    'SELECT u.id,u.name,u.email,u.group_id,u.created_at,g.name AS group_name FROM users u JOIN groups g ON u.group_id=g.id WHERE g.teacher_id=? AND u.role=?',
    user.id,
    'student',
  );
  const quiz = many<QuizSession>(
    'SELECT q.* FROM quiz_sessions q JOIN users u ON q.user_id=u.id JOIN groups g ON u.group_id=g.id WHERE g.teacher_id=?',
    user.id,
  );
  const submissions = many<Submission>(
    'SELECT s.*,u.name AS student_name,a.title AS assignment_title,a.prompt,g.name AS group_name FROM submissions s JOIN users u ON u.id=s.user_id JOIN assignments a ON a.id=s.assignment_id JOIN groups g ON g.id=a.group_id WHERE g.teacher_id=? ORDER BY s.created_at DESC',
    user.id,
  ).map((s) => withSubmissionDetails(s, true));
  const topicByQuestion = new Map(
    many<{ id: string; topic_id: string }>('SELECT id,topic_id FROM questions').map((q) => [
      q.id,
      q.topic_id,
    ]),
  );
  const errors: Record<string, { wrong: number; total: number }> = {};
  for (const q of quiz)
    for (const answer of JSON.parse(q.answers) as QuizAnswer[]) {
      const topic = topicByQuestion.get(answer.question_id);
      if (!topic) continue;
      errors[topic] ??= { wrong: 0, total: 0 };
      errors[topic].total++;
      if (!answer.correct) errors[topic].wrong++;
    }
  const rows = students.map((s) => {
    const all = quiz.filter((q) => q.user_id === s.id);
    const done = all
      .filter((q) => q.status === 'completed')
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
    const topik = topikProgress(s.id);
    const answers = [
      ...all.flatMap((q) => JSON.parse(q.answers) as QuizAnswer[]),
      ...topik.answers,
    ];
    const recent = done.filter(
      (q) => new Date(q.completed_at!).getTime() > Date.now() - 7 * 86400000,
    );
    const assessments = [
      ...done.map((q) => ({
        at: q.completed_at!,
        percent: Math.round((q.score / JSON.parse(q.question_ids).length) * 100),
      })),
      ...topik.rows.map((q) => ({
        at: q.completed_at,
        percent: Math.round((q.score / q.actual_count) * 100),
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return {
      ...s,
      completed: done.length + topik.rows.length,
      week_days: new Set([
        ...recent.map((q) => localDate(new Date(q.completed_at!), user.timezone)),
        ...[...topik.answers, ...topik.words]
          .filter((a) => new Date(a.at).getTime() > Date.now() - 7 * 86400000)
          .map((a) => localDate(new Date(a.at), user.timezone)),
      ]).size,
      accuracy: answers.length
        ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100)
        : 0,
      last_at: [...answers, ...topik.words].sort((a, b) => b.at.localeCompare(a.at))[0]?.at || null,
      first_score: assessments[0]?.percent ?? null,
      latest_score: assessments.at(-1)?.percent ?? null,
    };
  });
  return {
    groups,
    students: rows,
    submissions,
    assignments: many<Assignment>(
      'SELECT a.*,g.name AS group_name FROM assignments a JOIN groups g ON a.group_id=g.id WHERE g.teacher_id=? ORDER BY a.created_at DESC',
      user.id,
    ),
    weakTopics: Object.entries(errors)
      .filter(([, v]) => v.wrong)
      .map(([topic, v]) => ({
        topic,
        label:
          GRAMMARS.find((g) => g.id === topic)?.form ||
          WORDS.find((w) => w.id === topic)?.ko ||
          topic,
        ...v,
      }))
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 8),
    stats: {
      students: students.length,
      groups: groups.length,
      pending: submissions.filter((s) => !s.published_at).length,
      active: rows.filter(
        (s) => s.last_at && new Date(s.last_at).getTime() > Date.now() - 3 * 86400000,
      ).length,
    },
    questionCount: one<{ count: number }>('SELECT count(*) as count FROM questions')?.count || 0,
    coverage: questionCoverage(),
    grammars: GRAMMARS,
    words: WORDS,
  };
}
export function enqueueNotification(
  userId: string,
  kind: string,
  body: string,
  key: string,
  availableAt = '',
) {
  run(
    'INSERT OR IGNORE INTO notifications(id,user_id,kind,body,dedupe_key,created_at,available_at) VALUES(?,?,?,?,?,?,?)',
    id(),
    userId,
    kind,
    body,
    key,
    now(),
    availableAt,
  );
}

export function feedbackNotification(
  title: string,
  outcome: 'success' | 'fail',
  feedback: string,
  score: number,
) {
  const status = outcome === 'success' ? '✅ SUCCESS' : '❌ FAIL · QAYTA TOPSHIRISH KERAK';
  return [status, `“${title}”`, `Baho: ${score}/100`, '', 'Ustoz izohi:', feedback.trim()]
    .join('\n')
    .slice(0, 3900);
}
