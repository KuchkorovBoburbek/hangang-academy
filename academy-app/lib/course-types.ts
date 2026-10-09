export const COURSE_LEVELS = [
  { id: 'hangul', label: '한글', description: 'Koreys tiliga ilk qadam' },
  { id: 'topik34', label: 'TOPIK 3/4', description: 'Bilimni mustahkamlash' },
  { id: 'topik56', label: 'TOPIK 5/6', description: 'Yuqori marralar sari' },
] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number]['id'];
export const MATERIAL_TYPES = [
  { id: 'vocabulary', label: 'Lug‘at', ko: '단어' },
  { id: 'grammar', label: 'Grammatika', ko: '문법' },
  { id: 'reading', label: 'O‘qish', ko: '읽기' },
  { id: 'listening', label: 'Tinglash', ko: '듣기' },
  { id: 'writing', label: 'Yozish', ko: '쓰기' },
  { id: 'speaking', label: 'Gapirish', ko: '말하기' },
  { id: 'resource', label: 'Qo‘shimcha', ko: '자료' },
] as const;
export type LessonWord = {
  id: string;
  ko: string;
  uz: string;
  example: string;
  translation: string;
};
export type LessonQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer?: number;
  explanation?: string;
};
export type LessonMaterial = {
  id: string;
  curriculumUnit?: string;
  kind: (typeof MATERIAL_TYPES)[number]['id'];
  title: string;
  body: string;
  url: string;
  fileIds: string[];
  words: LessonWord[];
  grammarIds: string[];
  topikCategory: string;
  task: 'none' | 'self' | 'quiz' | 'text' | 'upload' | 'audio';
  required: boolean;
  questions: LessonQuestion[];
};
export type LessonBody = {
  curriculumUnit?: string;
  title: string;
  description: string;
  youtubeUrl: string;
  materials: LessonMaterial[];
  warmup: LessonQuestion[];
};
export type CourseLesson = LessonBody & {
  id: string;
  course_id: string;
  position: number;
  revision: number;
  updated_at: string;
};
export type CourseFile = { id: string; name: string; mime: string; size: number };
export type LessonRelease = {
  id: string;
  group_id: string;
  lesson_id: string;
  lesson_date: string;
  due_at: string;
  snapshot: LessonBody;
  opened_at: string;
  title: string;
  position: number;
  availableItems: ReleaseItem[];
};
export type ReleaseItem = {
  item_id: string;
  available_at: string;
  due_at: string;
  published_at: string;
};
export type TaskStatus = {
  materialId: string;
  title: string;
  kind: LessonMaterial['kind'];
  required: boolean;
  status: 'todo' | 'submitted' | 'done';
  outcome?: 'success' | 'fail' | null;
  score?: number;
  total?: number;
  assignmentId?: string;
  feedback?: string | null;
  dueAt?: string;
};
export type CourseSummary = {
  id: string;
  level: CourseLevel;
  title: string;
  lessons: CourseLesson[];
};
export type CourseStudentState = {
  managed: boolean;
  level: CourseLevel | null;
  groupName: string;
  releases: (Omit<LessonRelease, 'snapshot' | 'availableItems'> & {
    tasks: TaskStatus[];
    materials: Pick<LessonMaterial, 'id' | 'kind' | 'title'>[];
    liveQuiz: boolean;
  })[];
  points: number;
  gifts: number;
};
