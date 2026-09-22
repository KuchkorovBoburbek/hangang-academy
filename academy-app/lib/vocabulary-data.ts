import { courseAccess } from './course-access';
import { many, one } from './db';
import { WORDS } from './content';
import type { User, Word } from './types';
import type { TopikVocabulary } from './topik-types';
import type { VocabularyEntry, VocabularyInput, VocabularySection } from './vocabulary-types';

type Edit = { word_id: string; body: string; revision: number };
export function applyWordEdits<T extends { id: string }>(
  words: T[],
): (T & { revision: number; edited: boolean })[] {
  const edits = new Map(
    many<Edit>('SELECT word_id,body,revision FROM vocabulary_edits').map((e) => [e.word_id, e]),
  );
  return words.map((word) => {
    const edit = edits.get(word.id);
    return {
      ...word,
      ...(edit ? JSON.parse(edit.body) : {}),
      revision: edit?.revision || 0,
      edited: !!edit,
    };
  });
}
export function readingWords(): VocabularyEntry[] {
  const rows = many<Record<string, string | number>>(
    'SELECT * FROM topik_vocabulary WHERE current=1',
  );
  return applyWordEdits(
    rows.map((w) => ({
      id: String(w.id),
      ko: String(w.ko),
      uz: String(w.uz),
      pos: String(w.pos),
      example: String(w.example),
      translation: String(w.translation),
      kind: w.kind as 'word' | 'idiom',
      categories: JSON.parse(String(w.categories)) as string[],
      sourceQuestionIds: JSON.parse(String(w.source_question_ids)) as string[],
      frequency: Number(w.frequency),
      categoryFrequencies: JSON.parse(String(w.category_frequencies)) as Record<string, number>,
      categoryQuestionIds: JSON.parse(String(w.category_question_ids)) as Record<string, string[]>,
      section: 'reading' as const,
      origin: 'topik' as const,
      groupIds: [] as string[],
    })),
  ).map((word, index) => (word.ko === String(rows[index].ko) ? word : { ...word, matchForms: [] }));
}
export function allVocabulary(user?: User): VocabularyEntry[] {
  const basic = [
    ...WORDS,
    ...many<Word>(
      'SELECT id,ko,uz,category,example,translation FROM custom_words ORDER BY created_at',
    ),
  ];
  const academy = applyWordEdits(
    basic.map((w) => ({
      ...w,
      label: w.category,
      pos: 'So‘z',
      kind: 'word' as const,
      categories: ['general'],
      section: 'reading' as const,
      origin: 'academy' as const,
      frequency: 0,
      sourceQuestionIds: [],
      groupIds: [] as string[],
    })),
  );
  const added = applyWordEdits(
    many<{ id: string; body: string; group_ids: string }>(
      'SELECT id,body,group_ids FROM vocabulary_entries ORDER BY created_at DESC',
    ).map((row) => ({
      ...(JSON.parse(row.body) as VocabularyInput),
      id: row.id,
      groupIds: JSON.parse(row.group_ids) as string[],
      origin: 'teacher' as const,
      frequency: 0,
      sourceQuestionIds: [],
    })),
  );
  const all = [...readingWords(), ...academy, ...added];
  if (user?.role === 'student') {
    const access = courseAccess(user);
    if (access.managed) {
      const seen = new Set<string>();
      const lessonWords: VocabularyEntry[] = access.words
        .filter((w) => {
          if (seen.has(w.id)) return false;
          seen.add(w.id);
          return true;
        })
        .map((w) => ({
          ...w,
          label: 'Dars lug‘ati',
          pos: 'So‘z',
          kind: 'word',
          categories: ['general'],
          section: 'reading',
          origin: 'teacher',
          groupIds: [user.group_id!],
          frequency: 0,
          sourceQuestionIds: [],
          revision: 0,
          edited: false,
        }));
      return [
        ...lessonWords,
        ...added.filter(
          (w) => !!user.group_id && w.groupIds.includes(user.group_id) && !seen.has(w.id),
        ),
      ];
    }
  }

  return user?.role === 'student'
    ? all.filter(
        (w) => !w.groupIds.length || (!!user.group_id && w.groupIds.includes(user.group_id)),
      )
    : all;
}
export function visibleVocabularyWord(user: User, wordId: string) {
  return allVocabulary(user).find((w) => w.id === wordId);
}
export function scopeVocabulary<T extends TopikVocabulary>(words: T[], category: string): T[] {
  return words
    .filter(
      (w) =>
        category === 'all' ||
        w.categories.includes(category) ||
        (category === '1-4' && w.categories.some((c) => c === '1-2' || c === '3-4')),
    )
    .map((w) => {
      const scoped = category === '1-4' ? ['1-2', '3-4', '1-4'] : [category];
      if (category === 'all' || !Object.keys(w.categoryFrequencies || {}).length) return w;
      return {
        ...w,
        frequency: scoped.reduce((n, c) => n + (w.categoryFrequencies?.[c] || 0), 0),
        sourceQuestionIds: [...new Set(scoped.flatMap((c) => w.categoryQuestionIds?.[c] || []))],
      };
    })
    .sort((a, b) => b.frequency - a.frequency || a.ko.localeCompare(b.ko, 'ko'));
}
export function vocabularyList(
  user: User,
  section: VocabularySection,
  category = 'all',
  kind: 'word' | 'idiom' = 'word',
) {
  return scopeVocabulary(
    allVocabulary(user).filter((w) => w.section === section && w.kind === kind),
    category,
  );
}
