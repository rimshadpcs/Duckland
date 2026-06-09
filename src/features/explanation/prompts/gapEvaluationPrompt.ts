export const gapEvaluationPrompt = `
Evaluate the student's explanation against their notes.
Return only structured JSON with a clarity score, the main reasoning gap,
why the gap matters, one Socratic follow-up question, and a re-explanation prompt.
`;
