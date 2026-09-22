export type SolutionContent = {
  reason: string;
  evidence: string;
  elimination: string;
  tip: string;
};
export type SolutionView = {
  questionId: string;
  content: SolutionContent;
  revision: number;
  updatedAt: string;
  savedNoteId: string | null;
};
