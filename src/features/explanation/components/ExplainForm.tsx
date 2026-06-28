"use client";

import { useState, KeyboardEvent, ChangeEvent, useRef, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { GapResultPanel } from "@src/features/gap-analysis";
import { CheckCircle2, Loader2, MessageSquareText, Mic, PanelLeftClose, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import {
  clearRoomSessionStateAction,
  deleteRoomSourceAction,
  renameRoomSourceAction,
  saveRoomPdfSourceAction,
  saveRoomSessionStateAction,
  saveRoomSourceAction,
  startRoomConceptAction,
  toggleRoomSourceActiveAction,
  updateRoomConceptProgressAction,
  updateRoomSelectedConceptAction,
} from "@src/app/study/actions";
import { cn } from "@src/lib/utils";
import { createSupabaseBrowserClient } from "@src/lib/supabase/browser";
import { clampPanelWidth, getPanelWidth, savePanelWidth } from "@src/lib/storage/panelStorage";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import type { AsyncActionState } from "@src/lib/ui/asyncState";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { RoomConceptRow } from "@src/lib/repositories/study-path";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { Json } from "@src/types/database";
import type { ExplanationRequest, ExplanationResult } from "../types";

const initialRequest: ExplanationRequest = {
  notes: "",
  explanation: "",
};

const PDF_MAX_BYTES = 10 * 1024 * 1024;
const PDF_UNREADABLE_MESSAGE = "We couldn't read this PDF. Try a different file or paste the text instead.";

const conceptQuestionMessage: ConversationMessage = {
  id: "concept-selection-question",
  role: "assistant",
  kind: "feedback",
  content: "What concept from this material do you want to understand?",
};

type ExplainApiResponse = ExplanationResult & {
  mockMode?: boolean;
  warning?: string;
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "feedback" | "question" | "error" | "loading";
};

type ConceptStatus = "not_started" | "in_progress" | "gap_found" | "improving" | "clear";
type PostClearIntent = "follow_up_question" | "next_recommendation" | "fresh_recall" | "unknown";
type PostClearMode = "follow_up" | "fresh_recall" | null;

type ConceptTrackSnapshot = {
  result: ExplanationResult | null;
  history: ConversationMessage[];
  previousExplanations: string[];
  previousMainGaps: string[];
  previousSocraticQuestions: string[];
  resolvedGaps: string[];
  studyTools?: Json | null;
};

type RoomConceptTrack = {
  id: string;
  roomId: string | null;
  title: string;
  status: ConceptStatus;
  latestClarityScore: number | null;
  bestClarityScore?: number | null;
  latestReviewScore?: number | null;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  snapshot: ConceptTrackSnapshot;
};

type FollowUpAnswerState = {
  question: string;
  answer: string;
  thinking: string;
} | null;

type NextRecommendationState = {
  concept: RoomConceptTrack | null;
  reason: string;
  allClear: boolean;
} | null;

type SourceMenuAction = {
  label: string;
  destructive?: boolean;
  onSelect: () => void;
};

type SourceMenuPosition = {
  top: number;
  left: number;
  transformOrigin: string;
};

const nextStudyPatterns = [
  /what should i learn next/i,
  /what do i study next/i,
  /what concept should i (learn|study|do) next/i,
  /what should i focus on/i,
  /what topic comes next/i,
  /recommend.*next/i,
];

function getSourceMenuPosition(trigger: HTMLElement): SourceMenuPosition | null {
  const rect = trigger.getBoundingClientRect();
  const viewportPadding = 8;
  const menuWidth = 210;
  const estimatedMenuHeight = 180;
  const gap = 8;
  const belowTop = rect.bottom + gap;
  const aboveTop = rect.top - estimatedMenuHeight - gap;
  const hasRoomBelow = belowTop + estimatedMenuHeight <= window.innerHeight - viewportPadding;
  const top = hasRoomBelow ? belowTop : Math.max(viewportPadding, aboveTop);
  const preferredLeft = rect.right - menuWidth;
  const left = Math.min(
    window.innerWidth - menuWidth - viewportPadding,
    Math.max(viewportPadding, preferredLeft),
  );

  return {
    top,
    left,
    transformOrigin: hasRoomBelow ? "top right" : "bottom right",
  };
}

function SourceActionMenuPortal({
  triggerElement,
  actions,
  onClose,
}: {
  triggerElement: HTMLButtonElement | null;
  actions: SourceMenuAction[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [position, setPosition] = useState<SourceMenuPosition | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const trigger = triggerElement;
      if (!trigger) {
        onClose();
        return;
      }

      const rect = trigger.getBoundingClientRect();
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        onClose();
        return;
      }

      setPosition(getSourceMenuPosition(trigger));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [onClose, triggerElement]);

  useEffect(() => {
    itemRefs.current[0]?.focus();

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || triggerElement?.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose, triggerElement]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      triggerElement?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % actions.length;
      itemRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = currentIndex <= 0 ? actions.length - 1 : currentIndex - 1;
      itemRefs.current[nextIndex]?.focus();
      return;
    }
  };

  if (!position || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className="source-menu-portal"
      role="menu"
      style={{
        top: position.top,
        left: position.left,
        transformOrigin: position.transformOrigin,
      }}
      onKeyDown={handleKeyDown}
    >
      {actions.map((action, index) => (
        <button
          key={action.label}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          type="button"
          role="menuitem"
          className={cn(action.destructive && "destructive")}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

type PersistedSessionSnapshot = {
  selectedConcept: string | null;
  result: ExplanationResult | null;
  history: ConversationMessage[];
  previousExplanations: string[];
  previousMainGaps: string[];
  previousSocraticQuestions: string[];
  resolvedGaps: string[];
  studyTools?: Json | null;
  conceptTracks?: Record<string, RoomConceptTrack>;
  sourceUpdatedAt?: string | null;
};

function getSessionStorageKey(roomId: string | null) {
  return `feynduck-session-${roomId || "quick"}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizePdfFileName(name: string) {
  const baseName = name.replace(/\.pdf$/i, "").trim() || "study-material";
  return `${baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "study-material"}.pdf`;
}

function getSourceDisplayTitle(source: SourceRow) {
  return source.title?.trim() || source.original_file_name?.trim() || (source.source_type === "pdf" ? "PDF source" : "Pasted notes");
}

function getSourceCharacterCount(source: SourceRow) {
  return source.extracted_text_length || source.content.trim().length;
}

function combineSourceContent(sources: SourceRow[]) {
  return sources
    .filter((source) => source.is_active)
    .map((source) => `===== Source: ${getSourceDisplayTitle(source)} =====\n${source.content.trim()}`)
    .join("\n\n");
}

function formatSourceMeta(source: SourceRow) {
  const characters = `${getSourceCharacterCount(source).toLocaleString()} characters`;
  if (source.source_type === "pdf") {
    return ["PDF", source.page_count ? `${source.page_count} pages` : null, characters].filter(Boolean).join(" · ");
  }
  return `Pasted text · ${characters}`;
}

function getSourcePreviewSections(source: SourceRow) {
  const content = source.content.trim();
  if (!content) return [];

  const pageSections = content.split(/--- Page (\d+) ---/g);
  if (pageSections.length > 1) {
    const sections: Array<{ title: string; body: string }> = [];
    for (let index = 1; index < pageSections.length; index += 2) {
      const pageNumber = pageSections[index];
      const body = (pageSections[index + 1] || "").trim();
      if (body) sections.push({ title: `Page ${pageNumber}`, body });
    }
    return sections;
  }

  return content
    .split(/\n{2,}/)
    .map((body, index) => ({ title: index === 0 ? "Preview" : `Section ${index + 1}`, body: body.trim() }))
    .filter((section) => section.body);
}

function getConceptTrackIndexKey(roomId: string | null) {
  return `feynduck-concepts-${roomId || "quick"}`;
}

function getConceptTrackStorageKey(roomId: string | null, conceptId: string) {
  return `feynduck-concept-${roomId || "quick"}-${conceptId}`;
}

function readPersistedConceptTracks(roomId: string | null): Record<string, RoomConceptTrack> {
  try {
    const rawIndex = window.localStorage.getItem(getConceptTrackIndexKey(roomId));
    const conceptIds = rawIndex ? JSON.parse(rawIndex) : [];
    if (!Array.isArray(conceptIds)) return {};

    const tracks: Record<string, RoomConceptTrack> = {};
    for (const conceptId of conceptIds) {
      if (typeof conceptId !== "string") continue;
      const rawTrack = window.localStorage.getItem(getConceptTrackStorageKey(roomId, conceptId));
      if (!rawTrack) continue;
      Object.assign(tracks, parseConceptTracks({ [conceptId]: JSON.parse(rawTrack) }));
    }

    return tracks;
  } catch {
    return {};
  }
}

function savePersistedConceptTracks(roomId: string | null, tracks: Record<string, RoomConceptTrack>) {
  const indexKey = getConceptTrackIndexKey(roomId);
  let previousIds: string[] = [];

  try {
    const rawIndex = window.localStorage.getItem(indexKey);
    const parsedIndex = rawIndex ? JSON.parse(rawIndex) : [];
    previousIds = Array.isArray(parsedIndex)
      ? parsedIndex.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    previousIds = [];
  }

  const nextIds = Object.keys(tracks);
  const staleIds = previousIds.filter((conceptId) => !nextIds.includes(conceptId));
  staleIds.forEach((conceptId) => {
    window.localStorage.removeItem(getConceptTrackStorageKey(roomId, conceptId));
  });

  nextIds.forEach((conceptId) => {
    window.localStorage.setItem(getConceptTrackStorageKey(roomId, conceptId), JSON.stringify(tracks[conceptId]));
  });
  window.localStorage.setItem(indexKey, JSON.stringify(nextIds));
}

function clearPersistedConceptTracks(roomId: string | null) {
  try {
    const indexKey = getConceptTrackIndexKey(roomId);
    const rawIndex = window.localStorage.getItem(indexKey);
    const conceptIds = rawIndex ? JSON.parse(rawIndex) : [];
    if (Array.isArray(conceptIds)) {
      conceptIds.forEach((conceptId) => {
        if (typeof conceptId === "string") {
          window.localStorage.removeItem(getConceptTrackStorageKey(roomId, conceptId));
        }
      });
    }
    window.localStorage.removeItem(indexKey);
  } catch {
    window.localStorage.removeItem(getConceptTrackIndexKey(roomId));
  }
}

function readPersistedSession(key: string, roomId: string | null): PersistedSessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSessionSnapshot>;
    const sessionConceptTracks = parseConceptTracks(parsed.conceptTracks);
    const scopedConceptTracks = readPersistedConceptTracks(roomId);

    return {
      selectedConcept: typeof parsed.selectedConcept === "string" ? parsed.selectedConcept : null,
      result: parsed.result && typeof parsed.result === "object" ? parsed.result as ExplanationResult : null,
      history: Array.isArray(parsed.history)
        ? parsed.history.filter((message): message is ConversationMessage => (
            message &&
            typeof message === "object" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            typeof message.id === "string"
          ))
        : [],
      previousExplanations: Array.isArray(parsed.previousExplanations)
        ? parsed.previousExplanations.filter((value): value is string => typeof value === "string")
        : [],
      previousMainGaps: Array.isArray(parsed.previousMainGaps)
        ? parsed.previousMainGaps.filter((value): value is string => typeof value === "string")
        : [],
      previousSocraticQuestions: Array.isArray(parsed.previousSocraticQuestions)
        ? parsed.previousSocraticQuestions.filter((value): value is string => typeof value === "string")
        : [],
      resolvedGaps: Array.isArray(parsed.resolvedGaps)
        ? parsed.resolvedGaps.filter((value): value is string => typeof value === "string")
        : [],
      studyTools: parsed.studyTools as Json | null | undefined,
      conceptTracks: {
        ...sessionConceptTracks,
        ...scopedConceptTracks,
      },
      sourceUpdatedAt: typeof parsed.sourceUpdatedAt === "string" ? parsed.sourceUpdatedAt : null,
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function parsePersistedSession(value: unknown): PersistedSessionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<PersistedSessionSnapshot>;

  return {
    selectedConcept: typeof parsed.selectedConcept === "string" ? parsed.selectedConcept : null,
    result: parsed.result && typeof parsed.result === "object" ? parsed.result as ExplanationResult : null,
    history: Array.isArray(parsed.history)
      ? parsed.history.filter((message): message is ConversationMessage => (
          message &&
          typeof message === "object" &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          typeof message.id === "string"
        ))
      : [],
    previousExplanations: Array.isArray(parsed.previousExplanations)
      ? parsed.previousExplanations.filter((item): item is string => typeof item === "string")
      : [],
    previousMainGaps: Array.isArray(parsed.previousMainGaps)
      ? parsed.previousMainGaps.filter((item): item is string => typeof item === "string")
      : [],
    previousSocraticQuestions: Array.isArray(parsed.previousSocraticQuestions)
      ? parsed.previousSocraticQuestions.filter((item): item is string => typeof item === "string")
      : [],
    resolvedGaps: Array.isArray(parsed.resolvedGaps)
      ? parsed.resolvedGaps.filter((item): item is string => typeof item === "string")
      : [],
    studyTools: parsed.studyTools as Json | null | undefined,
    conceptTracks: parseConceptTracks(parsed.conceptTracks),
    sourceUpdatedAt: typeof parsed.sourceUpdatedAt === "string" ? parsed.sourceUpdatedAt : null,
  };
}

function parseConceptTracks(value: unknown): Record<string, RoomConceptTrack> {
  if (!value || typeof value !== "object") return {};

  const tracks: Record<string, RoomConceptTrack> = {};
  for (const [id, rawTrack] of Object.entries(value as Record<string, unknown>)) {
    if (!rawTrack || typeof rawTrack !== "object") continue;
    const track = rawTrack as Partial<RoomConceptTrack>;
    if (typeof track.title !== "string" || !track.title.trim()) continue;

    const status: ConceptStatus =
      track.status === "clear" ||
      track.status === "gap_found" ||
      track.status === "improving" ||
      track.status === "in_progress" ||
      track.status === "not_started"
        ? track.status
        : "not_started";
    const snapshot = track.snapshot && typeof track.snapshot === "object"
      ? track.snapshot as Partial<ConceptTrackSnapshot>
      : {};

    tracks[id] = {
      id,
      roomId: typeof track.roomId === "string" ? track.roomId : null,
      title: track.title,
      status,
      latestClarityScore: typeof track.latestClarityScore === "number" ? track.latestClarityScore : null,
      startedAt: typeof track.startedAt === "string" ? track.startedAt : null,
      completedAt: typeof track.completedAt === "string" ? track.completedAt : null,
      lastActivityAt: typeof track.lastActivityAt === "string" ? track.lastActivityAt : null,
      snapshot: {
        result: snapshot.result && typeof snapshot.result === "object" ? snapshot.result as ExplanationResult : null,
        history: Array.isArray(snapshot.history)
          ? snapshot.history.filter((message): message is ConversationMessage => (
              message &&
              typeof message === "object" &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string" &&
              typeof message.id === "string"
            ))
          : [],
        previousExplanations: Array.isArray(snapshot.previousExplanations)
          ? snapshot.previousExplanations.filter((item): item is string => typeof item === "string")
          : [],
        previousMainGaps: Array.isArray(snapshot.previousMainGaps)
          ? snapshot.previousMainGaps.filter((item): item is string => typeof item === "string")
          : [],
        previousSocraticQuestions: Array.isArray(snapshot.previousSocraticQuestions)
          ? snapshot.previousSocraticQuestions.filter((item): item is string => typeof item === "string")
          : [],
        resolvedGaps: Array.isArray(snapshot.resolvedGaps)
          ? snapshot.resolvedGaps.filter((item): item is string => typeof item === "string")
          : [],
        studyTools: snapshot.studyTools as Json | null | undefined,
      },
    };
  }

  return tracks;
}

function savePersistedSession(key: string, snapshot: PersistedSessionSnapshot, roomId: string | null) {
  const localSnapshot: PersistedSessionSnapshot = {
    ...snapshot,
    conceptTracks: undefined,
  };

  window.localStorage.setItem(key, JSON.stringify(localSnapshot));
  savePersistedConceptTracks(roomId, snapshot.conceptTracks || {});
}

function clearPersistedSession(key: string, roomId: string | null) {
  window.localStorage.removeItem(key);
  clearPersistedConceptTracks(roomId);
}

function getConceptId(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "concept";
}

function classifyPostClearIntent(value: string, mode: PostClearMode): PostClearIntent {
  const text = value.trim();
  if (!text) return "unknown";
  if (mode === "fresh_recall") return "fresh_recall";
  if (nextStudyPatterns.some((pattern) => pattern.test(text))) return "next_recommendation";
  return "follow_up_question";
}

function getConceptTime(value: string | null) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function getRecommendedNextConcept(concepts: RoomConceptTrack[], selectedConcept: string | null): NextRecommendationState {
  const byRecent = (items: RoomConceptTrack[]) =>
    [...items].sort((a, b) => getConceptTime(b.lastActivityAt) - getConceptTime(a.lastActivityAt));

  const gap = byRecent(concepts.filter((concept) => concept.status === "gap_found"))[0];
  if (gap) {
    return {
      concept: gap,
      allClear: false,
      reason: "It has the most recent unresolved gap, so repairing it gives you the fastest progress.",
    };
  }

  const improving = byRecent(concepts.filter((concept) => concept.status === "improving"))[0];
  if (improving) {
    return {
      concept: improving,
      allClear: false,
      reason: "You are close on this one, so it is a good next target.",
    };
  }

  const notStarted = concepts.find((concept) => concept.status === "not_started");
  if (notStarted) {
    return {
      concept: notStarted,
      allClear: false,
      reason: selectedConcept
        ? `It builds on your current progress after ${selectedConcept}.`
        : "It is the next untouched concept in this room's learning path.",
    };
  }

  const inProgress = byRecent(concepts.filter((concept) => concept.status === "in_progress"))[0];
  if (inProgress) {
    return {
      concept: inProgress,
      allClear: false,
      reason: "You started this concept already, so finishing it is the cleanest next step.",
    };
  }

  return {
    concept: null,
    allClear: true,
    reason: "You've explained every concept in this room clearly.",
  };
}

function getConceptStatus(result: ExplanationResult | null, hasHistory: boolean): ConceptStatus {
  if (result?.status === "clear" && !(result.missingClaims?.length)) return "clear";
  if (result && result.status !== "topic_mismatch") {
    if (typeof result.clarityScore === "number" && result.clarityScore >= 60) return "improving";
    return "gap_found";
  }
  if (hasHistory) return "in_progress";
  return "not_started";
}

function createEmptyConceptSnapshot(title: string): ConceptTrackSnapshot {
  const selectionId = createMessageId("concept");

  return {
    result: null,
    history: [
      {
        ...conceptQuestionMessage,
      },
      {
        id: `${selectionId}-assistant`,
        role: "assistant",
        kind: "feedback",
        content: `Great — explain ${title} in your own words.`,
      },
    ],
    previousExplanations: [],
    previousMainGaps: [],
    previousSocraticQuestions: [],
    resolvedGaps: [],
    studyTools: null,
  };
}

function createMessageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readResultField(result: ExplanationResult, fieldNames: string[]) {
  const resultRecord = result as unknown as Record<string, unknown>;

  for (const fieldName of fieldNames) {
    const value = resultRecord[fieldName];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function mentionsCardiacFormulaGap(value: string) {
  return (
    /cardiac output/i.test(value) &&
    /heart rate/i.test(value) &&
    /stroke volume/i.test(value)
  );
}

function getAssistantFeedback(result: ExplanationResult) {
  if (result.status === "clear" && !(result.missingClaims?.length)) {
    return (
      result.chatMessage ||
      "You've now explained the central mechanism clearly. That explanation is clear."
    );
  }

  if (result.status === "topic_mismatch") {
    return readResultField(result, ["chatMessage", "gapSummary", "mainGap"]);
  }

  const gapSummary = readResultField(result, ["gapSummary", "mainGap", "gap", "feedback"]);
  const evaluationContext = [
    gapSummary,
    readResultField(result, ["socraticQuestion", "question", "followUpQuestion", "targetedQuestion"]),
    readResultField(result, ["whyItMatters"]),
    readResultField(result, ["suggestedReExplanationPrompt", "tryAgain"]),
  ].join(" ");

  if (mentionsCardiacFormulaGap(evaluationContext)) {
    return "You identified the compensation, but you did not connect cardiac output to the formula: heart rate × stroke volume.";
  }

  return (
    gapSummary ||
    readResultField(result, ["chatMessage"]) ||
    "You are close, but there is still one missing reasoning step."
  );
}

function getAssistantQuestion(result: ExplanationResult) {
  if (result.status === "clear" && !(result.missingClaims?.length)) {
    return "";
  }

  const question = readResultField(result, [
    "socraticQuestion",
    "question",
    "followUpQuestion",
    "targetedQuestion",
  ]);

  if (
    mentionsCardiacFormulaGap(
      [
        question,
        readResultField(result, ["gapSummary", "mainGap"]),
        readResultField(result, ["whyItMatters"]),
        readResultField(result, ["suggestedReExplanationPrompt", "tryAgain"]),
      ].join(" "),
    )
  ) {
    return "If stroke volume falls, what must happen to heart rate for cardiac output to remain stable?";
  }

  return question;
}

function getAssistantMessages(result: ExplanationResult, submissionId: string): ConversationMessage[] {
  const feedback = getAssistantFeedback(result);
  const question = getAssistantQuestion(result);

  return [
    feedback && {
      id: `${submissionId}-duck-feedback`,
      role: "assistant" as const,
      kind: "feedback" as const,
      content: feedback,
    },
    question && {
      id: `${submissionId}-duck-question`,
      role: "assistant" as const,
      kind: "question" as const,
      content: question,
    },
  ].filter(Boolean) as ConversationMessage[];
}

function getRenderableMessages(
  history: ConversationMessage[],
  result: ExplanationResult | null,
  isLoading: boolean,
  hasNotes: boolean,
  selectedConcept: string | null,
) {
  const messages = history.filter(message => message.kind === "loading" || message.content.trim());

  if (hasNotes && !selectedConcept && messages.length === 0) {
    return [conceptQuestionMessage];
  }

  if (!result || isLoading) {
    return messages;
  }

  const hasFeedback = messages.some(
    message => message.role === "assistant" && message.kind === "feedback" && message.content.trim(),
  );
  const hasQuestion = messages.some(
    message => message.role === "assistant" && message.kind === "question" && message.content.trim(),
  );

  if (hasFeedback && hasQuestion) {
    return messages;
  }

  const fallbackMessages = getAssistantMessages(result, "result-fallback");

  return [
    ...messages.filter(message => message.kind !== "loading"),
    ...fallbackMessages.filter(message => {
      if (message.kind === "feedback") return !hasFeedback;
      if (message.kind === "question") return !hasQuestion;
      return false;
    }),
  ];
}

export function ExplainForm({
  onRoomLoaded,
  initialRoom,
  initialSources = [],
  initialSessionState,
  initialConcept,
  initialRoomConcepts = [],
  requestedRoomId,
}: {
  onRoomLoaded?: (title: string, subject: string) => void;
  initialRoom?: StudyRoomRow | null;
  initialSources?: SourceRow[];
  initialSessionState?: Json | null;
  initialConcept?: RoomConceptRow | null;
  initialRoomConcepts?: RoomConceptRow[];
  requestedRoomId?: string | null;
}) {
  const [roomId] = useState<string | null>(initialRoom?.id || null);
  const [room, setRoom] = useState<StudyRoomRow | null>(initialRoom || null);
  const [sources, setSources] = useState<SourceRow[]>(initialSources);
  const [openSourceId, setOpenSourceId] = useState<string | null>(initialSources.find((item) => item.is_active)?.id || initialSources[0]?.id || null);
  const [roomStatus] = useState<"found" | "not_found" | "quick">(
    initialRoom ? "found" : requestedRoomId ? "not_found" : "quick",
  );
  const sessionStorageKey = getSessionStorageKey(initialRoom?.id || null);
  const [request, setRequest] = useState<ExplanationRequest>(initialRequest);
  const [savedSourceMaterial, setSavedSourceMaterial] = useState("");
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isSupportPanelOpen, setIsSupportPanelOpen] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [sourceInputMode, setSourceInputMode] = useState<"paste" | "pdf" | null>(null);
  const [pasteTitle, setPasteTitle] = useState("");
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [sourceActionError, setSourceActionError] = useState<string | null>(null);
  const [sourceActionState, setSourceActionState] = useState<AsyncActionState<{ sourceId?: string }>>({ status: "idle" });
  const [pendingSourceIds, setPendingSourceIds] = useState<string[]>([]);
  const [pathUpdateNotice, setPathUpdateNotice] = useState<string | null>(null);
  const [isSourcePreviewExpanded, setIsSourcePreviewExpanded] = useState(false);
  const [openSourceMenuId, setOpenSourceMenuId] = useState<string | null>(null);
  const [renamingSourceId, setRenamingSourceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteSourceId, setPendingDeleteSourceId] = useState<string | null>(null);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ currentPage: number; totalPages: number } | null>(null);
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [previousExplanations, setPreviousExplanations] = useState<string[]>([]);
  const [previousMainGaps, setPreviousMainGaps] = useState<string[]>([]);
  const [previousSocraticQuestions, setPreviousSocraticQuestions] = useState<string[]>([]);
  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [serverConcepts, setServerConcepts] = useState<RoomConceptRow[]>(initialRoomConcepts);
  const [activeServerConceptId, setActiveServerConceptId] = useState<string | null>(initialConcept?.id || null);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [studyToolsState, setStudyToolsState] = useState<Json | null>(null);
  const [conceptTracks, setConceptTracks] = useState<Record<string, RoomConceptTrack>>({});
  const [isChoosingNextConcept, setIsChoosingNextConcept] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [postClearMode, setPostClearMode] = useState<PostClearMode>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState<FollowUpAnswerState>(null);
  const [isAnsweringFollowUp, setIsAnsweringFollowUp] = useState(false);
  const [nextRecommendation, setNextRecommendation] = useState<NextRecommendationState>(null);
  const [freshRecallBaseline, setFreshRecallBaseline] = useState<{ concept: string; score: number | null; attempt: string } | null>(null);
  const [showPreviousAttempt, setShowPreviousAttempt] = useState(false);
  const [isConceptSwitchPending, startConceptTransition] = useTransition();
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildCurrentConceptTrack = (
    concept: string,
    overrides: Partial<RoomConceptTrack> = {},
  ): RoomConceptTrack => {
    const id = getConceptId(concept);
    const existing = conceptTracks[id];
    const now = new Date().toISOString();
    const cleanHistory = history.filter((message) => message.kind !== "loading");
    const status = overrides.status || getConceptStatus(result, cleanHistory.length > 0);

    return {
      id,
      roomId,
      title: concept,
      status,
        latestClarityScore: typeof result?.clarityScore === "number" ? result.clarityScore : existing?.latestClarityScore ?? null,
        bestClarityScore:
          typeof result?.clarityScore === "number"
            ? Math.max(existing?.bestClarityScore ?? existing?.latestClarityScore ?? 0, result.clarityScore)
            : existing?.bestClarityScore ?? existing?.latestClarityScore ?? null,
        latestReviewScore:
          postClearMode === "fresh_recall" && typeof result?.clarityScore === "number"
            ? result.clarityScore
            : existing?.latestReviewScore ?? null,
      startedAt: existing?.startedAt || now,
      completedAt: status === "clear" ? existing?.completedAt || now : existing?.completedAt || null,
      lastActivityAt: now,
      snapshot: {
        result,
        history: cleanHistory,
        previousExplanations,
        previousMainGaps,
        previousSocraticQuestions,
        resolvedGaps,
        studyTools: studyToolsState,
      },
      ...overrides,
    };
  };

  const saveCurrentConceptTrack = () => {
    if (!selectedConcept) return conceptTracks;
    const id = getConceptId(selectedConcept);
    const nextTracks = {
      ...conceptTracks,
      [id]: buildCurrentConceptTrack(selectedConcept),
    };
    setConceptTracks(nextTracks);
    return nextTracks;
  };

  const restoreConceptTrack = (track: RoomConceptTrack) => {
    setSelectedConcept(track.title);
    setResult(track.snapshot.result);
    setHistory(track.snapshot.history);
    setPreviousExplanations(track.snapshot.previousExplanations);
    setPreviousMainGaps(track.snapshot.previousMainGaps);
    setPreviousSocraticQuestions(track.snapshot.previousSocraticQuestions);
    setResolvedGaps(track.snapshot.resolvedGaps);
    setStudyToolsState(track.snapshot.studyTools || null);
    setRequest(prev => ({ ...prev, explanation: "" }));
    setError(null);
    setNotice(null);
    setIsChoosingNextConcept(false);

    if (roomId) void updateRoomSelectedConceptAction(roomId, track.title);
    if (onRoomLoaded) onRoomLoaded(room ? room.title : "Quick explain", track.title);
  };

  const mapLearningPath = async (force = false, sourceOverride?: string) => {
    const material = (sourceOverride || savedSourceMaterial).trim();
    if (!roomId || material.length < 10) return;

    const endTiming = startInteractionTiming("learning-path-generation");
    setConceptsLoading(true);
    setConceptsError(null);
    try {
      const response = await fetch("/api/study-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          force,
        }),
      });

      const payload = (await response.json()) as { concepts?: RoomConceptRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not build learning path.");
      if (Array.isArray(payload.concepts)) {
        setServerConcepts(payload.concepts);
        setPathUpdateNotice(null);
      }
    } catch (caught) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Study] learning path generation failed", caught);
      }
      setServerConcepts([]);
      setConceptsError(caught instanceof Error ? caught.message : "We couldn’t map the concepts in this material yet.");
    } finally {
      setConceptsLoading(false);
      endTiming();
    }
  };

  useEffect(() => {
    const sourceMaterial = combineSourceContent(initialSources);
    const initialConceptTitle = initialConcept?.title || initialRoom?.selected_concept || null;
    setRequest((prev) => ({ ...prev, notes: sourceMaterial }));
    setSavedSourceMaterial(sourceMaterial);
    setSelectedConcept(initialConceptTitle);
    setActiveServerConceptId(initialConcept?.id || null);
    if (initialConceptTitle) {
      setHistory(createEmptyConceptSnapshot(initialConceptTitle).history);
    }
    if (sourceMaterial && !initialRoomConcepts.length) void mapLearningPath(false, sourceMaterial);
    if (onRoomLoaded) {
      onRoomLoaded(initialRoom?.title || "Quick explain", initialConceptTitle || initialRoom?.description || "");
    }
  }, []);

  const resetEvaluationSession = () => {
    clearPersistedSession(sessionStorageKey, roomId);
    if (roomId) void clearRoomSessionStateAction(roomId);
    setSelectedConcept(null);
    setResult(null);
    setError(null);
    setNotice(null);
    setPreviousExplanations([]);
    setPreviousMainGaps([]);
    setPreviousSocraticQuestions([]);
    setResolvedGaps([]);
    setServerConcepts([]);
    setConceptsError(null);
    setConceptsLoading(false);
    setStudyToolsState(null);
    setConceptTracks({});
    setIsChoosingNextConcept(false);
    setHistory([]);
    setRequest(prev => ({ ...prev, explanation: "" }));
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenSourceMenuId(null);
      setPendingDeleteSourceId(null);
      if (!isPdfBusy) {
        setIsAddMaterialOpen(false);
        setSourceInputMode(null);
        setIsEditingNotes(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isPdfBusy]);

  const handleSaveNotes = async () => {
    const sourceMaterial = request.notes.trim();
    if (sourceMaterial.length < 10) {
      setError("Source material must be at least 10 characters.");
      return;
    }

    if (!roomId || !room) {
      setError("Create or open a study room before saving material.");
      return;
    }

    setError(null);
    setNotice(null);
    setSourceActionError(null);
    setSourceActionState({ status: "pending" });
    setIsSavingSource(true);
    setIsEditingNotes(false);

    const endTiming = startInteractionTiming("source-save");
    const result = await saveRoomSourceAction({
      roomId,
      roomTitle: room.title,
      title: pasteTitle,
      content: sourceMaterial,
    });

    if (!result.ok) {
      setError(result.error);
      setSourceActionState({ status: "error", error: result.error });
      setIsEditingNotes(true);
      setIsSavingSource(false);
      endTiming();
      return;
    }

    const savedAt = new Date().toISOString();
    const nextSources = [...sources, result.data.source];
    const nextMaterial = combineSourceContent(nextSources);
    setSources(nextSources);
    setOpenSourceId(result.data.source.id);
    setSavedSourceMaterial(nextMaterial);
    setRoom((current) =>
      current
        ? {
            ...current,
            title: result.data.roomTitle || current.title,
            status: "in_progress",
            last_activity_at: savedAt,
          }
        : current,
    );
    setRequest(prev => ({ ...prev, notes: nextMaterial }));
    setIsSavingSource(false);
    setSourceInputMode(null);
    setIsAddMaterialOpen(false);
    setPasteTitle("");
    setSourceActionState({ status: "success", data: { sourceId: result.data.source.id } });
    window.setTimeout(() => setSourceActionState({ status: "idle" }), 1600);
    if (serverConcepts.length) {
      setPathUpdateNotice(`New material added. Your learning path is based on ${Math.max(1, sources.filter((item) => item.is_active).length)} source${sources.filter((item) => item.is_active).length === 1 ? "" : "s"}. Update it to include ${nextSources.filter((item) => item.is_active).length} sources?`);
    } else {
      void mapLearningPath(false, nextMaterial);
    }
    if (onRoomLoaded) {
      onRoomLoaded(result.data.roomTitle || room.title, room.selected_concept || room.description || "");
    }
    endTiming();
  };

  const handleCancelNotesEdit = () => {
    setRequest(prev => ({ ...prev, notes: savedSourceMaterial }));
    setIsEditingNotes(false);
    setSourceInputMode(null);
    setIsAddMaterialOpen(false);
    setPasteTitle("");
  };

  const resetPdfSelection = () => {
    setSelectedPdfFile(null);
    setPdfError(null);
    setPdfStatus(null);
    setPdfProgress(null);
  };

  const openPasteMode = () => {
    resetPdfSelection();
    setSourceInputMode("paste");
    setIsEditingNotes(true);
    setIsAddMaterialOpen(true);
    setRequest((prev) => ({ ...prev, notes: "" }));
  };

  const openPdfMode = () => {
    setIsEditingNotes(false);
    setSourceInputMode("pdf");
    setIsAddMaterialOpen(true);
    setPdfError(null);
    setPdfStatus(null);
  };

  const openAddMaterialSheet = () => {
    if (isAddMaterialOpen) {
      handleCancelNotesEdit();
      return;
    }

    setSourceActionError(null);
    setPasteTitle("");
    openPasteMode();
  };

  const handlePdfFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedPdfFile(null);
    setPdfError(null);
    setPdfStatus(null);
    setPdfProgress(null);

    if (!file) return;

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setPdfError("Please upload a PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size > PDF_MAX_BYTES) {
      setPdfError("This PDF is larger than 10 MB. Choose a smaller file for now.");
      event.target.value = "";
      return;
    }

    setSelectedPdfFile(file);
  };

  const handleCancelPdfUpload = () => {
    if (isPdfBusy) return;
    resetPdfSelection();
    setSourceInputMode(null);
    setIsAddMaterialOpen(false);
  };

  const handleSavePdfSource = async () => {
    if (isPdfBusy || !selectedPdfFile) return;

    if (!roomId || !room) {
      setPdfError("Create or open a study room before uploading a PDF.");
      return;
    }

    setIsPdfBusy(true);
    setSourceActionState({ status: "pending" });
    setPdfError(null);
    setPdfProgress(null);
    setPdfStatus("Uploading your PDF...");
    const endTiming = startInteractionTiming("pdf-upload-and-extraction");

    const supabase = createSupabaseBrowserClient();
    let uploadedPath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be signed in to upload a PDF.");

      const storagePath = `${user.id}/${roomId}/${Date.now()}-${sanitizePdfFileName(selectedPdfFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("study-files")
        .upload(storagePath, selectedPdfFile, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message || "Could not upload this PDF.");
      uploadedPath = storagePath;

      setPdfStatus("Reading page 1...");
      const { extractPdfText } = await import("@src/lib/pdf/extractPdfText");
      const extraction = await extractPdfText(selectedPdfFile, (currentPage, totalPages) => {
        setPdfProgress({ currentPage, totalPages });
        setPdfStatus(`Reading page ${currentPage} of ${totalPages}...`);
      });

      setPdfStatus(`${extraction.pageCount} pages · ${extraction.extractedTextLength.toLocaleString()} characters extracted`);
      window.setTimeout(() => setPdfStatus("Saving extracted text..."), 80);

      const result = await saveRoomPdfSourceAction({
        roomId,
        roomTitle: room.title,
        title: selectedPdfFile.name,
        content: extraction.text,
        originalFileName: selectedPdfFile.name,
        storagePath,
        pageCount: extraction.pageCount,
        extractedTextLength: extraction.extractedTextLength,
      });

      if (!result.ok) throw new Error(result.error);

      uploadedPath = null;
      const savedAt = new Date().toISOString();
      const nextSources = [...sources, result.data.source];
      const nextMaterial = combineSourceContent(nextSources);
      setSources(nextSources);
      setOpenSourceId(result.data.source.id);
      setSavedSourceMaterial(nextMaterial);
      setRoom((current) =>
        current
          ? {
              ...current,
              title: result.data.roomTitle || current.title,
              status: "in_progress",
              last_activity_at: savedAt,
            }
          : current,
      );
      setRequest(prev => ({ ...prev, notes: nextMaterial }));
      setSelectedPdfFile(null);
      setSourceInputMode(null);
      setIsAddMaterialOpen(false);
      setPdfStatus(serverConcepts.length ? "PDF added · Saved" : "PDF added · Mapping concepts...");
      setSourceActionState({ status: "success", data: { sourceId: result.data.source.id } });
      window.setTimeout(() => setSourceActionState({ status: "idle" }), 1600);
      if (serverConcepts.length) {
        setPathUpdateNotice(`New material added. Your learning path is based on ${Math.max(1, sources.filter((item) => item.is_active).length)} source${sources.filter((item) => item.is_active).length === 1 ? "" : "s"}. Update it to include ${nextSources.filter((item) => item.is_active).length} sources?`);
      } else {
        void mapLearningPath(false, nextMaterial);
      }
      if (onRoomLoaded) {
        onRoomLoaded(result.data.roomTitle || room.title, room.selected_concept || room.description || "");
      }
    } catch (caught) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from("study-files").remove([uploadedPath]);
        if (cleanupError && process.env.NODE_ENV === "development") {
          console.warn("[Study] could not remove failed PDF upload", cleanupError);
        }
      }

      const message = caught instanceof Error ? caught.message : PDF_UNREADABLE_MESSAGE;
      setPdfError(message);
      setSourceActionState({ status: "error", error: message });
      setPdfStatus(null);
    } finally {
      setPdfProgress(null);
      setIsPdfBusy(false);
      endTiming();
    }
  };

  const handleUpdateLearningPath = () => {
    if (!savedSourceMaterial.trim()) {
      setConceptsError("Add material before generating a learning path.");
      return;
    }
    void mapLearningPath(true);
  };

  const handleToggleSourceActive = async (target: SourceRow) => {
    if (!roomId) return;
    setSourceActionError(null);
    setSourceActionState({ status: "pending", data: { sourceId: target.id } });
    setPendingSourceIds((current) => Array.from(new Set([...current, target.id])));
    const previousSources = sources;
    const optimisticSources = sources.map((item) =>
      item.id === target.id ? { ...item, is_active: !target.is_active, updated_at: new Date().toISOString() } : item,
    );
    const optimisticMaterial = combineSourceContent(optimisticSources);
    setSources(optimisticSources);
    setSavedSourceMaterial(optimisticMaterial);
    setRequest((prev) => ({ ...prev, notes: optimisticMaterial }));
    setOpenSourceMenuId(null);
    setPathUpdateNotice("Your study material changed. Update your learning path when you're ready.");

    const endTiming = startInteractionTiming("source-include-toggle");
    const result = await toggleRoomSourceActiveAction(target.id, roomId, !target.is_active);
    if (!result.ok) {
      const previousMaterial = combineSourceContent(previousSources);
      setSources(previousSources);
      setSavedSourceMaterial(previousMaterial);
      setRequest((prev) => ({ ...prev, notes: previousMaterial }));
      setSourceActionError(result.error);
      setSourceActionState({ status: "error", error: result.error, data: { sourceId: target.id } });
      setPendingSourceIds((current) => current.filter((id) => id !== target.id));
      endTiming();
      return;
    }

    const nextSources = optimisticSources.map((item) =>
      item.id === target.id ? { ...item, is_active: result.data.isActive, updated_at: new Date().toISOString() } : item,
    );
    const nextMaterial = combineSourceContent(nextSources);
    setSources(nextSources);
    setSavedSourceMaterial(nextMaterial);
    setRequest((prev) => ({ ...prev, notes: nextMaterial }));
    setPendingSourceIds((current) => current.filter((id) => id !== target.id));
    setSourceActionState({ status: "success", data: { sourceId: target.id } });
    window.setTimeout(() => setSourceActionState({ status: "idle" }), 1400);
    endTiming();
  };

  const handleDeleteSource = async (target: SourceRow) => {
    if (!roomId) return;
    setSourceActionError(null);
    const endTiming = startInteractionTiming("source-delete");
    const result = await deleteRoomSourceAction(target.id, roomId);
    if (!result.ok) {
      setSourceActionError(result.error);
      endTiming();
      return;
    }

    const nextSources = sources.filter((item) => item.id !== target.id);
    const nextMaterial = combineSourceContent(nextSources);
    setSources(nextSources);
    setSavedSourceMaterial(nextMaterial);
    setRequest((prev) => ({ ...prev, notes: nextMaterial }));
    setPendingDeleteSourceId(null);
    setOpenSourceMenuId(null);
    if (openSourceId === target.id) {
      setOpenSourceId(nextSources[0]?.id || null);
    }
    setPathUpdateNotice("Your study material changed. Update your learning path when you're ready.");
    endTiming();
  };

  const startRenameSource = (target: SourceRow) => {
    setRenamingSourceId(target.id);
    setRenameDraft(getSourceDisplayTitle(target));
    setOpenSourceMenuId(null);
    setSourceActionError(null);
  };

  const openSourcePreview = (sourceId: string) => {
    setOpenSourceId(sourceId);
    setIsSourcePreviewExpanded(false);
  };

  const handleRenameSource = async (target: SourceRow) => {
    if (!roomId) return;
    const cleanTitle = renameDraft.trim();
    if (!cleanTitle) {
      setSourceActionError("Source title is required.");
      return;
    }

    const previousSources = sources;
    const optimisticSources = sources.map((item) =>
      item.id === target.id ? { ...item, title: cleanTitle, updated_at: new Date().toISOString() } : item,
    );
    const optimisticMaterial = combineSourceContent(optimisticSources);
    setSources(optimisticSources);
    setSavedSourceMaterial(optimisticMaterial);
    setRequest((prev) => ({ ...prev, notes: optimisticMaterial }));
    setRenamingSourceId(null);
    setRenameDraft("");
    setSourceActionState({ status: "pending", data: { sourceId: target.id } });

    const endTiming = startInteractionTiming("source-rename");
    const result = await renameRoomSourceAction(target.id, cleanTitle, roomId);
    if (!result.ok) {
      const previousMaterial = combineSourceContent(previousSources);
      setSources(previousSources);
      setSavedSourceMaterial(previousMaterial);
      setRequest((prev) => ({ ...prev, notes: previousMaterial }));
      setRenamingSourceId(target.id);
      setRenameDraft(cleanTitle);
      setSourceActionError(result.error);
      setSourceActionState({ status: "error", error: result.error, data: { sourceId: target.id } });
      endTiming();
      return;
    }

    const nextSources = optimisticSources.map((item) =>
      item.id === target.id ? { ...item, title: result.data.title, updated_at: new Date().toISOString() } : item,
    );
    const nextMaterial = combineSourceContent(nextSources);
    setSources(nextSources);
    setSavedSourceMaterial(nextMaterial);
    setRequest((prev) => ({ ...prev, notes: nextMaterial }));
    setSourceActionState({ status: "success", data: { sourceId: target.id } });
    window.setTimeout(() => setSourceActionState({ status: "idle" }), 1400);
    setPathUpdateNotice("Your study material changed. Update your learning path when you're ready.");
    endTiming();
  };

  // Resize State
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    setLeftWidth(getPanelWidth("left"));
    setRightWidth(getPanelWidth("right"));
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      savePanelWidth("left", leftWidth);
      savePanelWidth("right", rightWidth);
    }
  }, [leftWidth, rightWidth, isLoaded]);

  // Handle Dragging
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingLeft) {
        setLeftWidth(clampPanelWidth("left", e.clientX));
      } else if (isDraggingRight) {
        setRightWidth(clampPanelWidth("right", window.innerWidth - e.clientX));
      }
    };

    const handlePointerUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDraggingLeft, isDraggingRight]);

  const conversationRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const submitLockRef = useRef(false);
  const sourceMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const persistedSession = parsePersistedSession(initialSessionState) || readPersistedSession(sessionStorageKey, roomId);
    if (persistedSession) {
      setConceptTracks(persistedSession.conceptTracks || {});
      const routedConceptTitle = initialConcept?.title || null;
      const shouldUsePersistedCurrent =
        !routedConceptTitle ||
        (persistedSession.selectedConcept &&
          getConceptId(persistedSession.selectedConcept) === getConceptId(routedConceptTitle));

      if (shouldUsePersistedCurrent) {
        setSelectedConcept(persistedSession.selectedConcept);
        setResult(persistedSession.result);
        setHistory(persistedSession.history);
        setPreviousExplanations(persistedSession.previousExplanations);
        setPreviousMainGaps(persistedSession.previousMainGaps);
        setPreviousSocraticQuestions(persistedSession.previousSocraticQuestions);
        setResolvedGaps(persistedSession.resolvedGaps);
        setStudyToolsState(persistedSession.studyTools || null);

        if (onRoomLoaded && persistedSession.selectedConcept) {
          onRoomLoaded(initialRoom?.title || "Quick explain", persistedSession.selectedConcept);
        }
      } else if (routedConceptTitle) {
        const routedTrack = persistedSession.conceptTracks?.[getConceptId(routedConceptTitle)];
        if (routedTrack) {
          restoreConceptTrack(routedTrack);
        } else {
          setSelectedConcept(routedConceptTitle);
          setHistory(createEmptyConceptSnapshot(routedConceptTitle).history);
          setResult(null);
          setPreviousExplanations([]);
          setPreviousMainGaps([]);
          setPreviousSocraticQuestions([]);
          setResolvedGaps([]);
          setStudyToolsState(null);
        }
      }
    }

    if (initialConcept?.id && roomId) {
      void startRoomConceptAction(roomId, initialConcept.id);
    }

    setSessionHydrated(true);
  }, []);

  useEffect(() => {
    if (!sessionHydrated) return;

    const hasSessionState =
      Boolean(selectedConcept) ||
      Boolean(result) ||
      Boolean(studyToolsState) ||
      history.length > 0 ||
      previousExplanations.length > 0 ||
      previousMainGaps.length > 0 ||
      previousSocraticQuestions.length > 0 ||
      resolvedGaps.length > 0 ||
      Object.keys(conceptTracks).length > 0;

    if (!hasSessionState) {
      clearPersistedSession(sessionStorageKey, roomId);
      if (roomId) void clearRoomSessionStateAction(roomId);
      return;
    }

    const snapshot: PersistedSessionSnapshot = {
      selectedConcept,
      result,
      history: history.filter((message) => message.kind !== "loading"),
      previousExplanations,
      previousMainGaps,
      previousSocraticQuestions,
      resolvedGaps,
      studyTools: studyToolsState,
      conceptTracks: selectedConcept
        ? {
            ...conceptTracks,
            [getConceptId(selectedConcept)]: buildCurrentConceptTrack(selectedConcept),
          }
        : conceptTracks,
      sourceUpdatedAt: sources.map((item) => item.updated_at).join("|") || null,
    };

    savePersistedSession(sessionStorageKey, snapshot, roomId);

    if (roomId) {
      void saveRoomSessionStateAction(roomId, snapshot as unknown as Json);
    }
  }, [
    sessionHydrated,
    sessionStorageKey,
    selectedConcept,
    result,
    history,
    previousExplanations,
    previousMainGaps,
    previousSocraticQuestions,
    resolvedGaps,
    studyToolsState,
    conceptTracks,
    sources,
  ]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [history, result]);

  useEffect(() => {
    if (!sessionHydrated || !selectedConcept) return;

    const conceptId = getConceptId(selectedConcept);
    const cleanHistory = history.filter((message) => message.kind !== "loading");
    const now = new Date().toISOString();
    const snapshot: ConceptTrackSnapshot = {
      result,
      history: cleanHistory,
      previousExplanations,
      previousMainGaps,
      previousSocraticQuestions,
      resolvedGaps,
      studyTools: studyToolsState,
    };

    setConceptTracks((current) => {
      const existing = current[conceptId];
      const status = postClearMode === "fresh_recall" && !result
        ? existing?.status || "clear"
        : getConceptStatus(result, cleanHistory.length > 0);
      const nextTrack: RoomConceptTrack = {
        id: conceptId,
        roomId,
        title: selectedConcept,
        status,
        latestClarityScore: typeof result?.clarityScore === "number" ? result.clarityScore : existing?.latestClarityScore ?? null,
        startedAt: existing?.startedAt || now,
        completedAt: status === "clear" ? existing?.completedAt || now : existing?.completedAt || null,
        lastActivityAt: now,
        snapshot,
      };

      if (JSON.stringify(existing) === JSON.stringify(nextTrack)) return current;
      return {
        ...current,
        [conceptId]: nextTrack,
      };
    });
  }, [
    sessionHydrated,
    roomId,
    selectedConcept,
    result,
    history,
    previousExplanations,
    previousMainGaps,
    previousSocraticQuestions,
    resolvedGaps,
    studyToolsState,
    postClearMode,
  ]);

  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 140 ? "auto" : "hidden";
  }, [request.explanation]);

  const updateField = (field: keyof ExplanationRequest, value: string) => {
    setRequest((current) => ({ ...current, [field]: value }));
  };

  const selectConcept = (concept: string) => {
    const nextConcept = concept.trim();
    if (nextConcept.length < 2) {
      setError("Please enter a concept or topic.");
      return;
    }

    const endTiming = startInteractionTiming("concept-switch");
    const currentTracks = saveCurrentConceptTrack();
    const conceptId = getConceptId(nextConcept);
    const existingTrack = currentTracks[conceptId];
    const serverConcept = serverConcepts.find((item) => getConceptId(item.title) === conceptId) || null;
    setActiveServerConceptId(serverConcept?.id || null);
    setSelectedConcept(nextConcept);
    setIsChoosingNextConcept(false);
    setError(null);
    setNotice(null);
    setPostClearMode(null);
    setFollowUpAnswer(null);
    setNextRecommendation(null);
    setFreshRecallBaseline(null);
    setRequest(prev => ({ ...prev, explanation: "" }));

    if (existingTrack) {
      startConceptTransition(() => {
        restoreConceptTrack(existingTrack);
      });
      if (serverConcept?.id && roomId) void startRoomConceptAction(roomId, serverConcept.id);
      endTiming();
      return;
    }

    const emptySnapshot = createEmptyConceptSnapshot(nextConcept);
    const now = new Date().toISOString();
    const nextTrack: RoomConceptTrack = {
      id: conceptId,
      roomId,
      title: nextConcept,
      status: "not_started",
      latestClarityScore: null,
      startedAt: now,
      completedAt: null,
      lastActivityAt: now,
      snapshot: emptySnapshot,
    };

    startConceptTransition(() => {
      setConceptTracks({
        ...currentTracks,
        [conceptId]: nextTrack,
      });
      setResult(null);
      setPreviousExplanations([]);
      setPreviousMainGaps([]);
      setPreviousSocraticQuestions([]);
      setResolvedGaps([]);
      setStudyToolsState(null);
      setHistory(emptySnapshot.history);
    });
    if (roomId) {
      void updateRoomSelectedConceptAction(roomId, nextConcept);
      if (serverConcept?.id) void startRoomConceptAction(roomId, serverConcept.id);
    }

    if (onRoomLoaded) {
      onRoomLoaded(room ? room.title : "Quick explain", nextConcept);
    }
    endTiming();
  };

  const handleChooseAnotherConcept = () => {
    saveCurrentConceptTrack();
    setIsChoosingNextConcept(true);
    setPostClearMode(null);
    setFollowUpAnswer(null);
    setNextRecommendation(null);
    setError(null);
    setNotice(null);
    if (!serverConcepts.length && savedSourceMaterial) void mapLearningPath(false);
  };

  const handleAskFollowUp = () => {
    setIsChoosingNextConcept(false);
    setPostClearMode("follow_up");
    setFollowUpAnswer(null);
    setNextRecommendation(null);
    setRequest(prev => ({ ...prev, explanation: "" }));
    window.setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 0);
  };

  const handleTestMyselfAgain = () => {
    setIsChoosingNextConcept(false);
    setPostClearMode("fresh_recall");
    setFollowUpAnswer(null);
    setNextRecommendation(null);
    setFreshRecallBaseline({
      concept: selectedConcept || "this concept",
      score: typeof result?.clarityScore === "number" ? result.clarityScore : null,
      attempt: previousExplanations[previousExplanations.length - 1] || "",
    });
    setShowPreviousAttempt(false);
    setResult(null);
    setNotice(null);
    setError(null);
    setRequest(prev => ({ ...prev, explanation: "" }));
    window.setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 0);
  };

  const focusCustomConceptInput = () => {
    setRequest(prev => ({ ...prev, explanation: "" }));
    showToast("Type your concept in the chat box below.");
    window.setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 0);
  };

  const handleChangeTopic = () => {
    saveCurrentConceptTrack();
    setSelectedConcept(null);
    setResult(null);
    setError(null);
    setNotice(null);
    setPreviousExplanations([]);
    setPreviousMainGaps([]);
    setPreviousSocraticQuestions([]);
    setResolvedGaps([]);
    setStudyToolsState(null);
    setHistory([]);
    setPostClearMode(null);
    setFollowUpAnswer(null);
    setNextRecommendation(null);
    setFreshRecallBaseline(null);
    setRequest(prev => ({ ...prev, explanation: "" }));

    if (onRoomLoaded) {
      onRoomLoaded(room ? room.title : "Quick explain", room?.description || "");
    }
  };

  const showNextRecommendation = () => {
    const recommendation = getRecommendedNextConcept(panelConcepts, selectedConcept);
    setNextRecommendation(recommendation);
    setFollowUpAnswer(null);
    setPostClearMode("follow_up");
    setRequest(prev => ({ ...prev, explanation: "" }));
  };

  const handleFollowUpSubmit = async (question: string) => {
    if (!selectedConcept || isAnsweringFollowUp) return;

    const endTiming = startInteractionTiming("follow-up-answer");
    setIsAnsweringFollowUp(true);
    setError(null);
    setNotice(null);
    setFollowUpAnswer(null);
    setNextRecommendation(null);

    try {
      const response = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMaterial: savedSourceMaterial,
          selectedConcept,
          question,
        }),
      });

      const payload = (await response.json()) as { answer?: string; thinking?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not answer that follow-up.");

      setFollowUpAnswer({
        question,
        answer: payload.answer || "The source does not give enough detail to answer that confidently.",
        thinking: payload.thinking || "Try connecting the question back to the source's central mechanism.",
      });
      setRequest(prev => ({ ...prev, explanation: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not answer that follow-up.");
    } finally {
      setIsAnsweringFollowUp(false);
      endTiming();
    }
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || isLoading || !request.explanation.trim()) return;
    
    if (savedSourceMaterial.trim().length < 10) {
      setError("Please provide study material (min 10 characters).");
      setIsSourcePanelOpen(true);
      return;
    }

    const currentExplanation = request.explanation.trim();

    const postClearIntent = isConceptClear || postClearMode
      ? classifyPostClearIntent(currentExplanation, postClearMode)
      : "unknown";

    if (postClearIntent === "next_recommendation") {
      showNextRecommendation();
      return;
    }

    if (postClearIntent === "follow_up_question") {
      await handleFollowUpSubmit(currentExplanation);
      return;
    }

    if (!selectedConcept) {
      selectConcept(currentExplanation);
      return;
    }

    submitLockRef.current = true;
    const endTiming = startInteractionTiming("explanation-evaluation");
    const submissionId = createMessageId("submission");
    const studentMessage: ConversationMessage = {
      id: `${submissionId}-student`,
      role: "user",
      content: currentExplanation,
    };
    const typingMessage: ConversationMessage = {
      id: `${submissionId}-typing`,
      role: "assistant",
      kind: "loading",
      content: "Looking for the missing link...",
    };

    setHistory(prev => [
      ...prev.filter(message => message.id !== studentMessage.id && message.id !== typingMessage.id),
      studentMessage,
      typingMessage,
    ]);
    setIsLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: savedSourceMaterial,
          selectedConcept,
          explanation: currentExplanation,
          previousExplanations: postClearMode === "fresh_recall" ? [] : previousExplanations,
          previousMainGaps,
          previousSocraticQuestions,
          resolvedGaps,
        }),
      });

      const payload = (await response.json()) as ExplainApiResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Could not analyse this explanation.");
      }

      const resultPayload = payload as ExplainApiResponse;
      setResult(resultPayload);

      if (resultPayload.mockMode && resultPayload.warning) {
        setNotice(resultPayload.warning);
      }
      
      const assistantMessages = getAssistantMessages(resultPayload, submissionId);
      setHistory(prev => [
        ...prev.filter(message => message.id !== typingMessage.id && message.id !== studentMessage.id),
        studentMessage,
        ...assistantMessages,
      ]);
      
      setRequest(prev => ({ ...prev, explanation: "" }));
      setPreviousExplanations(prev => [...prev, currentExplanation]);
      const nextMainGap = readResultField(resultPayload, ["mainGap", "gapSummary"]);
      const nextQuestion = readResultField(resultPayload, ["socraticQuestion"]);
      if (resultPayload.status !== "clear" && resultPayload.status !== "topic_mismatch" && nextMainGap) {
        setPreviousMainGaps(prev => [...prev, nextMainGap]);
      }
      if (resultPayload.status !== "clear" && resultPayload.status !== "topic_mismatch" && nextQuestion) {
        setPreviousSocraticQuestions(prev => [...prev, nextQuestion]);
      }
      if (resultPayload.resolvedGaps?.length) {
        setResolvedGaps(prev => Array.from(new Set([...prev, ...resultPayload.resolvedGaps!])));
      }
      if (roomId && activeServerConceptId) {
        const nextStatus = getConceptStatus(resultPayload, true);
        void updateRoomConceptProgressAction(roomId, activeServerConceptId, {
          clarityScore: resultPayload.status === "topic_mismatch" ? null : resultPayload.clarityScore,
          mainGap: readResultField(resultPayload, ["mainGap", "gapSummary"]),
          status: nextStatus,
          isReviewAttempt: postClearMode === "fresh_recall",
        });
        setServerConcepts((current) =>
          current.map((concept) =>
            concept.id === activeServerConceptId
              ? {
                  ...concept,
                  status: nextStatus,
                  latest_clarity_score:
                    resultPayload.status === "topic_mismatch" ? concept.latest_clarity_score : resultPayload.clarityScore,
                  best_clarity_score:
                    resultPayload.status === "topic_mismatch" || typeof resultPayload.clarityScore !== "number"
                      ? concept.best_clarity_score
                      : Math.max(concept.best_clarity_score ?? concept.latest_clarity_score ?? 0, resultPayload.clarityScore),
                  latest_review_score:
                    postClearMode === "fresh_recall" && typeof resultPayload.clarityScore === "number"
                      ? resultPayload.clarityScore
                      : concept.latest_review_score,
                  last_reviewed_at:
                    postClearMode === "fresh_recall" ? new Date().toISOString() : concept.last_reviewed_at,
                  main_gap: nextStatus === "clear" ? null : readResultField(resultPayload, ["mainGap", "gapSummary"]) || concept.main_gap,
                  completed_at: nextStatus === "clear" ? new Date().toISOString() : null,
                  last_activity_at: new Date().toISOString(),
                }
              : concept,
          ),
        );
      }
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "Could not analyse this explanation.";
      setResult(null);
      setError(errorMessage);
      setHistory(prev => [
        ...prev.filter(message => message.id !== typingMessage.id && message.id !== studentMessage.id),
        studentMessage,
      ]);
    } finally {
      submitLockRef.current = false;
      setIsLoading(false);
      endTiming();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (roomStatus === "not_found") {
    return (
      <div className="empty-insights" style={{ height: '100vh', justifyContent: 'center' }}>
        <h4 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Study room not found</h4>
        <a href="/study" className="app-start-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', background: 'var(--duck)', color: 'var(--ink)' }}>Back to study rooms</a>
      </div>
    );
  }

  const activeSources = sources.filter((item) => item.is_active);
  const openSource = sources.find((item) => item.id === openSourceId) || sources[0] || null;
  const openSourcePreviewSections = openSource ? getSourcePreviewSections(openSource) : [];
  const visiblePreviewSections = isSourcePreviewExpanded ? openSourcePreviewSections : openSourcePreviewSections.slice(0, 1);
  const activeCharacterCount = activeSources.reduce((total, item) => total + getSourceCharacterCount(item), 0);
  const sourceCountLabel = sources.length
    ? `${sources.length} source${sources.length === 1 ? "" : "s"} · ${activeCharacterCount.toLocaleString()} characters`
    : "No study material yet";
  const hasSavedMaterial = !!savedSourceMaterial.trim() && !isEditingNotes;
  const hasMissingClaims = Boolean(result?.missingClaims?.length);
  const isConceptClear = result?.status === "clear" && (result.clarityScore ?? 0) >= 90 && !hasMissingClaims;
  const conceptSuggestionOptions = serverConcepts.filter(
    (concept) => getConceptId(concept.title) !== (selectedConcept ? getConceptId(selectedConcept) : ""),
  );
  const panelConcepts = [
    ...serverConcepts.map((concept): RoomConceptTrack => {
      const localTrack = conceptTracks[getConceptId(concept.title)];
      return {
        id: getConceptId(concept.title),
        roomId,
        title: concept.title,
        status: localTrack?.status || concept.status,
        latestClarityScore: localTrack?.latestClarityScore ?? concept.latest_clarity_score,
        bestClarityScore: localTrack?.bestClarityScore ?? concept.best_clarity_score,
        latestReviewScore: localTrack?.latestReviewScore ?? concept.latest_review_score,
        startedAt: localTrack?.startedAt || concept.started_at,
        completedAt: localTrack?.completedAt || concept.completed_at,
        lastActivityAt: localTrack?.lastActivityAt || concept.last_activity_at,
        snapshot: localTrack?.snapshot || createEmptyConceptSnapshot(concept.title),
      };
    }),
    ...Object.values(conceptTracks),
    ...(selectedConcept && !conceptTracks[getConceptId(selectedConcept)]
      ? [{
          id: getConceptId(selectedConcept),
          roomId,
          title: selectedConcept,
          status: getConceptStatus(result, history.length > 0),
          latestClarityScore: typeof result?.clarityScore === "number" ? result.clarityScore : null,
          bestClarityScore: typeof result?.clarityScore === "number" ? result.clarityScore : null,
          latestReviewScore: null,
          startedAt: null,
          completedAt: result?.status === "clear" ? new Date().toISOString() : null,
          lastActivityAt: null,
          snapshot: {
            result,
            history,
            previousExplanations,
            previousMainGaps,
            previousSocraticQuestions,
            resolvedGaps,
            studyTools: studyToolsState,
          },
        } satisfies RoomConceptTrack]
      : []),
  ].filter((concept, index, all) => (
    all.findIndex((item) => item.id === concept.id) === index
  ));
  const composerPlaceholder = !hasSavedMaterial
    ? "Add study material first..."
    : !selectedConcept
      ? "Enter a concept or topic..."
      : postClearMode === "follow_up" || (isConceptClear && postClearMode !== "fresh_recall")
        ? `Ask a question about ${selectedConcept}...`
      : postClearMode === "fresh_recall"
        ? `Explain ${selectedConcept} in your own words...`
      : isConceptClear
        ? `Ask a follow-up about ${selectedConcept}...`
      : result
        ? `Re-explain ${selectedConcept}...`
        : `Explain ${selectedConcept}...`;
  const currentPostClearIntent = (isConceptClear || postClearMode)
    ? classifyPostClearIntent(request.explanation, postClearMode)
    : "unknown";
  const submitButtonLabel = isLoading || isAnsweringFollowUp
    ? currentPostClearIntent === "follow_up_question" ? "Sending" : "Checking"
    : currentPostClearIntent === "next_recommendation"
      ? "Find my next concept"
      : currentPostClearIntent === "follow_up_question"
        ? "Send question"
        : selectedConcept
          ? "Check explanation"
          : "Start concept";
  const showEvaluationFeedback = !followUpAnswer && !nextRecommendation && !isAnsweringFollowUp && (
    postClearMode !== "fresh_recall" || Boolean(result) || isLoading
  );
  const assistantFeedback = result ? getAssistantFeedback(result) : "";
  const assistantQuestion = result ? getAssistantQuestion(result) : "";
  const latestMainGap = result ? readResultField(result, ["mainGap", "gapSummary", "gap", "feedback"]) : "";
  const latestWhyItMatters = result ? readResultField(result, ["whyItMatters"]) : "";
  const latestRetryPrompt = result ? readResultField(result, ["suggestedReExplanationPrompt", "tryAgain"]) : "";
  const latestAttempt = previousExplanations[previousExplanations.length - 1] || "";
  const completedConceptCount = panelConcepts.filter((concept) => concept.status === "clear").length;
  const gapConceptCount = panelConcepts.filter((concept) => concept.status === "gap_found" || concept.status === "improving").length;
  const roomProgressLabel = panelConcepts.length
    ? `${completedConceptCount}/${panelConcepts.length} clear`
    : hasSavedMaterial
      ? "Concepts pending"
      : "Add material";
  const renderPdfUploadPanel = () => (
    <div className="pdf-upload-panel" aria-live="polite">
      <label className="pdf-file-picker">
        <span>Upload PDF</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfFileChange}
          disabled={isPdfBusy}
        />
      </label>

      {selectedPdfFile ? (
        <div className="pdf-selected-file">
          <strong>{selectedPdfFile.name}</strong>
          <span>{formatFileSize(selectedPdfFile.size)}</span>
        </div>
      ) : (
        <p className="pdf-helper-text">Choose a selectable-text PDF up to 10 MB and 100 pages.</p>
      )}

      {pdfStatus ? <p className="pdf-status" role="status">{pdfStatus}</p> : null}
      {pdfProgress ? (
        <div className="pdf-progress" aria-label={`Reading page ${pdfProgress.currentPage} of ${pdfProgress.totalPages}`}>
          <span style={{ width: `${Math.round((pdfProgress.currentPage / pdfProgress.totalPages) * 100)}%` }} />
        </div>
      ) : null}
      {pdfError ? <div className="pdf-error" role="alert">{pdfError}</div> : null}

      <div className="pdf-actions">
        <button
          type="button"
          className="source-action-btn"
          onClick={handleCancelPdfUpload}
          disabled={isPdfBusy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="source-action-btn source-action-btn-primary"
          onClick={handleSavePdfSource}
          disabled={!selectedPdfFile || isPdfBusy}
        >
          {isPdfBusy ? "Working..." : "Add PDF"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`dashboard-container ${!isSourcePanelOpen ? 'left-closed' : ''}`}>
      {/* Left Panel: Study Material */}
      <aside 
        className={`dashboard-panel left-panel ${!isSourcePanelOpen ? 'closed' : ''}`}
        style={{ 
          width: isSourcePanelOpen ? leftWidth : 0, 
          transition: isDraggingLeft ? "none" : undefined 
        }}
      >
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'inherit', fontWeight: 700 }}>Source Material</h3>
          <button 
            className="panel-toggle-btn" 
            onClick={() => setIsSourcePanelOpen(false)}
            aria-label="Close study material panel"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="panel-content">
          <div className="source-room-summary">
            <div>
              <h4>{room ? room.title : "Quick explain"}</h4>
              <div className="source-meta">{sourceCountLabel}</div>
              {selectedConcept && (
                <div className="current-focus-pill">
                  <span>Current focus</span>
                  <strong>{selectedConcept}</strong>
                </div>
              )}
              {postClearMode === "fresh_recall" ? (
                <div className="current-focus-pill recall-note">
                  <span>Recall mode</span>
                  <strong>Try without checking your notes</strong>
                </div>
              ) : null}
            </div>
            <button className="source-action-btn source-action-btn-primary" type="button" onClick={openAddMaterialSheet}>
              Add material
            </button>
          </div>

          {pathUpdateNotice ? (
            <div className="source-path-notice" role="status">
              <strong>{pathUpdateNotice.startsWith("New material") ? "New material added" : "Study material changed"}</strong>
              <p>{pathUpdateNotice}</p>
              <div>
                <button className="source-action-btn source-action-btn-primary" type="button" onClick={handleUpdateLearningPath} disabled={conceptsLoading}>
                  {conceptsLoading ? "Updating..." : "Update learning path"}
                </button>
                <button className="source-action-btn" type="button" onClick={() => setPathUpdateNotice(null)}>Not now</button>
              </div>
            </div>
          ) : null}

          {isAddMaterialOpen ? (
            <div className="add-material-sheet">
              <div className="source-choice-tabs" aria-label="Source type">
                <button className={sourceInputMode === "pdf" ? "" : "active"} type="button" onClick={openPasteMode}>Paste text</button>
                <button className={sourceInputMode === "pdf" ? "active" : ""} type="button" onClick={openPdfMode}>Upload PDF</button>
              </div>
              {sourceInputMode === "pdf" ? (
                renderPdfUploadPanel()
              ) : (
                <div>
                  <label className="source-field-label">
                    <span>Title (optional)</span>
                    <input
                      className="source-title-input"
                      value={pasteTitle}
                      onChange={(event) => setPasteTitle(event.target.value)}
                      placeholder="Pasted notes"
                    />
                  </label>
                  <textarea
                    className="notes-textarea-minimal"
                    placeholder="Paste your notes or text..."
                    value={request.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    rows={10}
                    style={{ width: '100%', minWidth: '220px', marginBottom: '16px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="source-action-btn" onClick={handleCancelNotesEdit} disabled={isSavingSource}>Cancel</button>
                    <button className="source-action-btn source-action-btn-primary" onClick={handleSaveNotes} disabled={isSavingSource}>
                      {isSavingSource ? "Saving..." : "Add text"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {sourceActionError ? <div className="pdf-error" role="alert">{sourceActionError}</div> : null}

          {sources.length ? (
            <div className="source-list" aria-label="Room sources">
              {sources.map((item) => {
                const isSourcePending = pendingSourceIds.includes(item.id) ||
                  (sourceActionState.status === "pending" && sourceActionState.data?.sourceId === item.id);
                const isSourceSaved = sourceActionState.status === "success" && sourceActionState.data?.sourceId === item.id;

                return (
                <div key={item.id} className={cn("source-list-item", openSourceId === item.id && "active", !item.is_active && "inactive", isSourcePending && "pending")}>
                  <button type="button" className="source-row-main" onClick={() => openSourcePreview(item.id)}>
                    <strong>{getSourceDisplayTitle(item)}</strong>
                    <span>{formatSourceMeta(item)}</span>
                    <em>
                      {isSourcePending
                        ? "Saving..."
                        : isSourceSaved
                          ? "Saved just now"
                          : item.is_active ? "Included in learning path" : "Excluded from learning path"}
                    </em>
                  </button>
                  <button
                    ref={(element) => {
                      sourceMenuTriggerRefs.current[item.id] = element;
                    }}
                    type="button"
                    className="source-menu-trigger"
                    aria-label={`Actions for ${getSourceDisplayTitle(item)}`}
                    aria-haspopup="menu"
                    aria-expanded={openSourceMenuId === item.id}
                    onClick={() => setOpenSourceMenuId((current) => current === item.id ? null : item.id)}
                  >
                    ...
                  </button>
                  {openSourceMenuId === item.id ? (
                    <SourceActionMenuPortal
                      triggerElement={sourceMenuTriggerRefs.current[item.id]}
                      onClose={() => setOpenSourceMenuId(null)}
                      actions={[
                        {
                          label: "View source",
                          onSelect: () => openSourcePreview(item.id),
                        },
                        {
                          label: "Rename",
                          onSelect: () => startRenameSource(item),
                        },
                        {
                          label: item.is_active ? "Exclude from learning path" : "Include in learning path",
                          onSelect: () => handleToggleSourceActive(item),
                        },
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => setPendingDeleteSourceId(item.id),
                        },
                      ]}
                    />
                  ) : null}
                  {renamingSourceId === item.id ? (
                    <div className="source-inline-edit">
                      <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} aria-label="Source title" />
                      <button type="button" onClick={() => handleRenameSource(item)} disabled={sourceActionState.status === "pending"}>Save</button>
                      <button type="button" onClick={() => setRenamingSourceId(null)}>Cancel</button>
                    </div>
                  ) : null}
                  {pendingDeleteSourceId === item.id ? (
                    <div className="source-delete-confirm">
                      <span>Delete this material?</span>
                      <button type="button" onClick={() => handleDeleteSource(item)}>Delete</button>
                      <button type="button" onClick={() => setPendingDeleteSourceId(null)}>Cancel</button>
                    </div>
                  ) : null}
                </div>
              )})}
            </div>
          ) : (
            <div className="empty-insights" style={{ alignItems: 'flex-start', textAlign: 'left', padding: '0', height: 'auto' }}>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--ink)' }}>No study material yet</h4>
              <p style={{ marginBottom: '24px' }}>Add a PDF or pasted notes for Feynduck to use as the source.</p>
            </div>
          )}

          {openSource ? (
            <div className="source-preview-block">
              <div className="source-preview-heading">
                <div>
                  <span>{openSource.source_type === "pdf" ? "Extracted PDF text" : "Pasted source"}</span>
                  <strong>{getSourceDisplayTitle(openSource)}</strong>
                </div>
                <div className="source-preview-actions">
                  <button type="button" onClick={() => setIsSourcePreviewExpanded((current) => !current)}>
                    {isSourcePreviewExpanded ? "Collapse" : "Expand"}
                  </button>
                  <button type="button" onClick={() => setOpenSourceId(null)}>Close</button>
                </div>
              </div>
              <div className={cn("source-formatted-preview", isSourcePreviewExpanded && "expanded")}>
                {visiblePreviewSections.map((section) => (
                  <section key={`${openSource.id}-${section.title}`} className="source-preview-section">
                    <h5>{section.title}</h5>
                    <p>{section.body}</p>
                  </section>
                ))}
                {!isSourcePreviewExpanded && openSourcePreviewSections.length > 1 ? (
                  <button type="button" className="source-preview-more" onClick={() => setIsSourcePreviewExpanded(true)}>
                    Show all {openSourcePreviewSections.length} sections
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="study-context-block">
                <div className="study-context-heading">
                  <span>Room progress</span>
                  <strong>{roomProgressLabel}</strong>
                </div>
                <div className="study-context-stats">
                  <span>{gapConceptCount} weak spots</span>
                  <span>{previousExplanations.length} explanations</span>
                </div>
                {panelConcepts.length ? (
                  <div className="study-context-list" aria-label="Concept progress">
                    {panelConcepts.slice(0, 6).map((concept) => (
                      <button
                        key={concept.id}
                        type="button"
                        className={cn("study-context-item", concept.id === (selectedConcept ? getConceptId(selectedConcept) : "") && "active")}
                        onClick={() => selectConcept(concept.title)}
                      >
                        <span>{concept.title}</span>
                        <em>{concept.latestClarityScore != null ? concept.latestClarityScore : concept.status.replace("_", " ")}</em>
                      </button>
                    ))}
                  </div>
                ) : null}
                {previousMainGaps.length ? (
                  <div className="study-weakspot-card">
                    <span>Latest weak spot</span>
                    <p>{previousMainGaps[previousMainGaps.length - 1]}</p>
                  </div>
                ) : null}
          </div>
        </div>
      </aside>

      {isSourcePanelOpen && (
        <div
          className={cn("resize-handle", isDraggingLeft && "active")}
          onPointerDown={(e) => { e.preventDefault(); setIsDraggingLeft(true); }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize study material panel"
        />
      )}

      {/* Center Panel: Explanation workspace */}
      <main className="dashboard-panel center-panel">
        {!isSourcePanelOpen && (
          <button 
            className="panel-toggle-btn sidebar-open-btn" 
            onClick={() => setIsSourcePanelOpen(true)}
            aria-label="Open study material panel"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}
        {!isSupportPanelOpen && (
          <button
            className="panel-toggle-btn support-open-btn"
            onClick={() => setIsSupportPanelOpen(true)}
            aria-label="Open support panel"
          >
            <PanelRightOpen size={20} />
          </button>
        )}
        
        <div className="conversation-area explain-workspace" ref={conversationRef}>
          {!hasSavedMaterial ? (
            <div className="empty-insights" style={{ height: '100%' }}>
              <h4 style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>
                {isEditingNotes ? "Save material to begin" : "Add study material to begin"}
              </h4>
              <p>
                {isEditingNotes
                  ? "Save your source material first, then Feynduck will suggest concepts from it."
                  : "Feynduck needs your material before it can check your explanation."}
              </p>
            </div>
          ) : isChoosingNextConcept ? (
            <div className="concept-picker-state">
              <div>
                <span className="conversation-kicker">Next concept</span>
                <h2>What would you like to learn next?</h2>
                <p>Choose another concept from this material.</p>
              </div>
              {conceptsLoading ? (
                <div className="concept-loading large" aria-live="polite">
                  <Loader2 className="icon-spin" size={18} />
                  <span>Mapping the concepts in your material...</span>
                </div>
              ) : null}
              {!conceptsLoading && conceptsError ? (
                <div className="concept-error learning-path-error">
                  <strong>{conceptsError}</strong>
                  <span>Try again, or add the concept you want to explain yourself.</span>
                  <div>
                    <button type="button" onClick={() => mapLearningPath(false)}>
                      Try again
                    </button>
                    <button type="button" onClick={focusCustomConceptInput}>
                      Add your own concept
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="next-concept-grid">
                {conceptSuggestionOptions.map((concept) => (
                  <button
                    key={concept.title}
                    type="button"
                    className="next-concept-card"
                    onClick={() => selectConcept(concept.title)}
                  >
                    <strong>{concept.title}</strong>
                    {concept.description ? <span>{concept.description}</span> : null}
                  </button>
                ))}
              </div>
              <div className="next-concept-custom">
                <textarea
                  className="composer-textarea"
                  placeholder="Enter another concept..."
                  value={request.explanation}
                  onChange={(event) => updateField("explanation", event.target.value)}
                  rows={2}
                />
                <button
                  type="button"
                  className="source-action-btn source-action-btn-primary"
                  disabled={!request.explanation.trim()}
                  onClick={() => selectConcept(request.explanation)}
                >
                  Start concept
                </button>
              </div>
            </div>
          ) : (
            <section className={cn("explain-loop-surface", isConceptSwitchPending && "is-switching")} aria-label="Explanation workspace">
              <div className="explain-loop-header">
                <div>
                  <span className="conversation-kicker">Main loop</span>
                  <h1>{selectedConcept ? selectedConcept : "Choose the concept you want to explain"}</h1>
                  <p>
                    {selectedConcept
                      ? "Explain the mechanism in your own words. Feynduck will find the missing reasoning link."
                      : "Pick a concept from your material, or type one below to start the explanation loop."}
                  </p>
                </div>
                <div
                  className={cn("explain-loop-score", result?.status === "topic_mismatch" && "is-mismatch")}
                  aria-label="Current clarity score"
                >
                  <span>{result?.status === "topic_mismatch" ? "Status" : "Clarity"}</span>
                  <strong>{result?.status === "topic_mismatch" ? "Topic mismatch" : result?.clarityScore ?? "--"}</strong>
                </div>
              </div>

              {isConceptSwitchPending && selectedConcept ? (
                <div className="concept-switch-loading skeleton-block" aria-live="polite">
                  <Loader2 className="icon-spin" size={18} />
                  <span>Loading {selectedConcept}...</span>
                  <i />
                  <i />
                </div>
              ) : null}

              {hasSavedMaterial && !selectedConcept && (
                <div className="concept-suggestions explain-concept-suggestions" aria-label="Suggested concepts">
                  {conceptsLoading && (
                    <div className="concept-loading" aria-live="polite">
                      <Loader2 className="icon-spin" size={16} />
                      <span>Mapping the concepts in your material...</span>
                    </div>
                  )}
                  {!conceptsLoading && conceptsError && (
                    <div className="concept-error learning-path-error">
                      <strong>{conceptsError}</strong>
                      <span>Try again, or add the concept you want to explain yourself.</span>
                      <div>
                        <button type="button" onClick={() => mapLearningPath(false)}>
                          Try again
                        </button>
                        <button type="button" onClick={focusCustomConceptInput}>
                          Add your own concept
                        </button>
                      </div>
                    </div>
                  )}
                  {!conceptsLoading && !conceptsError && serverConcepts.map((concept) => (
                    <button
                      key={concept.title}
                      type="button"
                      className="concept-chip"
                      onClick={() => selectConcept(concept.title)}
                      title={concept.description || undefined}
                    >
                      {concept.title}
                    </button>
                  ))}
                  {!conceptsLoading && !conceptsError ? (
                    <button type="button" className="concept-chip" onClick={focusCustomConceptInput}>
                      Add your own concept
                    </button>
                  ) : null}
                </div>
              )}

              {postClearMode === "fresh_recall" && selectedConcept ? (
                <div className="fresh-recall-card">
                  <span>Fresh recall</span>
                  <h3>One more time — without looking back.</h3>
                  <p>Explain {selectedConcept} in your own words.</p>
                  {freshRecallBaseline?.attempt ? (
                    <div className="previous-attempt-toggle">
                      <button type="button" onClick={() => setShowPreviousAttempt((current) => !current)}>
                        {showPreviousAttempt ? "Hide previous attempt" : "Previous attempt"}
                      </button>
                      {showPreviousAttempt ? <p>{freshRecallBaseline.attempt}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {nextRecommendation ? (
                <div className="next-recommendation-card">
                  <span>Recommended next</span>
                  {nextRecommendation.allClear ? (
                    <>
                      <h3>You’ve explained every concept in this room clearly.</h3>
                      <p>{nextRecommendation.reason}</p>
                      <button type="button" className="source-action-btn source-action-btn-primary" onClick={handleChooseAnotherConcept}>
                        Choose a concept to revisit
                      </button>
                    </>
                  ) : nextRecommendation.concept ? (
                    <>
                      <h3>{nextRecommendation.concept.title}</h3>
                      <em>{nextRecommendation.concept.status.replace("_", " ")}</em>
                      <p>{nextRecommendation.reason}</p>
                      <div>
                        <button type="button" className="source-action-btn source-action-btn-primary" onClick={() => selectConcept(nextRecommendation.concept!.title)}>
                          Start explaining {nextRecommendation.concept.title}
                        </button>
                        <button type="button" className="source-action-btn" onClick={handleChooseAnotherConcept}>
                          See all concepts
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {followUpAnswer ? (
                <div className="follow-up-answer-card">
                  <span>Follow-up answer</span>
                  <h3>Answer</h3>
                  <p>{followUpAnswer.answer}</p>
                  <h4>Try thinking about it this way</h4>
                  <p>{followUpAnswer.thinking}</p>
                </div>
              ) : null}

              {postClearMode === "fresh_recall" && freshRecallBaseline && result ? (
                <div className={cn("review-status-card", isConceptClear ? "is-clear" : "is-improving")}>
                  <strong>{isConceptClear ? "Strongly understood" : "Previously clear · Latest review: Improving"}</strong>
                  <span>
                    First clear explanation: {freshRecallBaseline.score ?? "--"}
                    {typeof result.clarityScore === "number" ? ` · Fresh recall: ${result.clarityScore}` : ""}
                  </span>
                </div>
              ) : null}

              {showEvaluationFeedback && (result || isLoading || latestAttempt) && (
                <div className="explain-feedback-grid" aria-label="Latest feedback">
                  <article className={cn("explain-feedback-card missing-link", isLoading && "loading-pulse")}>
                    <span>{isConceptClear ? "Clear" : result?.status === "topic_mismatch" ? "Topic mismatch" : "Missing link"}</span>
                    <p>{isLoading ? "Analyzing the reasoning chain..." : assistantFeedback || latestMainGap || "No feedback yet."}</p>
                  </article>
                  {assistantQuestion && !isConceptClear ? (
                    <article className="explain-feedback-card socratic">
                      <span>Socratic follow-up</span>
                      <p>{assistantQuestion}</p>
                    </article>
                  ) : null}
                  {latestWhyItMatters && result?.status !== "clear" ? (
                    <article className="explain-feedback-card why">
                      <span>Why it matters</span>
                      <p>{latestWhyItMatters}</p>
                    </article>
                  ) : null}
                  {latestRetryPrompt && result?.status !== "clear" ? (
                    <article className="explain-feedback-card retry">
                      <span>Try again</span>
                      <p>{latestRetryPrompt}</p>
                    </article>
                  ) : null}
                  {latestAttempt ? (
                    <article className="explain-feedback-card attempt">
                      <span>Latest attempt</span>
                      <p>{latestAttempt}</p>
                    </article>
                  ) : null}
                </div>
              )}

              {showEvaluationFeedback ? (
              <div className="explain-next-step">
                <span />
                <p>Use the feedback above to rebuild the answer below.</p>
                <span />
              </div>
              ) : null}

              {isConceptClear && selectedConcept ? (
                <div className="concept-complete-card explain-complete-card">
                  <div className="concept-complete-icon"><CheckCircle2 size={22} /></div>
                  <div>
                    <h3>You can explain {selectedConcept} clearly.</h3>
                    <p>
                      Clarity {result.clarityScore}. Want to make it stick? Try explaining it once more without looking back.
                    </p>
                    <div className="concept-complete-chips">
                      <span>Clarity {result.clarityScore}</span>
                      <span>Quiz ready</span>
                      <span>Flashcards ready</span>
                    </div>
                    <div className="concept-complete-actions">
                      <button type="button" className="source-action-btn source-action-btn-primary" onClick={handleChooseAnotherConcept}>
                        Choose another concept
                      </button>
                      <button type="button" className="source-action-btn" onClick={handleTestMyselfAgain}>
                        Test myself again
                      </button>
                      <button type="button" className="source-action-btn" onClick={handleAskFollowUp}>
                        Ask a follow-up
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={cn("explain-answer-card", isLoading && "loading")}>
                <div className="composer-label-icon">
                  <MessageSquareText size={14} />
                  <span>
                    {currentPostClearIntent === "follow_up_question" || postClearMode === "follow_up" || (isConceptClear && postClearMode !== "fresh_recall")
                      ? "FOLLOW-UP QUESTION"
                      : postClearMode === "fresh_recall"
                        ? "FRESH RECALL"
                        : selectedConcept
                          ? "Your explanation"
                          : "Concept to study"}
                  </span>
                </div>
                <textarea
                  ref={composerTextareaRef}
                  className="explain-answer-textarea"
                  placeholder={composerPlaceholder}
                  value={request.explanation}
                  onChange={(e) => updateField("explanation", e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!hasSavedMaterial}
                />
                <div className="explain-answer-actions">
                  <p>
                    <span className="kb-shortcut">Cmd + Enter</span>
                    {currentPostClearIntent === "follow_up_question"
                      ? " to send your question"
                      : isConceptClear && postClearMode !== "fresh_recall"
                        ? " Ask about this concept, or ask what to learn next."
                        : selectedConcept ? " to check your explanation" : " to start this concept"}
                  </p>
                  <div>
                    <button
                      className="composer-mic-btn"
                      type="button"
                      aria-label="Explain by voice"
                      disabled={!hasSavedMaterial}
                    >
                      <Mic size={20} />
                    </button>
                    <button
                      className="explain-check-btn"
                      onClick={handleSubmit}
                      disabled={isLoading || isAnsweringFollowUp || !request.explanation.trim() || !hasSavedMaterial}
                    >
                      {isLoading || isAnsweringFollowUp ? (
                        <>
                          <Loader2 className="icon-spin" size={18} />
                          {isAnsweringFollowUp ? "Sending" : "Checking"}
                        </>
                      ) : (
                        submitButtonLabel
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {toastMessage && <div className="app-toast" role="status">{toastMessage}</div>}
              {notice && <div className="app-notice">{notice}</div>}
              {error && <div className="app-error">{error}</div>}
            </section>
          )}
        </div>
      </main>

      {isSupportPanelOpen && (
        <>
          <div
            className={cn("resize-handle", isDraggingRight && "active")}
            onPointerDown={(e) => { e.preventDefault(); setIsDraggingRight(true); }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize support panel"
          />

          {/* Right Panel: Support */}
          <GapResultPanel
            result={result}
            isLoading={isLoading}
            width={rightWidth}
            isDragging={isDraggingRight}
            hasNotes={hasSavedMaterial}
            hasSelectedConcept={!!selectedConcept}
            sourceMaterial={hasSavedMaterial ? savedSourceMaterial : ""}
            selectedConcept={selectedConcept}
            explanationAttempts={previousExplanations}
            sessionId={roomId || "quick"}
            initialStudyToolsState={studyToolsState}
            onStudyToolsStateChange={setStudyToolsState}
            isConceptSwitching={isConceptSwitchPending}
            concepts={panelConcepts.map((concept) => ({
              id: concept.id,
              title: concept.title,
              status: concept.status,
              latestClarityScore: concept.latestClarityScore,
            }))}
            activeConceptId={selectedConcept ? getConceptId(selectedConcept) : null}
            onConceptSelect={selectConcept}
            onClose={() => setIsSupportPanelOpen(false)}
          />
        </>
      )}
    </div>
  );
}
