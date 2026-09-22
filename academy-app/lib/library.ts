import { many } from './db';
import { allVocabulary } from './vocabulary-data';
import { sectionLabel } from './vocabulary-types';
import type { User, Word } from './types';
export function vocabulary(user?: User): Word[] {
  return allVocabulary(user).map((w) => ({
    id: w.id,
    ko: w.ko,
    uz: w.uz,
    example: w.example,
    translation: w.translation,
    category: w.label || `TOPIK ${sectionLabel(w.section)}`,
  }));
}
export function questionCoverage() {
  return Object.fromEntries(
    many<{ topic_id: string; count: number }>(
      'SELECT topic_id,count(*) as count FROM questions GROUP BY topic_id',
    ).map((q) => [q.topic_id, q.count]),
  ) as Record<string, number>;
}
