import { TOPIK_CATEGORIES, type TopikVocabulary } from './topik-types';
import type { CourseLevel } from './course-types';

export const VOCABULARY_LEVELS = [
  { id: 'hangul', label: 'Boshlang‘ich · 한글' },
  { id: 'topik34', label: 'TOPIK 3/4' },
  { id: 'topik56', label: 'TOPIK 5/6' },
] as const;
export const SEOULTE_BOOKS = ['1A', '1B', '2A', '2B'] as const;
export type VocabularyBook = (typeof SEOULTE_BOOKS)[number];
export type VocabularyScope = {
  level: CourseLevel;
  book: VocabularyBook | null;
  section: VocabularySection;
};
export const vocabularyLevel = (label: string): CourseLevel =>
  /hangul|한글|boshlang/i.test(label) ? 'hangul' : /5|6/.test(label) ? 'topik56' : 'topik34';
export const vocabularyTopics = (scope: VocabularyScope) =>
  scope.level === 'hangul'
    ? Array.from({ length: 8 }, (_, i) => ({ id: `unit-${i + 1}`, label: `${i + 1}-mavzu` }))
    : VOCABULARY_BANDS[scope.section].map((id) => ({
        id,
        label:
          id === 'general'
            ? 'Umumiy so‘zlar'
            : `${bandLabel(id)} · ${
                scope.section === 'reading'
                  ? id === '1-4'
                    ? 'Grammatika'
                    : TOPIK_CATEGORIES.find((c) => c.id === id)?.label || 'Savollar'
                  : 'savollar'
              }`,
      }));
export const scopeLabel = (scope: VocabularyScope) =>
  scope.level === 'hangul'
    ? `Seoulte ${scope.book}`
    : `${VOCABULARY_LEVELS.find((l) => l.id === scope.level)!.label} · ${sectionLabel(scope.section)}`;
export const sameScope = (a: VocabularyScope, b: VocabularyScope) =>
  a.level === b.level && a.book === b.book && a.section === b.section;
export const matchesCategory = (categories: string[], category: string) =>
  category === 'all' ||
  categories.includes(category) ||
  (category === '1-4' && categories.some((c) => c === '1-2' || c === '3-4'));

export const VOCABULARY_SECTIONS = [
  { id: 'reading', ko: '읽기', label: 'O‘qish' },
  { id: 'writing', ko: '쓰기', label: 'Yozish' },
  { id: 'listening', ko: '듣기', label: 'Tinglash' },
] as const;
export type VocabularySection = (typeof VOCABULARY_SECTIONS)[number]['id'];
export const VOCABULARY_BANDS: Record<VocabularySection, string[]> = {
  reading: ['general', '1-4', ...TOPIK_CATEGORIES.filter((c) => c.start > 4).map((c) => c.id)],
  writing: ['general', '51', '52', '53', '54'],
  listening: [
    'general',
    '1-5',
    '6-10',
    '11-15',
    '16-20',
    '21-25',
    '26-30',
    '31-35',
    '36-40',
    '41-45',
    '46-50',
  ],
};
export const sectionLabel = (section: VocabularySection) =>
  VOCABULARY_SECTIONS.find((s) => s.id === section)!.ko;
export const bandLabel = (band: string) =>
  band === 'all'
    ? 'Barchasi'
    : band === 'general'
      ? 'Umumiy so‘zlar'
      : band.startsWith('unit-')
        ? `${band.slice(5)}-mavzu`
        : band.replace('-', '–');
export type VocabularyEntry = TopikVocabulary & {
  section: VocabularySection;
  origin: 'topik' | 'academy' | 'teacher';
  groupIds: string[];
  revision: number;
  edited: boolean;
  label?: string;
  level: CourseLevel;
  book: VocabularyBook | null;
  createdBy?: string;
};
export type VocabularyInput = Pick<
  VocabularyEntry,
  'ko' | 'uz' | 'pos' | 'example' | 'translation' | 'kind' | 'section' | 'categories'
> &
  Partial<Pick<VocabularyScope, 'level' | 'book'>>;
export type VocabularyImportResult = {
  added: number;
  duplicates: number;
  skipped: string[];
  words: { id: string; ko: string; uz: string }[];
};
export type VocabularyJobView = {
  id: string;
  source: 'web' | 'telegram';
  section: VocabularySection;
  category: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result: VocabularyImportResult | null;
  error: string | null;
  createdAt: string;
  level: CourseLevel;
  book: VocabularyBook | null;
};
export type VocabularyCatalog = {
  level: CourseLevel;
  scopes: (VocabularyScope & {
    label: string;
    topics: { id: string; label: string; count: number; open: boolean }[];
  })[];
};
