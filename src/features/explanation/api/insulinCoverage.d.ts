export function isInsulinResistanceSource(notes: string, selectedConcept?: string): boolean;

export function evaluateInsulinResistanceCoverage(
  notes: string,
  explanation: string,
): {
  status: "gap_found" | "clear";
  clarityScore: number;
  scoreReason: string;
  coveredClaims: string[];
  missingClaims: string[];
  mainGap: string | null;
  socraticQuestion: string | null;
  resolvedGaps: string[];
};
