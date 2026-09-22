import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { TopikGroup, TopikQuestion } from './topik-types';
export const solutionSchema = z
  .object({
    reason: z.string().trim().min(20).max(500),
    evidence: z.string().trim().max(200),
    elimination: z.string().trim().min(20).max(500),
    tip: z.string().trim().min(10).max(200),
  })
  .strict();
export function solutionSourceHash(group: TopikGroup, question: TopikQuestion) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        category: group.category,
        passage: group.passage,
        blocks: group.blocks,
        prompt: question.prompt,
        options: question.options,
        optionImages: question.optionImages || [],
        answer: question.answer,
      }),
    )
    .digest('hex');
}
