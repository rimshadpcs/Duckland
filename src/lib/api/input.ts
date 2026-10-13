// Size caps for text the AI routes accept. A room's combined active material is capped at the same size.
export const MAX_SOURCE_CHARS = 120_000;
export const MAX_EXPLANATION_CHARS = 10_000;
const MAX_HISTORY_ITEMS = 5;
const MAX_HISTORY_ITEM_CHARS = 4_000;

export const SOURCE_TOO_LARGE_MESSAGE =
  "This room has too much active material to use at once.\n\nExclude a source, split the material into another room, or add a smaller section.";

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

/** The most recent strings from a client-sent list, each trimmed to a sensible length. */
export function recentStrings(value: unknown, maxItems = MAX_HISTORY_ITEMS) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(-maxItems)
    .map((item) => item.trim().slice(0, MAX_HISTORY_ITEM_CHARS));
}

/** Only the parts of the latest evaluation that quiz and flashcard generation use. */
export function summariseEvaluation(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  return {
    status: cleanText(record.status, 40) || null,
    clarityScore: typeof record.clarityScore === "number" ? record.clarityScore : null,
    mainGap: cleanText(record.mainGap, 600) || null,
    missingClaims: recentStrings(record.missingClaims, 8),
    resolvedGaps: recentStrings(record.resolvedGaps, 8),
  };
}
