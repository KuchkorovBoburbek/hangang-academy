import { describe, expect, it } from 'vitest';
import { GRAMMARS } from '../lib/content';
import {
  SEOULTE_1A_GRAMMARS,
  SEOULTE_1A_UNITS,
  isSeoulte1AGrammar,
  seoulte1AUnit,
  seoulte1AUnitForGrammar,
} from '../lib/seoulte-1a';

describe('Seoulte 1A grammar curriculum', () => {
  it('contains eight ordered topics with every grammar assigned exactly once', () => {
    expect(SEOULTE_1A_UNITS.map((unit) => unit.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const assigned = SEOULTE_1A_UNITS.flatMap((unit) => unit.grammarIds);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(new Set(assigned)).toEqual(new Set(SEOULTE_1A_GRAMMARS.map((grammar) => grammar.id)));
  });

  it('maps grammar records back to the correct book topic', () => {
    expect(seoulte1AUnit('seoulte-1a-unit-1')?.koTitle).toBe('안녕하세요?');
    expect(seoulte1AUnitForGrammar('S1A-01-02')?.position).toBe(1);
    expect(seoulte1AUnitForGrammar('S1A-08-03')?.position).toBe(8);
    expect(isSeoulte1AGrammar('A01')).toBe(false);
  });

  it('publishes every Seoulte grammar in the shared grammar bank', () => {
    const bankIds = new Set(GRAMMARS.map((grammar) => grammar.id));
    expect(SEOULTE_1A_GRAMMARS.every((grammar) => bankIds.has(grammar.id))).toBe(true);
  });
});
