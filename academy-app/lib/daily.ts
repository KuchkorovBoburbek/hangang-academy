import { allVocabulary } from './vocabulary-data';
import { id, many, now, one, run } from './db';
import { AppError } from './auth';
import {
  topikGroups,
  startTopikSession,
  getTopikSession,
  topikVocabulary,
  topikCatalog,
} from './topik';
import { dueStudyIds } from './study';
import { courseAccess } from './course-access';
import { getSession, startQuiz, viewSession } from './learning';
import type { User } from './types';
import type { TopikGroup } from './topik-types';
export type DailyStep = {
  kind: 'words' | 'reading' | 'grammar';
  engine?: 'topik' | 'quiz';
  title: string;
  wordIds?: string[];
  category?: string;
  grammarId?: string;
  count?: number;
  sessionId?: string;
};
type PlanRow = {
  id: string;
  user_id: string;
  day: string;
  minutes: number;
  steps: string;
  created_at: string;
};
function view(user: User, row: PlanRow) {
  const steps = (JSON.parse(row.steps) as DailyStep[]).map((step) => {
    const words =
      step.kind === 'words' ? allVocabulary(user).filter((w) => step.wordIds?.includes(w.id)) : [];
    const reviewed = words
      .filter((w) =>
        one(
          'SELECT event_key FROM study_events WHERE user_id=? AND event_key=?',
          user.id,
          `word:daily:${row.id}:${w.id}`,
        ),
      )
      .map((w) => w.id);
    const session = step.sessionId
      ? step.engine === 'quiz'
        ? viewSession(getSession(step.sessionId, user))
        : getTopikSession(user, step.sessionId)
      : null;
    return {
      ...step,
      words,
      reviewed,
      complete:
        step.kind === 'words' ? reviewed.length === words.length : session?.status === 'completed',
    };
  });
  return {
    id: row.id,
    day: row.day,
    minutes: row.minutes,
    steps,
    complete: steps.every((s) => s.complete),
  };
}
export function dailyPlan(user: User, minutes: 10 | 20 | 30) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: user.timezone || 'Asia/Tashkent',
  }).format(new Date());
  const access = courseAccess(user);
  const existing = one<PlanRow>(
    'SELECT * FROM daily_plans WHERE user_id=? AND day=? AND minutes=?',
    user.id,
    day,
    minutes,
  );
  if (existing) {
    const saved = JSON.parse(existing.steps) as DailyStep[];
    const incompatibleHangulPlan =
      !access.topik &&
      saved.some(
        (step) => step.kind === 'reading' || (step.kind === 'grammar' && step.engine !== 'quiz'),
      );
    if (!incompatibleHangulPlan) return view(user, existing);
    run('DELETE FROM daily_plans WHERE id=?', existing.id);
  }
  if (access.topik) topikCatalog(user); // Bring historical mistakes into the review schedule first.
  const groups = access.topik ? topikGroups() : [];
  if (access.topik && !groups.length) throw new AppError(409, 'TOPIK bazasi hali tayyor emas.');
  const dueWords = new Set(dueStudyIds(user.id, 'word'));
  const lastWord = new Map(
    many<{ item_id: string; last_at: string }>(
      "SELECT item_id,last_at FROM study_reviews WHERE user_id=? AND kind='word'",
      user.id,
    ).map((r) => [r.item_id, r.last_at]),
  );
  const words = allVocabulary(user).sort(
    (a, b) =>
      +dueWords.has(b.id) - +dueWords.has(a.id) ||
      (lastWord.get(a.id) || '').localeCompare(lastWord.get(b.id) || '') ||
      b.frequency - a.frequency,
  );
  const errors: Record<string, { total: number; wrong: number }> = {};
  const practiced = new Map(
    many<{ item_id: string; n: number }>(
      "SELECT item_id,COUNT(*) n FROM study_events WHERE user_id=? AND kind='question' GROUP BY item_id",
      user.id,
    ).map((r) => [r.item_id, r.n]),
  );
  for (const row of many<{ snapshot: string; choices: string }>(
    "SELECT snapshot,choices FROM topik_sessions WHERE user_id=? AND status='completed' ORDER BY completed_at DESC LIMIT 20",
    user.id,
  )) {
    const choices = JSON.parse(row.choices);
    for (const g of JSON.parse(row.snapshot) as TopikGroup[])
      for (const q of g.questions) {
        errors[g.category] ||= { total: 0, wrong: 0 };
        errors[g.category].total++;
        if (choices[q.id] !== q.answer) errors[g.category].wrong++;
      }
  }
  const weak =
    Object.entries(errors)
      .filter(
        ([category, e]) =>
          e.total >= 4 && e.wrong > 0 && groups.some((g) => g.category === category),
      )
      .sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total)[0]?.[0] || '1-2';
  const grammarGroups = groups.filter(
    (g) => g.origin === 'generated' && g.questions.some((q) => q.grammarIds?.length),
  );
  const dueQuestions = new Set(dueStudyIds(user.id, 'question'));
  const topikGrammar =
    grammarGroups.find((g) => g.questions.some((q) => dueQuestions.has(q.id))) ||
    [...grammarGroups].sort(
      (a, b) => (practiced.get(a.questions[0].id) || 0) - (practiced.get(b.questions[0].id) || 0),
    )[0];
  const steps: DailyStep[] = [];
  if (words.length)
    steps.push({
      kind: 'words',
      title: 'So‘z va iboralarni eslash',
      wordIds: words.slice(0, minutes / 2).map((w) => w.id),
    });
  if (access.topik) {
    steps.push({
      kind: 'reading',
      engine: 'topik',
      title: `읽기 ${weak} · ${errors[weak]?.total >= 4 ? 'Mustahkamlash' : 'Boshlang‘ich mashq'}`,
      category: weak,
      count: (minutes / 10) * 4,
    });
    steps.push({
      kind: 'grammar',
      engine: 'topik',
      title: 'Grammatikani qo‘llash',
      grammarId: topikGrammar?.questions[0].grammarIds?.[0],
      category: topikGrammar?.category || '1-2',
      count: 1,
    });
  } else {
    const allowedGrammar = new Set(access.grammarIds);
    const grammarQuestions = many<{ id: string; topic_id: string }>(
      "SELECT id,topic_id FROM questions WHERE kind='grammar'",
    ).filter((question) => allowedGrammar.has(question.topic_id));
    const dueGrammar = grammarQuestions.find((question) => dueQuestions.has(question.id));
    const grammarId =
      dueGrammar?.topic_id ||
      [...access.grammarIds].sort((a, b) => {
        const aCount = grammarQuestions
          .filter((question) => question.topic_id === a)
          .reduce((total, question) => total + (practiced.get(question.id) || 0), 0);
        const bCount = grammarQuestions
          .filter((question) => question.topic_id === b)
          .reduce((total, question) => total + (practiced.get(question.id) || 0), 0);
        return aCount - bCount;
      })[0];
    if (grammarId && grammarQuestions.some((question) => question.topic_id === grammarId))
      steps.push({
        kind: 'grammar',
        engine: 'quiz',
        title: 'Dars grammatikasini mustahkamlash',
        grammarId,
        count: grammarQuestions.filter((question) => question.topic_id === grammarId).length,
      });
  }
  const row = {
    id: id(),
    user_id: user.id,
    day,
    minutes,
    steps: JSON.stringify(steps),
    created_at: now(),
  };
  run(
    'INSERT INTO daily_plans(id,user_id,day,minutes,steps,created_at) VALUES(?,?,?,?,?,?)',
    row.id,
    user.id,
    day,
    minutes,
    row.steps,
    row.created_at,
  );
  return view(user, row);
}
export function dailyStep(user: User, planId: string, index: number) {
  const row = one<PlanRow>('SELECT * FROM daily_plans WHERE id=? AND user_id=?', planId, user.id);
  if (!row) throw new AppError(404, 'Reja topilmadi.');
  const steps: DailyStep[] = JSON.parse(row.steps),
    step = steps[index];
  if (!step || step.kind === 'words') throw new AppError(400, 'Mashq bosqichini tanlang.');
  if (step.sessionId)
    return step.engine === 'quiz'
      ? viewSession(getSession(step.sessionId, user))
      : getTopikSession(user, step.sessionId);
  if (step.engine === 'quiz') {
    const session = startQuiz(user, 'grammar', 'practice', step.grammarId);
    step.sessionId = session.id;
    run('UPDATE daily_plans SET steps=? WHERE id=?', JSON.stringify(steps), row.id);
    return session;
  }
  const session = startTopikSession(user, {
    mode: 'practice',
    category: step.category,
    grammarId: step.grammarId,
    count: step.count,
  });
  step.sessionId = session.id;
  run('UPDATE daily_plans SET steps=? WHERE id=?', JSON.stringify(steps), row.id);
  return session;
}
export type DailyPlan = ReturnType<typeof dailyPlan>;
