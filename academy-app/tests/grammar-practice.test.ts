import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetDbForTests, one } from '../lib/db';
import { ensureSeed } from '../lib/seed';
import { SEOULTE_1A_GRAMMARS } from '../lib/seoulte-1a';
import { SEOULTE_1A_PRACTICE } from '../lib/grammar-practice-content';
import {
  answerGrammarPractice,
  grammarPracticeSession,
  startGrammarPractice,
} from '../lib/grammar-practice';
import { grammarMastery } from '../lib/progress';
import type { User } from '../lib/types';

let root: string;
let student: User;
let other: User;
let teacher: User;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-grammar-practice-'));
  process.env.DATA_DIR = root;
  process.env.DEMO_MODE = 'true';
  process.env.ADMIN_EMAIL = 'teacher@hangang.local';
  process.env.ADMIN_PASSWORD = 'HangangTeacher2026!';
  process.env.APP_URL = 'http://localhost:3000';
  ensureSeed();
  student = one<User>('SELECT * FROM users WHERE email=?', 'student@hangang.local')!;
  other = one<User>('SELECT * FROM users WHERE email=?', 'bekzod@hangang.local')!;
  teacher = one<User>("SELECT * FROM users WHERE role='teacher'")!;
});

afterAll(() => {
  resetDbForTests();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('Seoulte 1A practical grammar curriculum', () => {
  it('gives every grammar four distinct, correctable examples and production markers', () => {
    expect(Object.keys(SEOULTE_1A_PRACTICE)).toHaveLength(SEOULTE_1A_GRAMMARS.length);
    for (const grammar of SEOULTE_1A_GRAMMARS) {
      const practice = SEOULTE_1A_PRACTICE[grammar.id];
      expect(practice, grammar.id).toBeTruthy();
      expect(practice.examples, grammar.id).toHaveLength(4);
      expect(new Set(practice.examples.map((example) => example.sentence)).size, grammar.id).toBe(
        4,
      );
      expect(
        practice.markerGroups.every((group) => group.length > 0),
        grammar.id,
      ).toBe(true);
      for (const example of practice.examples) {
        expect(example.sentence.includes(example.target), `${grammar.id}: ${example.target}`).toBe(
          true,
        );
        expect(
          practice.markerGroups.every((group) =>
            group.some((marker) => example.sentence.includes(marker)),
          ),
          `${grammar.id}: ${example.sentence}`,
        ).toBe(true);
        expect(example.wrong, grammar.id).not.toBe(example.sentence);
        expect(example.translation.trim().length, grammar.id).toBeGreaterThan(3);
      }
    }
  });

  it('keeps answers server-side, checks all five stages and rotates examples on repeat', () => {
    const grammarId = 'S1A-01-01';
    const specification = SEOULTE_1A_PRACTICE[grammarId];
    let session = startGrammarPractice(student, grammarId);
    expect(session.variant).toBe(1);
    expect(session.exercise?.kind).toBe('select');
    expect(session.exercise).not.toHaveProperty('answer');
    expect(session.exercise).not.toHaveProperty('expected');
    const firstSentence = session.exercise?.kind === 'select' ? session.exercise.sentence : '';
    expect(() => grammarPracticeSession(other, session.id)).toThrow('topilmadi');
    expect(() => startGrammarPractice(teacher, grammarId)).toThrow('o‘quvchi');

    if (session.exercise?.kind !== 'select') throw new Error('select stage expected');
    const selectAnswer = session.exercise.options.indexOf(specification.examples[0].target);
    expect(selectAnswer).toBeGreaterThanOrEqual(0);
    let reply = answerGrammarPractice(student, { sessionId: session.id, answer: selectAnswer });
    expect(reply.correct).toBe(true);
    session = reply.session;

    reply = answerGrammarPractice(student, {
      sessionId: session.id,
      answer: specification.examples[1].target,
    });
    expect(reply.correct).toBe(true);
    session = reply.session;

    reply = answerGrammarPractice(student, {
      sessionId: session.id,
      answer: specification.examples[2].sentence,
    });
    expect(reply.correct).toBe(true);
    session = reply.session;

    reply = answerGrammarPractice(student, {
      sessionId: session.id,
      answer: specification.examples[3].sentence,
    });
    expect(reply.correct).toBe(true);
    session = reply.session;

    reply = answerGrammarPractice(student, {
      sessionId: session.id,
      answer: ['저는 학생이에요.', '제 친구는 의사예요.', '유나는 회사원이에요.'],
    });
    expect(reply.correct).toBe(true);
    expect(reply.session.status).toBe('completed');
    expect(reply.session.accuracy).toBe(100);
    expect(grammarMastery(student.id, student.timezone)[grammarId]).toBe(1);

    const repeated = startGrammarPractice(student, grammarId);
    expect(repeated.variant).toBe(2);
    expect(repeated.exercise?.kind).toBe('select');
    expect(repeated.exercise?.kind === 'select' ? repeated.exercise.sentence : '').not.toBe(
      firstSentence,
    );
  });

  it('gives one hint before revealing a missed objective answer', () => {
    const session = startGrammarPractice(student, 'S1A-02-03');
    if (session.exercise?.kind !== 'select') throw new Error('select stage expected');
    const correct = session.exercise.options.indexOf(
      SEOULTE_1A_PRACTICE['S1A-02-03'].examples[0].target,
    );
    const wrong = (correct + 1) % session.exercise.options.length;
    const first = answerGrammarPractice(student, { sessionId: session.id, answer: wrong });
    expect(first.advanced).toBe(false);
    expect(first.expected).toBeUndefined();
    const second = answerGrammarPractice(student, { sessionId: session.id, answer: wrong });
    expect(second.advanced).toBe(true);
    expect(second.expected).toBeTruthy();
    expect(second.session.step).toBe(1);
  });
});
