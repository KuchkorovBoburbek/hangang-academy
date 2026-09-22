import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
import { planTopikMocks } from '../lib/topik';
import type { TopikGroup, TopikVocabulary } from '../lib/topik-types';
import { GRAMMARS } from '../lib/content';

const read = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.resolve('content/topik', name), 'utf8'));
const groups = read<TopikGroup[]>('groups.json');
const official = groups.filter((g) => g.origin === 'official');
const words = read<TopikVocabulary[]>('vocabulary.json');
const plain = (s: string) =>
  s
    .replace(/<\/?u>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('Supplied TOPIK reading corpus', () => {
  it('accounts for all 600 source slots, and excludes precisely the 26 withheld questions', () => {
    const exams = [35, 36, 37, 41, 47, 52, 60, 64, 83, 91, 96, 102];
    const allIds = groups.flatMap((g) => g.questions.map((q) => q.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const exam of exams) {
      const questions = official.filter((g) => g.source.exam === exam).flatMap((g) => g.questions);
      expect(questions.map((q) => q.number).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 50 }, (_, i) => i + 1),
      );
      expect(questions.filter((q) => q.withheld).map((q) => q.number)).toEqual(
        exam === 102 ? [23, 24, 42, 43] : [42, 43],
      );
      for (const q of questions.filter((q) => !q.withheld)) {
        expect(q.verified, q.id).toBe(true);
        expect(q.answer, q.id).not.toBeNull();
        expect(q.options, q.id).toHaveLength(4);
        expect(
          q.options.every((o) => plain(o).length > 0),
          q.id,
        ).toBe(true);
      }
    }
  });

  it('retains tested underlines, complete insertion markers and local stimulus crops', () => {
    const imagePaths: string[] = [];
    for (const group of official) {
      if (group.questions.some((q) => q.withheld)) continue;
      if (group.category === '3-4')
        for (const q of group.questions) expect(q.prompt, q.id).toMatch(/<u>.+<\/u>/);
      if (['1-2', '16-18', '19-20', '21-22', '28-31', '44-45', '48-50'].includes(group.category)) {
        const body = group.category === '1-2' ? group.questions[0].prompt : group.passage;
        expect(body, group.id).toMatch(/\(\s+\)/);
      }
      if (group.category === '39-41') {
        const passage = group.blocks.find((b) => b.type === 'text')?.text || '';
        expect(passage.match(/\(\s*[ㄱㄴㄷㄹ]\s*\)/g), group.id).toHaveLength(4);
        expect(
          group.blocks.some((b) => b.type === 'box' && !!b.text),
          group.id,
        ).toBe(true);
        expect(group.questions[0].options).toEqual(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ']);
      }
      for (const block of group.blocks) {
        if (block.type !== 'image') continue;
        expect(block.src, group.id).toMatch(/^\/topik-assets\/\d+\/q\d+\.webp$/);
        expect(block.alt, group.id).toBeTruthy();
        expect(fs.existsSync(path.join('public', block.src!)), group.id).toBe(true);
        imagePaths.push(block.src!);
      }
      for (const text of [
        group.passage,
        ...group.questions.flatMap((q) => [q.prompt, ...q.options]),
      ]) {
        expect((text.match(/<u>/g) || []).length, group.id).toBe(
          (text.match(/<\/u>/g) || []).length,
        );
        expect(text, group.id).not.toMatch(/�|Test of Proficiency/);
      }
    }
    expect(new Set(imagePaths).size).toBe(72);
  });

  it('covers every supplied grammar and scopes vocabulary counts to real source questions', () => {
    const grammar = read<TopikGroup[]>('generated-grammar.json');
    expect(new Set(grammar.flatMap((g) => g.questions.flatMap((q) => q.grammarIds || [])))).toEqual(
      new Set(GRAMMARS.map((g) => g.id)),
    );
    expect(grammar.every((g) => g.origin === 'generated' && g.source.exam === null)).toBe(true);
    const validSources = new Set(
      official.flatMap((g) => g.questions.filter((q) => !q.withheld).map((q) => q.id)),
    );
    for (const word of words) {
      expect(
        word.sourceQuestionIds.every((id) => validSources.has(id)),
        word.ko,
      ).toBe(true);
      expect(word.frequency, word.ko).toBe(
        Object.values(word.categoryFrequencies || {}).reduce((a, b) => a + b, 0),
      );
      expect(word.frequency, word.ko).toBeGreaterThan(0);
      expect(word.example, word.ko).toBeTruthy();
      expect(word.translation, word.ko).toBeTruthy();
      expect(word.uz, word.ko).toBeTruthy();
    }
  });

  it('builds 12 real-source mocks, omits 42–43 and reuses only the needed 23–24 pair', () => {
    const draftFile = path.resolve('content/topik/draft-reading-replacements.json');
    if (!fs.existsSync(draftFile)) return;
    const draft = read<TopikGroup[]>('draft-reading-replacements.json');
    expect(draft).toHaveLength(13);
    expect(draft.flatMap((g) => g.questions)).toHaveLength(26);
    expect(draft.every((g) => g.questions.every((q) => q.verified === false))).toBe(true);
    const imported = new Set(groups.map((g) => g.id));
    expect(draft.every((g) => !imported.has(g.id))).toBe(true);
    const reviewPlan = planTopikMocks(groups);
    expect(reviewPlan.readyForms).toBe(12);
    expect(reviewPlan.skippedNumbers).toEqual([42, 43]);
    expect(reviewPlan.questionCount).toBe(48);
    expect(reviewPlan.shortages).toEqual([]);
    const ids = reviewPlan.forms.flatMap((form) =>
      form.flatMap((g) => g.questions.map((q) => q.id)),
    );
    expect(ids).toHaveLength(576);
    expect(new Set(ids).size).toBe(574);
    const repeated = [...new Set(ids)].filter((id) => ids.filter((q) => q === id).length > 1);
    expect(repeated).toHaveLength(2);
    expect(repeated.every((id) => /-r-(23|24)$/.test(id))).toBe(true);
    expect(new Set(reviewPlan.forms.map((f) => f.map((g) => g.id).join(','))).size).toBe(12);
    for (const form of reviewPlan.forms) {
      expect(form.flatMap((g) => g.questions)).toHaveLength(48);
      expect(new Set(form.flatMap((g) => g.questions.map((q) => q.id))).size).toBe(48);
      expect(form.every((g) => g.origin === 'official')).toBe(true);
      expect(
        new Set(form.filter((g) => g.origin === 'official').map((g) => g.source.exam)).size,
      ).toBeGreaterThan(1);
    }
  });
});

it('matches vocabulary in context without confusing 법 with 방법 and builds usable cloze examples', async () => {
  const { matchWords, wordCloze } = await import('../lib/word-context');
  const words = JSON.parse(fs.readFileSync('content/topik/vocabulary.json', 'utf8'));
  const law = words.find((w: { ko: string }) => w.ko === '법');
  expect(matchWords('방법을 찾고 법을 지킨다.', [law]).map((m) => m.surface)).toEqual(['법을']);
  expect(matchWords('하는 법을 배운다.', [law])).toHaveLength(0);
  expect(words.filter((w: Parameters<typeof wordCloze>[0]) => wordCloze(w)).length).toBeGreaterThan(
    250,
  );
});
