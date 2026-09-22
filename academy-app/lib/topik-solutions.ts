import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { id, many, now, one, run, transaction } from './db';
import { AppError, requireContentEditor } from './auth';
import { topikGroups } from './topik';
import { solutionSchema, solutionSourceHash } from './solution-schema';
import type { SolutionView, SolutionContent } from './solution-types';
import type { TopikGroup } from './topik-types';
import type { User } from './types';
type SolutionRow = {
  question_id: string;
  source_hash: string;
  body: string;
  revision: number;
  status: string;
  edited_by: string | null;
  updated_at: string;
};
function access(user: User, sessionId: string, questionId: string) {
  const row = one<{
    snapshot: string;
    status: string;
    mode: string;
    checked: string;
    choices: string;
  }>(
    'SELECT snapshot,status,mode,checked,choices FROM topik_sessions WHERE id=? AND user_id=?',
    sessionId,
    user.id,
  );
  if (!row) throw new AppError(404, 'Mashq topilmadi.');
  if (
    row.status !== 'completed' &&
    (row.mode === 'mock' || !JSON.parse(row.checked || '{}')[questionId])
  )
    throw new AppError(
      403,
      'Yechimni ko‘rishdan oldin javobni tekshiring. Mock yechimlari imtihon yakunida ochiladi.',
    );
  const group = (JSON.parse(row.snapshot) as TopikGroup[]).find((g) =>
    g.questions.some((q) => q.id === questionId),
  );
  const question = group?.questions.find((q) => q.id === questionId);
  if (!group || !question) throw new AppError(404, 'Savol bu mashqqa tegishli emas.');
  const hash = solutionSourceHash(group, question);
  const current = one<SolutionRow>(
    'SELECT * FROM topik_solutions WHERE question_id=? AND source_hash=? AND status=?',
    questionId,
    hash,
    'published',
  );
  const solution =
    current ||
    one<SolutionRow>(
      'SELECT * FROM topik_solution_revisions WHERE question_id=? AND source_hash=? AND status=? ORDER BY revision DESC LIMIT 1',
      questionId,
      hash,
      'published',
    );
  if (!solution) throw new AppError(404, 'Bu savolning yechimi hali tayyorlanmoqda.');
  return { group, question, solution };
}
export function getTopikSolution(user: User, sessionId: string, questionId: string): SolutionView {
  const { solution } = access(user, sessionId, questionId);
  return {
    questionId,
    content: JSON.parse(solution.body),
    revision: solution.revision,
    updatedAt: solution.updated_at,
    savedNoteId:
      one<{ id: string }>(
        "SELECT id FROM notes WHERE user_id=? AND kind='solution' AND question_id=?",
        user.id,
        questionId,
      )?.id || null,
  };
}
export function saveTopikSolutionNote(user: User, sessionId: string, questionId: string) {
  const { group, question, solution } = access(user, sessionId, questionId);
  return transaction(() => {
    const previous = one<{ id: string }>(
      "SELECT id FROM notes WHERE user_id=? AND kind='solution' AND question_id=?",
      user.id,
      questionId,
    );
    if (previous) {
      run('UPDATE notes SET archived=0 WHERE id=?', previous.id);
      return { id: previous.id, existing: true };
    }
    const noteId = id();
    const title = `${group.origin === 'official' ? `TOPIK ${group.source.exam}회` : 'Grammatika'} · ${question.number}-savol`;
    const snapshot = {
      content: JSON.parse(solution.body) as SolutionContent,
      answer: question.answer,
      options: question.options,
      prompt: question.prompt,
      category: group.category,
      source: group.source,
      sourceHash: solution.source_hash,
    };
    run(
      `INSERT INTO notes(id,user_id,title,body,kind,folder,tags,question_id,source_session_id,solution_revision,solution_snapshot,created_at,updated_at) VALUES(?,?,?,'','solution',?,?,?,?,?,?,?,?)`,
      noteId,
      user.id,
      title,
      'TOPIK yechimlari',
      JSON.stringify([
        `읽기 ${group.category}`,
        group.origin === 'official' ? `${group.source.exam}회` : 'Grammatika',
      ]),
      questionId,
      sessionId,
      solution.revision,
      JSON.stringify(snapshot),
      now(),
      now(),
    );
    return { id: noteId, existing: false };
  });
}
export function listSolutionEditor(user: User, category = 'all', search = '', page = 1) {
  requireContentEditor(user);
  const solutions = new Map(
    many<SolutionRow>('SELECT * FROM topik_solutions').map((r) => [r.question_id, r]),
  );
  const questions = topikGroups()
    .filter((g) => category === 'all' || g.category === category)
    .flatMap((g) =>
      g.questions.map((q) => ({
        id: q.id,
        category: g.category,
        exam: g.source.exam,
        number: q.number,
        origin: g.origin,
        prompt: q.prompt || g.passage.slice(0, 160),
        revision: solutions.get(q.id)?.revision || 0,
        updatedAt: solutions.get(q.id)?.updated_at || null,
        hasSolution: solutions.get(q.id)?.source_hash === solutionSourceHash(g, q),
      })),
    )
    .filter((q) =>
      `${q.id} ${q.exam || ''} ${q.prompt}`.toLowerCase().includes(search.toLowerCase()),
    );
  return {
    total: questions.length,
    page,
    pages: Math.max(1, Math.ceil(questions.length / 30)),
    items: questions.slice((page - 1) * 30, page * 30),
    ready: questions.filter((q) => q.hasSolution).length,
  };
}
export function solutionEditorDetail(user: User, questionId: string) {
  requireContentEditor(user);
  const group = topikGroups().find((g) => g.questions.some((q) => q.id === questionId));
  const question = group?.questions.find((q) => q.id === questionId);
  if (!group || !question) throw new AppError(404, 'Savol topilmadi.');
  const row = one<SolutionRow>('SELECT * FROM topik_solutions WHERE question_id=?', questionId);
  const sourceHash = solutionSourceHash(group, question);
  return {
    group,
    question,
    sourceHash,
    revision: row?.revision || 0,
    content: row?.source_hash === sourceHash ? (JSON.parse(row.body) as SolutionContent) : null,
    history: many<Pick<SolutionRow, 'revision' | 'updated_at'>>(
      'SELECT revision,updated_at FROM topik_solution_revisions WHERE question_id=? ORDER BY revision DESC LIMIT 10',
      questionId,
    ),
  };
}
export function editTopikSolution(
  user: User,
  questionId: string,
  rawContent: unknown,
  expectedRevision: number,
  expectedSourceHash: string,
) {
  requireContentEditor(user);
  const content = solutionSchema.parse(rawContent);
  return transaction(() => {
    const current = solutionEditorDetail(user, questionId);
    if (current.revision !== expectedRevision || current.sourceHash !== expectedSourceHash)
      throw new AppError(
        409,
        'Bu yechim boshqa joyda yangilangan. Sahifani yangilab qayta oching.',
      );
    const revision = current.revision + 1,
      stamp = now(),
      body = JSON.stringify(content);
    run(
      "INSERT INTO topik_solutions(question_id,source_hash,body,revision,status,edited_by,updated_at) VALUES(?,?,?,?,'published',?,?) ON CONFLICT(question_id) DO UPDATE SET source_hash=excluded.source_hash,body=excluded.body,revision=excluded.revision,status='published',edited_by=excluded.edited_by,updated_at=excluded.updated_at",
      questionId,
      current.sourceHash,
      body,
      revision,
      user.id,
      stamp,
    );
    run(
      "INSERT INTO topik_solution_revisions(id,question_id,source_hash,body,revision,status,edited_by,updated_at) VALUES(?,?,?,?,?,'published',?,?)",
      id(),
      questionId,
      current.sourceHash,
      body,
      revision,
      user.id,
      stamp,
    );
    return { revision, updatedAt: stamp };
  });
}
export function importTopikSolutions(file = path.resolve('content/topik/solutions.json')) {
  if (!fs.existsSync(file)) return { imported: 0, kept: 0 };
  const entries = z
    .array(z.object({ questionId: z.string(), sourceHash: z.string(), content: solutionSchema }))
    .parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (new Set(entries.map((e) => e.questionId)).size !== entries.length)
    throw new Error('Duplicate solution IDs');
  const groups = topikGroups();
  let imported = 0,
    kept = 0;
  transaction(() => {
    for (const entry of entries) {
      const group = groups.find((g) => g.questions.some((q) => q.id === entry.questionId));
      const question = group?.questions.find((q) => q.id === entry.questionId);
      if (!group || !question || solutionSourceHash(group, question) !== entry.sourceHash)
        throw new Error(`Solution source changed: ${entry.questionId}`);
      const existing = one<SolutionRow>(
        'SELECT * FROM topik_solutions WHERE question_id=?',
        entry.questionId,
      );
      // Teacher edits survive corpus imports. Identical file content is idempotent.
      if (
        existing?.source_hash === entry.sourceHash &&
        (existing.edited_by || existing.body === JSON.stringify(entry.content))
      ) {
        kept++;
        continue;
      }
      const revision = (existing?.revision || 0) + 1,
        body = JSON.stringify(entry.content),
        stamp = now();
      run(
        "INSERT INTO topik_solutions(question_id,source_hash,body,revision,status,updated_at) VALUES(?,?,?,?,'published',?) ON CONFLICT(question_id) DO UPDATE SET source_hash=excluded.source_hash,body=excluded.body,revision=excluded.revision,status='published',edited_by=NULL,updated_at=excluded.updated_at",
        entry.questionId,
        entry.sourceHash,
        body,
        revision,
        stamp,
      );
      run(
        "INSERT INTO topik_solution_revisions(id,question_id,source_hash,body,revision,status,updated_at) VALUES(?,?,?,?,?,'published',?)",
        id(),
        entry.questionId,
        entry.sourceHash,
        body,
        revision,
        stamp,
      );
      imported++;
    }
  });
  return { imported, kept };
}
