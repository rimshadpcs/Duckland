import type { GapAnalysisResult } from "@src/features/gap-analysis";

export type ExplanationRequest = {
  notes: string;
  explanation: string;
  selectedConcept?: string;
  previousExplanations?: string[];
  previousMainGaps?: string[];
  previousSocraticQuestions?: string[];
  resolvedGaps?: string[];
};

export type ExplanationResult = GapAnalysisResult;

export type StudyRoom = {
  id: string;
  title: string;
  subject: string;
  notes: string;
  createdAt: number;
  lastStudiedAt?: number;
  clarityScore?: number | null;
  weakSpotsCount?: number;
};
