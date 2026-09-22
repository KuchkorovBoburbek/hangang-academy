import { TOPIK_CATEGORIES, type TopikVocabulary } from './topik-types';

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
  band === 'all' ? 'Barchasi' : band === 'general' ? 'Umumiy so‘zlar' : band.replace('-', '–');
export type VocabularyEntry = TopikVocabulary & {
  section: VocabularySection;
  origin: 'topik' | 'academy' | 'teacher';
  groupIds: string[];
  revision: number;
  edited: boolean;
  label?: string;
};
export type VocabularyInput = Pick<
  VocabularyEntry,
  'ko' | 'uz' | 'pos' | 'example' | 'translation' | 'kind' | 'section' | 'categories'
>;
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
};
