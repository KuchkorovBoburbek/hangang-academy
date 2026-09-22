// Safe to import in browser components: this file contains no question-bank data.
export const TOPIK_CATEGORIES = [
  { id: '1-2', label: '문법 · 빈칸', start: 1, end: 2 },
  { id: '3-4', label: '문법 · 바꿔 쓰기', start: 3, end: 4 },
  { id: '5-8', label: '실용문 · 그림', start: 5, end: 8 },
  { id: '9-12', label: '내용 일치', start: 9, end: 12 },
  { id: '13-15', label: '문장 배열', start: 13, end: 15 },
  { id: '16-18', label: '빈칸 추론', start: 16, end: 18 },
  { id: '19-20', label: '연결 표현 · 내용', start: 19, end: 20 },
  { id: '21-22', label: '관용 표현 · 중심 생각', start: 21, end: 22 },
  { id: '23-24', label: '심경 · 내용', start: 23, end: 24 },
  { id: '25-27', label: '신문 기사 제목', start: 25, end: 27 },
  { id: '28-31', label: '빈칸 추론', start: 28, end: 31 },
  { id: '32-34', label: '내용 일치', start: 32, end: 34 },
  { id: '35-38', label: '글의 주제', start: 35, end: 38 },
  { id: '39-41', label: '문장 삽입', start: 39, end: 41 },
  { id: '42-43', label: '문학 · 심경', start: 42, end: 43 },
  { id: '44-45', label: '주제 · 내용', start: 44, end: 45 },
  { id: '46-47', label: '글의 구성', start: 46, end: 47 },
  { id: '48-50', label: '종합 이해', start: 48, end: 50 },
] as const;

export type TopikCategoryId = (typeof TOPIK_CATEGORIES)[number]['id'];
export type PaperBlock = {
  type: 'text' | 'box' | 'image' | 'heading';
  text?: string;
  src?: string;
  alt?: string;
};
export type TopikQuestion = {
  id: string;
  number: number;
  prompt: string;
  options: string[];
  optionImages?: (string | null)[];
  answer: number | null;
  explanation: string;
  translation?: string;
  grammarIds?: string[];
  verified?: boolean;
  withheld?: boolean;
};
export type TopikGroup = {
  id: string;
  category: TopikCategoryId;
  origin: 'official' | 'generated';
  source: { exam: number | null; file: string; pages: number[] };
  instruction: string;
  passage: string;
  blocks: PaperBlock[];
  questions: TopikQuestion[];
};
export type TopikVocabulary = {
  id: string;
  ko: string;
  uz: string;
  pos: string;
  example: string;
  translation: string;
  categories: string[];
  sourceQuestionIds: string[];
  frequency: number;
  categoryFrequencies?: Record<string, number>;
  categoryQuestionIds?: Record<string, string[]>;
  matchForms?: string[];
  kind: 'word' | 'idiom';
};
export type TopikPublicQuestion = Omit<
  TopikQuestion,
  'answer' | 'explanation' | 'translation' | 'grammarIds' | 'verified' | 'withheld'
> & { displayNumber: number };
export type TopikPublicGroup = Omit<TopikGroup, 'questions'> & { questions: TopikPublicQuestion[] };
export type TopikResult = {
  questionId: string;
  number: number;
  choice: number | null;
  answer: number;
  correct: boolean;
  explanation: string;
  translation: string;
  saved: boolean;
  uncertain: boolean;
};
export type TopikSession = {
  id: string;
  mode: 'practice' | 'mock' | 'review';
  category: string;
  formId: string | null;
  status: 'active' | 'completed';
  requestedCount: number;
  actualCount: number;
  skippedNumbers: number[];
  notice: string | null;
  startedAt: string;
  deadline: string | null;
  completedAt: string | null;
  serverNow: string;
  groups: TopikPublicGroup[];
  choices: Record<string, number>;
  uncertain: Record<string, boolean>;
  checked: Record<string, boolean>;
  checkedResults?: TopikResult[];
  answeredCount: number;
  score: number | null;
  percent: number | null;
  timedOut: boolean;
  analytics?: {
    categories: {
      category: string;
      total: number;
      correct: number;
      seconds: number;
      enough: boolean;
    }[];
    first: { total: number; correct: number };
    seen: { total: number; correct: number };
    unknown: number;
    seconds: number;
  };
  results?: TopikResult[];
};
export type TopikHistoryItem = Pick<
  TopikSession,
  | 'id'
  | 'mode'
  | 'category'
  | 'formId'
  | 'status'
  | 'actualCount'
  | 'startedAt'
  | 'deadline'
  | 'completedAt'
  | 'score'
  | 'percent'
>;
export type TopikMockShortage = {
  category: string;
  slots: number[];
  required: number;
  available: number;
  missing: number;
};
export type TopikMockForm = {
  id: string;
  number: number;
  title: string;
  questionCount: number;
  ready: boolean;
};
export type TopikCatalog = {
  categories: ((typeof TOPIK_CATEGORIES)[number] & {
    available: number;
    official: number;
    generated: number;
  })[];
  total: number;
  official: number;
  generated: number;
  excluded: number;
  corpusVersion: string | null;
  mock: {
    requestedForms: number;
    readyForms: number;
    minutes: number;
    questionCount: number;
    skippedNumbers: number[];
    shortages: TopikMockShortage[];
    forms: TopikMockForm[];
  };
  activeSessions: TopikHistoryItem[];
  history: TopikHistoryItem[];
  savedCount: number;
  dueQuestions: number;
  dueWords: number;
};
export type TopikBookmark = { questionId: string; savedAt: string; group: TopikPublicGroup };
