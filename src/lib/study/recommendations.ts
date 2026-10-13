export const conceptStatuses = [
  "not_started",
  "explaining",
  "gap_found",
  "improving",
  "clear",
  "needs_recall",
  "due_for_review",
] as const;

export type ConceptLearningStatus = (typeof conceptStatuses)[number];
export type StoredConceptStatus = ConceptLearningStatus | "in_progress";

export type StudyPlanActionType =
  | "Re-explain"
  | "Recall from memory"
  | "Practise weak area"
  | "Continue concept"
  | "Start next concept";

export type StudyPlanConcept = {
  id: string;
  roomId: string;
  roomTitle: string;
  title: string;
  status: StoredConceptStatus;
  sortOrder: number;
  mainUnresolvedGap?: string | null;
  mainGap?: string | null;
  nextReviewAt?: string | null;
  lastActivityAt?: string | null;
};

export type StudyPlanItem = {
  id: string;
  actionType: StudyPlanActionType;
  conceptId: string;
  conceptTitle: string;
  roomId: string;
  roomTitle: string;
  reason: string;
  href: string;
  priority: number;
};

const recallIntervalsInDays = [1, 3, 7] as const;

function asTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getNextRecallDate(reviewCount: number, from: Date = new Date()) {
  const interval = recallIntervalsInDays[Math.min(Math.max(reviewCount, 0), recallIntervalsInDays.length - 1)];
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + interval);
  return next;
}

export function getEffectiveConceptStatus(
  status: StoredConceptStatus,
  nextReviewAt?: string | null,
  now: Date = new Date(),
): ConceptLearningStatus {
  if ((status === "clear" || status === "needs_recall" || status === "due_for_review") && nextReviewAt) {
    return asTime(nextReviewAt) <= now.getTime() ? "due_for_review" : "needs_recall";
  }
  if (status === "in_progress") return "explaining";
  return status;
}

export function getConceptStatusLabel(status: StoredConceptStatus, nextReviewAt?: string | null, now = new Date()) {
  const effective = getEffectiveConceptStatus(status, nextReviewAt, now);
  if (effective === "due_for_review") return "Due for recall";
  if (effective === "needs_recall") return "Recall scheduled";
  if (effective === "explaining") return "Explaining";
  if (effective === "gap_found") return "Gap found";
  if (effective === "improving") return "Improving";
  if (effective === "clear") return "Clear";
  return "Not started";
}

function toPlanItem(concept: StudyPlanConcept, now: Date): StudyPlanItem | null {
  const effectiveStatus = getEffectiveConceptStatus(concept.status, concept.nextReviewAt, now);
  const weakLink = concept.mainUnresolvedGap || concept.mainGap;
  const baseHref = `/study/session?roomId=${encodeURIComponent(concept.roomId)}&conceptId=${encodeURIComponent(concept.id)}`;

  if (effectiveStatus === "due_for_review") {
    return {
      id: `recall-${concept.id}`,
      actionType: "Recall from memory",
      conceptId: concept.id,
      conceptTitle: concept.title,
      roomId: concept.roomId,
      roomTitle: concept.roomTitle,
      reason: "Due today after your previous clear explanation.",
      href: `${baseHref}&mode=recall`,
      priority: 0,
    };
  }

  if (effectiveStatus === "gap_found" || weakLink) {
    return {
      id: `gap-${concept.id}`,
      actionType: effectiveStatus === "gap_found" ? "Re-explain" : "Practise weak area",
      conceptId: concept.id,
      conceptTitle: concept.title,
      roomId: concept.roomId,
      roomTitle: concept.roomTitle,
      reason: weakLink ? `Last weak link: ${weakLink}` : "An unresolved gap remains from your last session.",
      href: baseHref,
      priority: 1,
    };
  }

  if (effectiveStatus === "improving") {
    return {
      id: `improving-${concept.id}`,
      actionType: "Practise weak area",
      conceptId: concept.id,
      conceptTitle: concept.title,
      roomId: concept.roomId,
      roomTitle: concept.roomTitle,
      reason: "You improved this concept, but it still needs work.",
      href: baseHref,
      priority: 2,
    };
  }

  if (effectiveStatus === "explaining") {
    return {
      id: `continue-${concept.id}`,
      actionType: "Continue concept",
      conceptId: concept.id,
      conceptTitle: concept.title,
      roomId: concept.roomId,
      roomTitle: concept.roomTitle,
      reason: "Continue the explanation you already started.",
      href: baseHref,
      priority: 3,
    };
  }

  if (effectiveStatus === "not_started") {
    return {
      id: `start-${concept.id}`,
      actionType: "Start next concept",
      conceptId: concept.id,
      conceptTitle: concept.title,
      roomId: concept.roomId,
      roomTitle: concept.roomTitle,
      reason: "Next untouched concept in your learning path.",
      href: baseHref,
      priority: 4,
    };
  }

  return null;
}

export function buildTodayStudyPlan(concepts: StudyPlanConcept[], now = new Date(), limit = 4) {
  return concepts
    .map((concept) => ({ concept, item: toPlanItem(concept, now) }))
    .filter((entry): entry is { concept: StudyPlanConcept; item: StudyPlanItem } => Boolean(entry.item))
    .sort((first, second) => (
      first.item.priority - second.item.priority ||
      asTime(second.concept.lastActivityAt) - asTime(first.concept.lastActivityAt) ||
      first.concept.sortOrder - second.concept.sortOrder
    ))
    .slice(0, limit)
    .map(({ item }) => item);
}

