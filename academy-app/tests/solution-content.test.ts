import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { solutionSchema, solutionSourceHash } from '../lib/solution-schema';
import type { TopikGroup } from '../lib/topik-types';
import type { SolutionContent } from '../lib/solution-types';

const groups: TopikGroup[] = JSON.parse(fs.readFileSync('content/topik/groups.json', 'utf8'));
const solutions: { questionId: string; sourceHash: string; content: SolutionContent }[] =
  JSON.parse(fs.readFileSync('content/topik/solutions.json', 'utf8'));
const available = groups.flatMap((group) =>
  group.questions
    .filter((q) => q.verified && !q.withheld && q.answer !== null)
    .map((question) => ({ group, question })),
);
const plain = (s: string) => s.replace(/<\/?u>/g, '').replace(/\s+/g, '');

describe('Locally authored TOPIK solutions', () => {
  it('covers every available question exactly once, with no withheld or invented source IDs', () => {
    expect(available.filter(({ group }) => group.origin === 'official')).toHaveLength(574);
    expect(available.filter(({ group }) => group.origin === 'generated')).toHaveLength(111);
    expect(solutions).toHaveLength(available.length);
    expect(new Set(solutions.map((s) => s.questionId))).toEqual(
      new Set(available.map(({ question }) => question.id)),
    );
  });

  it('keeps every solution bound to the current source and official answer, with short usable text', () => {
    const indexed = new Map(solutions.map((s) => [s.questionId, s]));
    for (const { group, question } of available) {
      const entry = indexed.get(question.id)!;
      expect(entry.sourceHash, question.id).toBe(solutionSourceHash(group, question));
      expect(solutionSchema.safeParse(entry.content).success, question.id).toBe(true);
      expect(
        entry.content.reason.startsWith(['①', '②', '③', '④'][question.answer!]),
        question.id,
      ).toBe(true);
      const text = Object.values(entry.content).join(' ');
      expect(text.split(/\s+/).length, question.id).toBeLessThanOrEqual(100);
      expect(text, question.id).not.toMatch(/TODO|PLACEHOLDER|�/);
      if (entry.content.evidence) {
        const source = [
          group.passage,
          ...group.blocks.map((b) => b.text || b.alt || ''),
          question.prompt,
          ...question.options,
        ].join(' ');
        expect(plain(source), question.id).toContain(plain(entry.content.evidence));
      }
    }
  });
});
