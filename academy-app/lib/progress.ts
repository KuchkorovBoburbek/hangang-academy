import { many } from './db';
import type { TopikGroup } from './topik-types';
export function topikProgress(userId: string) {
  const rows = many<{
    id: string;
    snapshot: string;
    choices: string;
    completed_at: string;
    score: number;
    actual_count: number;
    mode: string;
    category: string;
    uncertain: string;
  }>(
    "SELECT * FROM topik_sessions WHERE user_id=? AND status='completed' ORDER BY completed_at DESC",
    userId,
  );
  const answers = rows.flatMap((r) => {
    const choices = JSON.parse(r.choices),
      uncertain = JSON.parse(r.uncertain || '{}');
    return (JSON.parse(r.snapshot) as TopikGroup[]).flatMap((g) =>
      g.questions.map((q) => ({
        question_id: q.id,
        correct: choices[q.id] === q.answer,
        uncertain: !!uncertain[q.id],
        at: r.completed_at,
        category: g.category,
        grammarIds: q.grammarIds || [],
      })),
    );
  });
  const words = many<{ at: string }>(
    "SELECT at FROM study_events WHERE user_id=? AND kind='word'",
    userId,
  );
  return { rows, answers, words };
}
export function topikGrammarCoverage() {
  const result: Record<string, number> = {};
  for (const q of many<{ grammar_ids: string }>(
    'SELECT grammar_ids FROM topik_questions WHERE current=1 AND servable=1',
  ))
    for (const id of JSON.parse(q.grammar_ids) as string[]) result[id] = (result[id] || 0) + 1;
  return result;
}
export function grammarMastery(userId: string, timezone: string) {
  const topics = new Map(
    many<{ id: string; topic_id: string }>(
      "SELECT id,topic_id FROM questions WHERE kind='grammar'",
    ).map((q) => [q.id, q.topic_id]),
  );
  const legacy = many<{ answers: string }>(
    'SELECT answers FROM quiz_sessions WHERE user_id=?',
    userId,
  ).flatMap((s) =>
    (JSON.parse(s.answers) as { question_id: string; correct: boolean; at: string }[])
      .filter((a) => topics.has(a.question_id))
      .map((a) => ({ ...a, uncertain: false, grammarIds: [topics.get(a.question_id)!] })),
  );
  const answers = [...topikProgress(userId).answers, ...legacy].sort((a, b) =>
    a.at.localeCompare(b.at),
  );
  const days: Record<string, Set<string>> = {};
  for (const a of answers)
    for (const grammar of a.grammarIds) {
      days[grammar] ||= new Set();
      if (!a.correct || a.uncertain) days[grammar].clear();
      else
        days[grammar].add(
          new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Asia/Tashkent' }).format(
            new Date(a.at),
          ),
        );
    }
  return Object.fromEntries(Object.entries(days).map(([id, dates]) => [id, dates.size]));
}
