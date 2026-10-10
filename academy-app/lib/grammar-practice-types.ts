export type GrammarPracticeKind = 'select' | 'fill' | 'order' | 'correct' | 'create';

type PracticeBase = {
  kind: GrammarPracticeKind;
  title: string;
  instruction: string;
};

export type GrammarPracticeExercise =
  | (PracticeBase & {
      kind: 'select';
      sentence: string;
      translation: string;
      options: string[];
    })
  | (PracticeBase & {
      kind: 'fill';
      sentence: string;
      translation: string;
      hint: string;
    })
  | (PracticeBase & {
      kind: 'order';
      translation: string;
      tokens: string[];
    })
  | (PracticeBase & {
      kind: 'correct';
      sentence: string;
      translation: string;
      hint: string;
    })
  | (PracticeBase & {
      kind: 'create';
      prompt: string;
      requirement: string;
      sentenceCount: 3;
    });

export type GrammarPracticeView = {
  id: string;
  grammarId: string;
  grammarForm: string;
  variant: number;
  step: number;
  total: 5;
  mistakes: number;
  status: 'active' | 'completed';
  exercise: GrammarPracticeExercise | null;
  accuracy?: number;
  modelSentences?: string[];
  completedAt?: string | null;
};

export type GrammarPracticeReply = {
  correct: boolean;
  advanced: boolean;
  feedback: string;
  expected?: string;
  sentenceChecks?: { correct: boolean; feedback: string }[];
  session: GrammarPracticeView;
};
