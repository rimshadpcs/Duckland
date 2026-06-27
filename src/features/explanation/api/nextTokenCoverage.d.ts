export function isNextTokenPredictionSource(sourceMaterial: string, selectedConcept?: string): boolean;

export function evaluateNextTokenPredictionCoverage(
  sourceMaterial: string,
  explanation: string,
  selectedConcept?: string,
): null | {
  status: "gap_found" | "improving" | "clear" | "topic_mismatch";
  clarityScore: number | null;
  coreClaims: string[];
  coveredClaims: string[];
  missingClaims: string[];
  mainGap: string | null;
  socraticQuestion: string | null;
  scoreReason: string;
};
