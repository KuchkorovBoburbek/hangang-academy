import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { many, one, resetDbForTests, run } from '../lib/db';
import {
  answerTopikSession,
  checkTopikQuestion,
  finishTopikSession,
  getTopikSession,
  importTopikCorpus,
  startTopikSession,
  topikCatalog,
} from '../lib/topik';
import {
  editTopikSolution,
  getTopikSolution,
  importTopikSolutions,
  listSolutionEditor,
  saveTopikSolutionNote,
  solutionEditorDetail,
} from '../lib/topik-solutions';
import { organizeNote, saveNote } from '../lib/notebook';
import type { TopikGroup } from '../lib/topik-types';
import type { Note, User } from '../lib/types';
const student = { id: 'solutions-student' } as User;
const other = { id: 'solutions-other' } as User;
const head = { id: 'solutions-head' } as User;
const teacher = { id: 'solutions-teacher', role: 'teacher', content_editor: 1 } as User;
const corpus: TopikGroup[] = JSON.parse(fs.readFileSync('content/topik/groups.json', 'utf8'));
const sample = JSON.parse(fs.readFileSync('content/topik/solutions.json', 'utf8')).find(
  (s: { questionId: string }) => s.questionId === 'topik-35-r-01',
);
let root: string;
let sessionId: string;
let noteId: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-solutions-'));
  resetDbForTests();
  process.env.DATA_DIR = root;
  for (const user of [student, other, head, teacher])
    run(
      'INSERT INTO users(id,name,email,password_hash,role,content_editor,created_at) VALUES(?,?,?,?,?,?,?)',
      user.id,
      user.id,
      `${user.id}@test.local`,
      'unused',
      [head, teacher].includes(user) ? 'teacher' : 'student',
      user === head ? 1 : 0,
      new Date().toISOString(),
    );
  importTopikCorpus(corpus, []);
  importTopikSolutions();
  const session = startTopikSession(student, { mode: 'practice', category: '1-2', count: 10 });
  sessionId = session.id;
  // Fix the private snapshot so this test exercises the same known source every run.
  run(
    'UPDATE topik_sessions SET snapshot=?,actual_count=2 WHERE id=?',
    JSON.stringify(corpus.filter((g) => g.source.exam === 35 && g.category === '1-2')),
    sessionId,
  );
});
afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('TOPIK solutions and notebook boundaries', () => {
  it('keeps solutions private until checking; selecting alone does not unlock them', () => {
    expect(() => getTopikSolution(student, sessionId, sample.questionId)).toThrow('tekshiring');
    expect(() => saveTopikSolutionNote(student, sessionId, sample.questionId)).toThrow(
      'tekshiring',
    );
    expect(() => checkTopikQuestion(student, sessionId, sample.questionId)).toThrow();
    answerTopikSession(student, sessionId, sample.questionId, 2);
    expect(() => getTopikSolution(student, sessionId, sample.questionId)).toThrow('tekshiring');
    const checked = checkTopikQuestion(student, sessionId, sample.questionId);
    expect(checked.status).toBe('active');
    expect(checked.checkedResults).toHaveLength(1);
    expect(checked.checkedResults![0]).toMatchObject({
      questionId: sample.questionId,
      correct: true,
    });
    expect(checked.groups.every((g) => g.questions.every((q) => !('answer' in q)))).toBe(true);
    expect(getTopikSolution(student, sessionId, sample.questionId).content).toEqual(sample.content);
    expect(() => getTopikSolution(student, sessionId, 'topik-35-r-02')).toThrow('tekshiring');
    expect(() => getTopikSolution(other, sessionId, sample.questionId)).toThrow('topilmadi');
    expect(() => answerTopikSession(student, sessionId, sample.questionId, 0)).toThrow();
  });

  it('does not record a checked answer twice when the whole attempt finishes', () => {
    checkTopikQuestion(student, sessionId, sample.questionId);
    finishTopikSession(student, sessionId);
    expect(
      many(
        'SELECT * FROM study_events WHERE user_id=? AND item_id=?',
        student.id,
        sample.questionId,
      ),
    ).toHaveLength(1);
    expect(getTopikSession(student, sessionId).score).toBe(1);
    expect(() => getTopikSolution(student, sessionId, 'not-in-session')).toThrow('tegishli');
  });

  it('blocks per-question checking and solution access throughout a mock', () => {
    const mock = startTopikSession(student, {
      mode: 'mock',
      formId: topikCatalog(student).mock.forms[0].id,
    });
    const qid = mock.groups[0].questions[0].id;
    answerTopikSession(student, mock.id, qid, 0);
    expect(() => checkTopikQuestion(student, mock.id, qid)).toThrow('Mock');
    expect(() => getTopikSolution(student, mock.id, qid)).toThrow('Mock');
  });

  it('saves a solution once and keeps each student’s notes private', () => {
    noteId = saveTopikSolutionNote(student, sessionId, sample.questionId).id;
    expect(saveTopikSolutionNote(student, sessionId, sample.questionId)).toEqual({
      id: noteId,
      existing: true,
    });
    expect(() => saveTopikSolutionNote(other, sessionId, sample.questionId)).toThrow('topilmadi');
    expect(() => organizeNote(other, noteId, { pinned: true })).toThrow('topilmadi');
    expect(() => saveNote(other, { id: noteId, title: 'Foreign', body: 'Changed' })).toThrow(
      'topilmadi',
    );
    const row = one<Note>('SELECT * FROM notes WHERE id=?', noteId)!;
    expect(row).toMatchObject({
      kind: 'solution',
      question_id: sample.questionId,
      source_session_id: sessionId,
      solution_revision: 1,
    });
    expect(JSON.parse(row.solution_snapshot!).content).toEqual(sample.content);
  });

  it('allows personal annotation, folders and pins without modifying the saved teacher solution', () => {
    saveNote(student, {
      id: noteId,
      title: 'Ketma-ketlik',
      body: 'Avval ish tugaydi.',
      kind: 'word',
      folder: 'Grammatikam',
      tags: ['ketma-ketlik', 'ketma-ketlik'],
      pinned: true,
    });
    const row = one<Note>('SELECT * FROM notes WHERE id=?', noteId)!;
    expect(row).toMatchObject({
      kind: 'solution',
      body: 'Avval ish tugaydi.',
      folder: 'Grammatikam',
      pinned: 1,
    });
    expect(JSON.parse(row.tags!)).toEqual(['ketma-ketlik']);
    expect(JSON.parse(row.solution_snapshot!).content).toEqual(sample.content);
    organizeNote(student, noteId, { archived: true });
    expect(saveTopikSolutionNote(student, sessionId, sample.questionId).id).toBe(noteId);
    expect(one<Note>('SELECT * FROM notes WHERE id=?', noteId)).toMatchObject({
      archived: 0,
      body: 'Avval ish tugaydi.',
    });
  });

  it('authorizes only the actual head teacher, and rejects concurrent stale edits', () => {
    expect(() => listSolutionEditor(student)).toThrow('bosh ustoz');
    expect(() => solutionEditorDetail(teacher, sample.questionId)).toThrow('bosh ustoz');
    const current = solutionEditorDetail(head, sample.questionId);
    const content = {
      ...sample.content,
      tip: 'Yangilangan ustoz eslatmasi: ishlarning ketma-ketligiga qarang.',
    };
    editTopikSolution(head, sample.questionId, content, current.revision, current.sourceHash);
    expect(() =>
      editTopikSolution(
        head,
        sample.questionId,
        sample.content,
        current.revision,
        current.sourceHash,
      ),
    ).toThrow('yangilangan');
    expect(getTopikSolution(student, sessionId, sample.questionId)).toMatchObject({
      content,
      revision: 2,
    });
    expect(
      JSON.parse(one<Note>('SELECT * FROM notes WHERE id=?', noteId)!.solution_snapshot!).content,
    ).toEqual(sample.content);
    expect(solutionEditorDetail(head, sample.questionId).history).toHaveLength(2);
  });

  it('preserves teacher edits on import and binds older attempts to the original question text', () => {
    importTopikSolutions();
    const prior = getTopikSolution(student, sessionId, sample.questionId);
    expect(prior.revision).toBe(2);
    const changed = structuredClone(corpus);
    changed.find((g) => g.questions.some((q) => q.id === sample.questionId))!.questions[0].prompt +=
      ' 새 문제';
    importTopikCorpus(changed, []);
    expect(solutionEditorDetail(head, sample.questionId).content).toBeNull();
    const next = solutionEditorDetail(head, sample.questionId);
    editTopikSolution(
      head,
      sample.questionId,
      { ...sample.content, tip: 'Yangi matnga tegishli ustoz eslatmasi.' },
      next.revision,
      next.sourceHash,
    );
    expect(getTopikSolution(student, sessionId, sample.questionId)).toMatchObject({
      revision: 2,
      content: prior.content,
    });
    expect(() => importTopikSolutions()).toThrow('source changed');
  });

  it('classifies legacy grammar saves and supports reversible archive independently of solution notes', () => {
    const word = saveNote(student, {
      title: '참여하다',
      body: 'Ishtirok etmoq',
      topicId: '697951f4-c2a5-454f-96ae-691bd7d462dc',
    });
    expect(one<Note>('SELECT * FROM notes WHERE id=?', word.id)?.kind).toBe('word');
    const note = saveNote(student, {
      title: 'Qayd',
      body: 'Grammatika bo‘yicha misol',
      topicId: 'A01',
    });
    expect(one<Note>('SELECT * FROM notes WHERE id=?', note.id)?.kind).toBe('grammar');
    organizeNote(student, note.id, { archived: true });
    expect(one<Note>('SELECT * FROM notes WHERE id=?', note.id)?.archived).toBe(1);
    organizeNote(student, note.id, { archived: false, folder: 'Takrorlash' });
    expect(one<Note>('SELECT * FROM notes WHERE id=?', note.id)).toMatchObject({
      archived: 0,
      folder: 'Takrorlash',
    });
  });
});
