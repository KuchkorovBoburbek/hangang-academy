import { describe, expect, it } from 'vitest';
import { GRAMMARS } from '../lib/content';
import {
  GRAMMAR_TOPICS,
  explicitlyCategorizedGrammarIds,
  grammarTopicFor,
  groupGrammarsByTopic,
} from '../lib/grammar-topics';

describe('grammar topics', () => {
  it('places every grammar record in an explicit curriculum topic', () => {
    const categorized = explicitlyCategorizedGrammarIds();
    expect(categorized.size).toBe(GRAMMARS.length);
    expect(GRAMMARS.every((grammar) => categorized.has(grammar.id))).toBe(true);
  });

  it('groups the complete bank without losing or duplicating grammar', () => {
    const groups = groupGrammarsByTopic(GRAMMARS);
    const ids = groups.flatMap((group) => group.grammars.map((grammar) => grammar.id));
    expect(groups).toHaveLength(GRAMMAR_TOPICS.length);
    expect(ids).toHaveLength(GRAMMARS.length);
    expect(new Set(ids).size).toBe(GRAMMARS.length);
  });

  it('assigns representative grammar to the expected learning topic', () => {
    expect(grammarTopicFor('A10').label).toBe('Vaqt va ketma-ketlik');
    expect(grammarTopicFor('A12').label).toBe('Sabab va natija');
    expect(grammarTopicFor('A04').label).toBe('Maqsad va niyat');
    expect(grammarTopicFor('D05').label).toBe('Shart va majburiyat');
    expect(grammarTopicFor('B18').label).toBe('Taxmin va ehtimol');
    expect(grammarTopicFor('C26').label).toBe('Taqqoslash va qarama-qarshilik');
  });
});
