import { z } from 'zod';
import { many, one, run } from './db';
import { AppError, teacherGroup } from './auth';
import type { Group, User } from './types';
import type { CourseLevel } from './course-types';
import {
  matchesCategory,
  sameScope,
  vocabularyLevel,
  vocabularyTopics,
  type VocabularyEntry,
  type VocabularyScope,
} from './vocabulary-types';

export const scopeSchema = z
  .object({
    level: z.enum(['hangul', 'topik34', 'topik56']).default('topik34'),
    book: z.enum(['1A', '1B', '2A', '2B']).nullable().default(null),
    section: z.enum(['reading', 'writing', 'listening']).default('reading'),
  })
  .superRefine((v, ctx) => {
    if (v.level === 'hangul' ? !v.book || v.section !== 'reading' : !!v.book)
      ctx.addIssue({ code: 'custom', message: 'Daraja, kitob va bo‘lim mos emas.' });
  });
export function validateCategories(scope: VocabularyScope, categories: string[], allowAll = false) {
  const available = vocabularyTopics(scope).map((t) => t.id);
  if (
    categories.some(
      (c) =>
        !(allowAll && c === 'all') &&
        !available.includes(c) &&
        !(scope.level !== 'hangul' && scope.section === 'reading' && ['1-2', '3-4'].includes(c)),
    )
  )
    throw new AppError(400, 'Mavzu yoki savollar diapazoni bo‘limga mos emas.');
}
export function groupVocabularyLevel(group: Group): CourseLevel {
  return (
    one<{ level: CourseLevel }>('SELECT level FROM courses WHERE id=?', group.course_id || '')
      ?.level || vocabularyLevel(group.level)
  );
}
export function vocabularyGrants(groupId: string) {
  return many<{
    level: CourseLevel;
    book: string;
    section: VocabularyScope['section'];
    categories: string;
  }>('SELECT level,book,section,categories FROM vocabulary_access WHERE group_id=?', groupId).map(
    (g) => ({
      ...g,
      book: (g.book || null) as VocabularyScope['book'],
      categories: JSON.parse(g.categories) as string[],
    }),
  );
}
export function grantedWord(word: VocabularyEntry, grants: ReturnType<typeof vocabularyGrants>) {
  return grants.some(
    (g) => sameScope(word, g) && g.categories.some((c) => matchesCategory(word.categories, c)),
  );
}
export function saveVocabularyAccess(user: User, input: unknown) {
  const b = z
    .object({ groupId: z.uuid(), scope: scopeSchema, categories: z.array(z.string()).max(30) })
    .parse(input);
  teacherGroup(user, b.groupId);
  const group = one<Group>('SELECT * FROM groups WHERE id=?', b.groupId)!;
  if (groupVocabularyLevel(group) !== b.scope.level)
    throw new AppError(400, 'Lug‘at darajasi guruhga mos emas.');
  validateCategories(b.scope, b.categories, true);
  writeVocabularyGrant(b.groupId, b.scope, b.categories);
  return { ok: true };
}
export function writeVocabularyGrant(
  groupId: string,
  scope: VocabularyScope,
  categories: string[],
) {
  run(
    'INSERT INTO vocabulary_access(group_id,level,book,section,categories) VALUES(?,?,?,?,?) ON CONFLICT(group_id,level,book,section) DO UPDATE SET categories=excluded.categories',
    groupId,
    scope.level,
    scope.book || '',
    scope.section,
    JSON.stringify([...new Set(categories)]),
  );
}
export function openVocabularyTopics(
  groupId: string,
  scope: VocabularyScope,
  categories: string[],
) {
  const previous = vocabularyGrants(groupId).find((g) => sameScope(g, scope));
  writeVocabularyGrant(groupId, scope, [...(previous?.categories || []), ...categories]);
}
