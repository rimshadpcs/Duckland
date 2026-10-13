"use client";

import { useState, KeyboardEvent, ChangeEvent, useRef, useEffect, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { GapResultPanel } from "@src/features/gap-analysis";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, FileText, Mic, MoreHorizontal, PanelLeft, PanelRight, Plus, Upload, X } from "lucide-react";
import { AccountMenu } from "@src/components/app/AppHeader";
import type { AuthenticatedUser } from "@src/lib/auth";
import {
  clearRoomSessionStateAction,
  deleteRoomSourceAction,
  renameRoomSourceAction,
  saveRoomSessionStateAction,
  saveRoomSourceAction,
  startRoomConceptAction,
  toggleRoomSourceActiveAction,
  updateRoomConceptProgressAction,
  updateRoomSelectedConceptAction,
} from "@src/app/study/actions";
import { cn } from "@src/lib/utils";
import { formatFileSize, PDF_UNREADABLE_MESSAGE, uploadPdfSource, validatePdfFile } from "@src/lib/pdf/uploadPdfSource";
import { clampPanelWidth, getPanelWidth, savePanelWidth } from "@src/lib/storage/panelStorage";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import { getNextRecallDate } from "@src/lib/study/recommendations";
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

const VOICE_WAVEFORM_BAR_COUNT = 34;

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

type ConceptStatus = "not_started" | "explaining" | "gap_found" | "improving" | "clear" | "needs_recall" | "due_for_review";
type PostClearIntent = "follow_up_question" | "next_recommendation" | "fresh_recall" | "unknown";
type PostClearMode = "follow_up" | "fresh_recall" | null;
type VoiceInputStatus = "idle" | "recording" | "transcribing" | "ready_to_edit" | "error";

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
  nextReviewAt?: string | null;
  reviewCount?: number;
  mainUnresolvedGap?: string | null;
  lastSocraticQuestion?: string | null;
  lastMissingRelationship?: string | null;
  lastImprovedExplanation?: string | null;
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

// Matches the CSS breakpoint where side panels turn into drawers.
function isCompactLayout() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches;
}

function getSessionStorageKey(roomId: string | null) {
  return `feynduck-session-${roomId || "quick"}`;
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
  const size = source.source_type === "pdf" && source.page_count
    ? `${source.page_count} page${source.page_count === 1 ? "" : "s"}`
    : `${getSourceCharacterCount(source).toLocaleString()} chars`;
  return `${size} · ${source.is_active ? "in learning path" : "excluded"}`;
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

    const legacyStatus = (track.status as string | undefined) === "in_progress" ? "explaining" : track.status;
    const status: ConceptStatus =
      legacyStatus === "clear" ||
      legacyStatus === "gap_found" ||
      legacyStatus === "improving" ||
      legacyStatus === "explaining" ||
      legacyStatus === "needs_recall" ||
      legacyStatus === "due_for_review" ||
      legacyStatus === "not_started"
        ? legacyStatus
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
      bestClarityScore: typeof track.bestClarityScore === "number" ? track.bestClarityScore : null,
      latestReviewScore: typeof track.latestReviewScore === "number" ? track.latestReviewScore : null,
      nextReviewAt: typeof track.nextReviewAt === "string" ? track.nextReviewAt : null,
      reviewCount: typeof track.reviewCount === "number" ? track.reviewCount : 0,
      mainUnresolvedGap: typeof track.mainUnresolvedGap === "string" ? track.mainUnresolvedGap : null,
      lastSocraticQuestion: typeof track.lastSocraticQuestion === "string" ? track.lastSocraticQuestion : null,
      lastMissingRelationship: typeof track.lastMissingRelationship === "string" ? track.lastMissingRelationship : null,
      lastImprovedExplanation: typeof track.lastImprovedExplanation === "string" ? track.lastImprovedExplanation : null,
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

function appendTranscript(existingText: string, transcript: string) {
  const existing = existingText.trim();
  const next = transcript.trim();
  if (!existing) return next;
  if (!next) return existing;
  return `${existing}\n\n${next}`;
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

  const inProgress = byRecent(concepts.filter((concept) => concept.status === "explaining"))[0];
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
  if (hasHistory) return "explaining";
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
  authUser,
  initialRoom,
  initialSources = [],
  initialSessionState,
  initialConcept,
  initialRoomConcepts = [],
  requestedRoomId,
  initialRecallMode = false,
}: {
  authUser?: AuthenticatedUser;
  initialRoom?: StudyRoomRow | null;
  initialSources?: SourceRow[];
  initialSessionState?: Json | null;
  initialConcept?: RoomConceptRow | null;
  initialRoomConcepts?: RoomConceptRow[];
  requestedRoomId?: string | null;
  initialRecallMode?: boolean;
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
  const [studyToolsState, setStudyToolsState] = useState<Json | null>(null);
  const [conceptTracks, setConceptTracks] = useState<Record<string, RoomConceptTrack>>({});
  const [isChoosingNextConcept, setIsChoosingNextConcept] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [postClearMode, setPostClearMode] = useState<PostClearMode>(initialRecallMode ? "fresh_recall" : null);
  const [followUpAnswer, setFollowUpAnswer] = useState<FollowUpAnswerState>(null);
  const [isAnsweringFollowUp, setIsAnsweringFollowUp] = useState(false);
  const [nextRecommendation, setNextRecommendation] = useState<NextRecommendationState>(null);
  const [freshRecallBaseline, setFreshRecallBaseline] = useState<{ concept: string; score: number | null; attempt: string } | null>(null);
  const [scoreBeforeLatestAttempt, setScoreBeforeLatestAttempt] = useState<number | null>(initialConcept?.latest_clarity_score ?? null);
  const [showPreviousAttempt, setShowPreviousAttempt] = useState(false);
  const [voiceInputStatus, setVoiceInputStatus] = useState<VoiceInputStatus>("idle");
  const [voiceInputError, setVoiceInputError] = useState<string | null>(null);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [voiceWaveformBars, setVoiceWaveformBars] = useState<number[]>(() =>
    Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, () => 0.18),
  );
  const [isConceptSwitchPending, startConceptTransition] = useTransition();

  const buildCurrentConceptTrack = (
    concept: string,
    overrides: Partial<RoomConceptTrack> = {},
  ): RoomConceptTrack => {
    const id = getConceptId(concept);
    const existing = conceptTracks[id];
    const serverConcept = serverConcepts.find((item) => getConceptId(item.title) === id);
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
      nextReviewAt: existing?.nextReviewAt ?? serverConcept?.next_review_at ?? null,
      reviewCount: existing?.reviewCount ?? serverConcept?.review_count ?? 0,
      mainUnresolvedGap:
        (result ? readResultField(result, ["mainGap", "gapSummary"]) : "") ||
        existing?.mainUnresolvedGap ||
        serverConcept?.main_unresolved_gap ||
        serverConcept?.main_gap ||
        null,
      lastSocraticQuestion:
        (result ? readResultField(result, ["socraticQuestion"]) : "") ||
        existing?.lastSocraticQuestion ||
        serverConcept?.last_socratic_question ||
        null,
      lastMissingRelationship:
        result?.missingClaims?.[0] ||
        existing?.lastMissingRelationship ||
        serverConcept?.last_missing_relationship ||
        null,
      lastImprovedExplanation: existing?.lastImprovedExplanation || serverConcept?.last_improved_explanation || null,
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

  useEffect(() => {
    return () => {
      voiceMediaRecorderRef.current?.state === "recording" && voiceMediaRecorderRef.current.stop();
      voiceMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const cleanupVoiceInput = () => {
    if (voiceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceAnimationFrameRef.current);
      voiceAnimationFrameRef.current = null;
    }
    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    void voiceAudioContextRef.current?.close();
    voiceAudioContextRef.current = null;
    voiceAnalyserRef.current = null;
    voiceMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceMediaStreamRef.current = null;
    voiceMediaRecorderRef.current = null;
    setVoiceRecordingSeconds(0);
    setVoiceWaveformBars(Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, () => 0.18));
  };

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
            status: "explaining",
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

  const handlePdfFile = (file: File | null) => {
    setSelectedPdfFile(null);
    setPdfError(null);
    setPdfStatus(null);
    setPdfProgress(null);

    if (!file) return;

    const validationError = validatePdfFile(file);
    if (validationError) {
      setPdfError(validationError);
      return;
    }

    setSelectedPdfFile(file);
  };

  const handlePdfFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    handlePdfFile(file);
    if (file && validatePdfFile(file)) event.target.value = "";
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
    const endTiming = startInteractionTiming("pdf-upload-and-extraction");

    try {
      const saved = await uploadPdfSource({
        file: selectedPdfFile,
        roomId,
        roomTitle: room.title,
        onStatus: setPdfStatus,
        onProgress: (currentPage, totalPages) => setPdfProgress({ currentPage, totalPages }),
      });

      const savedAt = new Date().toISOString();
      const nextSources = [...sources, saved.source];
      const nextMaterial = combineSourceContent(nextSources);
      setSources(nextSources);
      setOpenSourceId(saved.source.id);
      setSavedSourceMaterial(nextMaterial);
      setRoom((current) =>
        current
          ? {
              ...current,
              title: saved.roomTitle || current.title,
              status: "explaining",
              last_activity_at: savedAt,
            }
          : current,
      );
      setRequest(prev => ({ ...prev, notes: nextMaterial }));
      setSelectedPdfFile(null);
      setSourceInputMode(null);
      setIsAddMaterialOpen(false);
      setPdfStatus(serverConcepts.length ? "PDF added · Saved" : "PDF added · Mapping concepts...");
      setSourceActionState({ status: "success", data: { sourceId: saved.source.id } });
      window.setTimeout(() => setSourceActionState({ status: "idle" }), 1600);
      if (serverConcepts.length) {
        setPathUpdateNotice(`New material added. Your learning path is based on ${Math.max(1, sources.filter((item) => item.is_active).length)} source${sources.filter((item) => item.is_active).length === 1 ? "" : "s"}. Update it to include ${nextSources.filter((item) => item.is_active).length} sources?`);
      } else {
        void mapLearningPath(false, nextMaterial);
      }
    } catch (caught) {
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
  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceMediaStreamRef = useRef<MediaStream | null>(null);
  const voiceAudioChunksRef = useRef<BlobPart[]>([]);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceAnimationFrameRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceRecordingStartedAtRef = useRef(0);
  const voiceShouldSubmitRef = useRef(false);
  const voiceInputBeforeRecordingRef = useRef("");
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

    if (initialRecallMode && initialConcept) {
      const persistedTrack = persistedSession?.conceptTracks?.[getConceptId(initialConcept.title)];
      const trackAttempts = persistedTrack?.snapshot.previousExplanations || [];
      const sessionAttempts = persistedSession?.previousExplanations || [];
      const previousAttempt = trackAttempts[trackAttempts.length - 1] ||
        sessionAttempts[sessionAttempts.length - 1] ||
        "";
      const previousScore = persistedTrack?.latestClarityScore ??
        persistedSession?.result?.clarityScore ??
        initialConcept.latest_review_score ??
        initialConcept.latest_clarity_score;

      setSelectedConcept(initialConcept.title);
      setActiveServerConceptId(initialConcept.id);
      setPostClearMode("fresh_recall");
      setFreshRecallBaseline({
        concept: initialConcept.title,
        score: typeof previousScore === "number" ? previousScore : null,
        attempt: previousAttempt,
      });
      setScoreBeforeLatestAttempt(typeof previousScore === "number" ? previousScore : null);
      setResult(null);
      setRequest((current) => ({ ...current, explanation: "" }));
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
    setScoreBeforeLatestAttempt(existingTrack?.latestClarityScore ?? serverConcept?.latest_clarity_score ?? null);
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

  const handleSubmit = async (explanationOverride?: string) => {
    const currentExplanation = (explanationOverride || request.explanation).trim();
    if (submitLockRef.current || isLoading || !currentExplanation) return;
    
    if (savedSourceMaterial.trim().length < 10) {
      setError("Please provide study material (min 10 characters).");
      setIsSourcePanelOpen(true);
      return;
    }

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
    setScoreBeforeLatestAttempt(
      typeof result?.clarityScore === "number"
        ? result.clarityScore
        : serverConcepts.find((concept) => concept.id === activeServerConceptId)?.latest_clarity_score ?? null,
    );
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
        const currentServerConcept = serverConcepts.find((concept) => concept.id === activeServerConceptId);
        const nextReviewCount = postClearMode === "fresh_recall"
          ? (currentServerConcept?.review_count ?? 0) + 1
          : currentServerConcept?.review_count ?? 0;
        const nextReviewAt = nextStatus === "clear"
          ? getNextRecallDate(nextReviewCount).toISOString()
          : null;
        void updateRoomConceptProgressAction(roomId, activeServerConceptId, {
          clarityScore: resultPayload.status === "topic_mismatch" ? null : resultPayload.clarityScore,
          mainGap: nextMainGap,
          status: nextStatus,
          isReviewAttempt: postClearMode === "fresh_recall",
          lastSocraticQuestion: nextQuestion,
          lastWrongAssumption: resultPayload.gapType === "unsupported_claim" ? nextMainGap : null,
          lastMissingRelationship: resultPayload.missingClaims?.[0] || nextMainGap,
          lastImprovedExplanation: resultPayload.resolvedGaps?.length ? currentExplanation : null,
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
                  next_review_at: nextReviewAt,
                  review_count: nextReviewCount,
                  recall_status: nextReviewAt ? "scheduled" : "not_scheduled",
                  main_gap: nextStatus === "clear" ? null : readResultField(resultPayload, ["mainGap", "gapSummary"]) || concept.main_gap,
                  main_unresolved_gap: nextStatus === "clear" ? null : nextMainGap || concept.main_unresolved_gap,
                  last_socratic_question: nextQuestion || concept.last_socratic_question,
                  last_missing_relationship: resultPayload.missingClaims?.[0] || nextMainGap || concept.last_missing_relationship,
                  last_improved_explanation: resultPayload.resolvedGaps?.length ? currentExplanation : concept.last_improved_explanation,
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

  const formatVoiceRecordingTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString();
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const startVoiceMeter = (stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    voiceAudioContextRef.current = audioContext;
    voiceAnalyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bucketSize = Math.max(1, Math.floor(data.length / VOICE_WAVEFORM_BAR_COUNT));
      const nextBars = Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, (_, index) => {
        const start = index * bucketSize;
        const bucket = data.slice(start, start + bucketSize);
        const average = bucket.reduce((sum, value) => sum + value, 0) / Math.max(1, bucket.length);
        return Math.max(0.14, Math.min(1, average / 150));
      });
      setVoiceWaveformBars(nextBars);
      voiceAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
    voiceRecordingStartedAtRef.current = Date.now();
    voiceTimerRef.current = window.setInterval(() => {
      setVoiceRecordingSeconds(Math.floor((Date.now() - voiceRecordingStartedAtRef.current) / 1000));
    }, 250);
  };

  const submitVoiceInput = async (audioBlob: Blob) => {
    try {
      if (audioBlob.size < 512) {
        throw new Error("Recording was empty. Try speaking for a little longer.");
      }

      setVoiceInputStatus("transcribing");
      setVoiceInputError(null);
      const formData = new FormData();
      formData.append("audio", audioBlob, "feynduck-study.webm");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { transcript?: string; error?: string };

      if (!response.ok || !payload.transcript) {
        throw new Error(payload.error || "Feynduck could not transcribe that recording.");
      }

      const transcript = payload.transcript.trim();
      setRequest((current) => ({
        ...current,
        explanation: appendTranscript(voiceInputBeforeRecordingRef.current || current.explanation, transcript),
      }));
      setVoiceInputStatus("ready_to_edit");
      setVoiceInputError(null);
    } catch (error) {
      setVoiceInputStatus("error");
      setRequest((current) => ({ ...current, explanation: voiceInputBeforeRecordingRef.current || current.explanation }));
      setVoiceInputError(error instanceof Error ? error.message : "Voice explanation failed. Try again.");
    }
  };

  const stopVoiceInput = (shouldSubmit: boolean) => {
    const recorder = voiceMediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    voiceShouldSubmitRef.current = shouldSubmit;
    recorder.stop();
  };

  const cancelVoiceInput = () => {
    const restorePreviousInput = () => {
      const previous = voiceInputBeforeRecordingRef.current;
      setRequest((current) => ({ ...current, explanation: previous }));
    };

    if (voiceInputStatus === "recording") {
      voiceShouldSubmitRef.current = false;
      stopVoiceInput(false);
      restorePreviousInput();
      return;
    }

    cleanupVoiceInput();
    restorePreviousInput();
    setVoiceInputStatus("idle");
  };

  const confirmVoiceInput = () => {
    if (voiceInputStatus !== "recording") return;
    stopVoiceInput(true);
    setVoiceInputStatus("transcribing");
  };

  const startVoiceInput = async () => {
    if (voiceInputStatus === "recording") {
      return;
    }

    if (voiceInputStatus === "transcribing" || isLoading || isAnsweringFollowUp || !hasSavedMaterial) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceInputStatus("error");
      setVoiceInputError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setVoiceInputStatus("recording");
      setVoiceInputError(null);
      voiceInputBeforeRecordingRef.current = request.explanation;
      voiceAudioChunksRef.current = [];
      voiceShouldSubmitRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceMediaStreamRef.current = stream;
      startVoiceMeter(stream);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceAudioChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        cleanupVoiceInput();
        setVoiceInputStatus("error");
        setVoiceInputError("Recording failed. Try again.");
      };
      recorder.onstop = () => {
        const blob = new Blob(voiceAudioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const shouldSubmit = voiceShouldSubmitRef.current;
        cleanupVoiceInput();
        if (shouldSubmit) {
          void submitVoiceInput(blob);
        } else {
          setVoiceInputStatus("idle");
        }
      };

      voiceMediaRecorderRef.current = recorder;
      recorder.start();
    } catch (error) {
      cleanupVoiceInput();
      setVoiceInputStatus("error");
      setRequest((current) => ({ ...current, explanation: voiceInputBeforeRecordingRef.current || current.explanation }));
      const isDenied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setVoiceInputError(isDenied ? "Microphone permission was denied." : "Could not start the microphone.");
    }
  };

  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const pdfDragDepthRef = useRef(0);
  const [modKey, setModKey] = useState("⌘");

  useEffect(() => {
    if (!/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setModKey("Ctrl");
    if (isCompactLayout()) {
      setIsSourcePanelOpen(false);
      setIsSupportPanelOpen(false);
    }
  }, []);

  if (roomStatus === "not_found") {
    return (
      <div className="fd" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="fd-center-inner is-narrow fd-enter">
          <div className="fd-empty-tile" aria-hidden="true">
            <FileText size={24} strokeWidth={1.8} />
          </div>
          <div className="fd-center-head">
            <h1 style={{ fontSize: 22 }}>Study room not found</h1>
            <p>It may have been deleted, or the link is out of date.</p>
          </div>
          <a href="/study" className="fd-btn fd-btn-accent">Back to study rooms</a>
        </div>
      </div>
    );
  }

  const activeSources = sources.filter((item) => item.is_active);
  const openSource = sources.find((item) => item.id === openSourceId) || sources[0] || null;
  const openSourcePreviewSections = openSource ? getSourcePreviewSections(openSource) : [];
  const visiblePreviewSections = isSourcePreviewExpanded ? openSourcePreviewSections : openSourcePreviewSections.slice(0, 1);
  const activeCharacterCount = activeSources.reduce((total, item) => total + getSourceCharacterCount(item), 0);
  const sourceCountLabel = sources.length
    ? `${sources.length} source${sources.length === 1 ? "" : "s"} · ${activeCharacterCount.toLocaleString()} chars`
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
        nextReviewAt: localTrack?.nextReviewAt ?? concept.next_review_at,
        reviewCount: localTrack?.reviewCount ?? concept.review_count,
        mainUnresolvedGap: localTrack?.mainUnresolvedGap ?? concept.main_unresolved_gap ?? concept.main_gap,
        lastSocraticQuestion: localTrack?.lastSocraticQuestion ?? concept.last_socratic_question,
        lastMissingRelationship: localTrack?.lastMissingRelationship ?? concept.last_missing_relationship,
        lastImprovedExplanation: localTrack?.lastImprovedExplanation ?? concept.last_improved_explanation,
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
          nextReviewAt: null,
          reviewCount: 0,
          mainUnresolvedGap: result ? readResultField(result, ["mainGap", "gapSummary"]) || null : null,
          lastSocraticQuestion: result ? readResultField(result, ["socraticQuestion"]) || null : null,
          lastMissingRelationship: result?.missingClaims?.[0] || (result ? readResultField(result, ["mainGap", "gapSummary"]) : "") || null,
          lastImprovedExplanation: result?.resolvedGaps?.length
            ? previousExplanations[previousExplanations.length - 1] || null
            : null,
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
  const isVoiceInputActive =
    voiceInputStatus === "recording" ||
    voiceInputStatus === "transcribing";
  const voiceInputLabel =
    voiceInputStatus === "transcribing"
      ? "Transcribing"
      : "Listening";
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
  const activeConceptMemory = serverConcepts.find((concept) => concept.id === activeServerConceptId) || null;
  const activeLocalTrack = selectedConcept ? conceptTracks[getConceptId(selectedConcept)] : null;
  const lastWeakLink =
    activeLocalTrack?.mainUnresolvedGap ||
    activeLocalTrack?.lastMissingRelationship ||
    activeConceptMemory?.main_unresolved_gap ||
    activeConceptMemory?.last_missing_relationship ||
    activeConceptMemory?.main_gap ||
    previousMainGaps[previousMainGaps.length - 1] ||
    "";
  const sessionImprovement = result?.resolvedGaps?.[0] || (
    typeof scoreBeforeLatestAttempt === "number" && typeof result?.clarityScore === "number" && result.clarityScore > scoreBeforeLatestAttempt
      ? `Your clarity improved by ${result.clarityScore - scoreBeforeLatestAttempt} points.`
      : ""
  );
  const summaryNextRecallDate = isConceptClear
    ? activeConceptMemory?.next_review_at || getNextRecallDate(
      postClearMode === "fresh_recall" ? (activeConceptMemory?.review_count ?? 0) + 1 : activeConceptMemory?.review_count ?? 0,
    ).toISOString()
    : null;
  const sessionNextAction = isConceptClear
    ? `Recall this from memory ${summaryNextRecallDate ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(summaryNextRecallDate)) : "tomorrow"}.`
    : result?.status === "topic_mismatch"
      ? "Return to the selected concept and explain only that idea."
      : "Use the weak link above, then explain the concept again.";
  const completedConceptCount = panelConcepts.filter((concept) => concept.status === "clear").length;
  const gapConceptCount = panelConcepts.filter((concept) => concept.status === "gap_found" || concept.status === "improving").length;
  const roomProgressLabel = panelConcepts.length
    ? `${completedConceptCount}/${panelConcepts.length} clear`
    : hasSavedMaterial
      ? "Concepts pending"
      : "Add material";
  const roomTitle = room?.title || "Quick explain";
  const roomHref = room ? `/study/room/${room.id}` : "/study";
  const showMaterialForm = isAddMaterialOpen || sources.length === 0;
  const isTranscribing = voiceInputStatus === "transcribing";
  const isChoosingConcept = hasSavedMaterial && (isChoosingNextConcept || !selectedConcept);
  const chooserConcepts = isChoosingNextConcept ? conceptSuggestionOptions : serverConcepts;
  const clearPercent = panelConcepts.length ? Math.round((completedConceptCount / panelConcepts.length) * 100) : 0;
  const isFollowUpComposer =
    currentPostClearIntent === "follow_up_question" ||
    postClearMode === "follow_up" ||
    (isConceptClear && postClearMode !== "fresh_recall");
  const composerLabel = isFollowUpComposer
    ? "Ask a follow-up"
    : postClearMode === "fresh_recall"
      ? "Explain it from memory"
      : selectedConcept
        ? result || previousExplanations.length
          ? "Re-explain it"
          : "Explain it in your own words"
        : "Or explain something else";
  const composerHint = currentPostClearIntent === "follow_up_question"
    ? `${modKey} ↵ to send`
    : isConceptClear && postClearMode !== "fresh_recall"
      ? "Ask about this concept, or what to learn next"
      : selectedConcept
        ? `${modKey} ↵ to check`
        : `${modKey} ↵ to start`;
  const attemptLabel = postClearMode === "fresh_recall"
    ? "Fresh recall"
    : `Attempt ${Math.max(1, previousExplanations.length + (result || isLoading ? 0 : 1))} · Explain the mechanism`;
  const feedbackStatus = result?.status === "topic_mismatch"
    ? { label: "Topic mismatch", tone: "is-danger" }
    : isConceptClear
      ? { label: "Clear", tone: "is-success" }
      : result?.status === "improving"
        ? { label: "Improving", tone: "is-amber" }
        : { label: "Gap found", tone: "is-amber" };
  const scoreChanged =
    typeof scoreBeforeLatestAttempt === "number" &&
    typeof result?.clarityScore === "number" &&
    scoreBeforeLatestAttempt !== result.clarityScore;

  const resizeWithKeys = (side: "left" | "right", event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    const delta = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    if (!delta) return;
    event.preventDefault();
    if (side === "left") setLeftWidth((current) => clampPanelWidth("left", current + delta));
    else setRightWidth((current) => clampPanelWidth("right", current - delta));
  };

  const startTypedConcept = () => {
    if (isChoosingNextConcept) selectConcept(request.explanation);
    else void handleSubmit();
  };

  const renderComposer = (rows: number, conceptMode = false) => (
    <div className={cn("fd-composer", isVoiceInputActive && "is-recording")}>
      {isVoiceInputActive ? (
        <>
          <div className="fd-voice-head">
            <span>Voice explanation</span>
            <span className={cn("fd-rec", isTranscribing && "is-muted")}>
              <span aria-hidden="true" />
              {voiceInputLabel} · {formatVoiceRecordingTime(voiceRecordingSeconds)}
            </span>
          </div>
          <div className={cn("fd-wave", isTranscribing && "is-idle fd-pulse")} aria-hidden="true">
            {voiceWaveformBars.map((level, index) => (
              <span key={index} style={{ transform: `scaleY(${Math.max(0.12, isTranscribing ? 0.18 : level)})` }} />
            ))}
          </div>
          <div className="fd-composer-foot">
            <span className="fd-hint-text">
              {isTranscribing ? "Turning your recording into text…" : "Recording on your device. Confirm when you’re done."}
            </span>
            <div>
              <button
                type="button"
                className="fd-icon-btn fd-icon-btn-lg"
                aria-label="Discard recording"
                disabled={isTranscribing}
                onClick={cancelVoiceInput}
              >
                <X size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="fd-btn fd-btn-accent"
                disabled={voiceInputStatus !== "recording"}
                onClick={confirmVoiceInput}
              >
                {isTranscribing ? <span className="fd-spinner" aria-hidden="true" /> : <Check size={16} strokeWidth={2.2} />}
                {isTranscribing ? "Transcribing…" : "Use recording"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <label htmlFor="fd-composer-input">{conceptMode ? "Or explain something else" : composerLabel}</label>
          <textarea
            id="fd-composer-input"
            ref={composerTextareaRef}
            rows={rows}
            placeholder={conceptMode ? "e.g. Expiratory airflow limitation in asthma" : composerPlaceholder}
            value={request.explanation}
            onChange={(event) => updateField("explanation", event.target.value)}
            onKeyDown={(event) => {
              if (conceptMode && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                startTypedConcept();
                return;
              }
              handleKeyDown(event);
            }}
            disabled={!hasSavedMaterial}
          />
          <div className="fd-composer-foot">
            <span className="fd-hint">{conceptMode ? `${modKey} ↵ to start` : composerHint}</span>
            <div>
              <button
                type="button"
                className="fd-icon-btn fd-icon-btn-lg"
                aria-label="Explain by voice"
                title="Explain by voice"
                onClick={startVoiceInput}
                disabled={!hasSavedMaterial || isLoading || isAnsweringFollowUp}
              >
                <Mic size={18} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="fd-btn fd-btn-accent"
                onClick={() => (conceptMode ? startTypedConcept() : void handleSubmit())}
                disabled={isLoading || isAnsweringFollowUp || !request.explanation.trim() || !hasSavedMaterial}
              >
                {isLoading || isAnsweringFollowUp ? <span className="fd-spinner" aria-hidden="true" /> : null}
                {isLoading || isAnsweringFollowUp
                  ? `${isAnsweringFollowUp ? "Sending" : "Checking"}…`
                  : conceptMode ? "Start concept" : submitButtonLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderMaterialForm = () => (
    <div className="fd-material-form">
      <div role="tablist" aria-label="Material type" className="fd-segmented">
        <button type="button" role="tab" aria-selected={sourceInputMode !== "pdf"} onClick={openPasteMode}>
          Paste text
        </button>
        <button type="button" role="tab" aria-selected={sourceInputMode === "pdf"} onClick={openPdfMode}>
          Upload PDF
        </button>
      </div>

      {sourceInputMode === "pdf" ? (
        <>
          <label
            className={cn("fd-dropzone is-compact", isDraggingPdf && "is-dragging", selectedPdfFile && "has-file")}
            onDragEnter={(event) => {
              event.preventDefault();
              pdfDragDepthRef.current += 1;
              setIsDraggingPdf(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              pdfDragDepthRef.current = Math.max(0, pdfDragDepthRef.current - 1);
              if (pdfDragDepthRef.current === 0) setIsDraggingPdf(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              pdfDragDepthRef.current = 0;
              setIsDraggingPdf(false);
              if (!isPdfBusy) handlePdfFile(event.dataTransfer.files?.[0] || null);
            }}
          >
            {selectedPdfFile ? (
              <>
                <span className="fd-file-badge is-sm" aria-hidden="true">PDF</span>
                <span className="fd-dropzone-title" style={{ fontSize: 14, wordBreak: "break-word" }}>{selectedPdfFile.name}</span>
                <span className="fd-dropzone-hint">{formatFileSize(selectedPdfFile.size)} · click or drop to replace</span>
              </>
            ) : (
              <>
                <Upload size={24} strokeWidth={1.8} aria-hidden="true" />
                <span className="fd-dropzone-title" style={{ fontSize: 14 }}>
                  {isDraggingPdf ? "Drop your PDF here" : <>Drop a PDF or <u>browse</u></>}
                </span>
                <span className="fd-dropzone-hint" style={{ fontSize: 12 }}>Selectable-text PDF, up to 10 MB and 100 pages</span>
              </>
            )}
            <input type="file" accept="application/pdf,.pdf" onChange={handlePdfFileChange} disabled={isPdfBusy} />
          </label>
          {pdfStatus || pdfProgress ? (
            <div className="fd-upload-progress" role="status">
              {pdfStatus ? (
                <span className="fd-busy" style={{ fontSize: 13 }}>
                  {isPdfBusy ? <span className="fd-spinner" aria-hidden="true" /> : null}
                  {pdfStatus}
                </span>
              ) : null}
              {pdfProgress ? (
                <div className="fd-bar is-thin">
                  <span style={{ width: `${Math.round((pdfProgress.currentPage / pdfProgress.totalPages) * 100)}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
          {pdfError ? (
            <div className="fd-notice is-error" role="alert">
              <AlertCircle size={16} strokeWidth={1.8} />
              <span>{pdfError}</span>
            </div>
          ) : null}
          <div className="fd-form-actions">
            {sources.length ? (
              <button type="button" className="fd-btn fd-btn-ghost fd-btn-md" onClick={handleCancelPdfUpload} disabled={isPdfBusy}>
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="fd-btn fd-btn-accent fd-btn-md"
              onClick={handleSavePdfSource}
              disabled={!selectedPdfFile || isPdfBusy}
            >
              {isPdfBusy ? "Working…" : "Add PDF"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="fd-field">
            <label htmlFor="mat-title" className="fd-label" style={{ fontSize: 12 }}>
              Title <span className="fd-optional">(optional)</span>
            </label>
            <input
              id="mat-title"
              className="fd-input fd-input-sm"
              value={pasteTitle}
              onChange={(event) => setPasteTitle(event.target.value)}
              placeholder="Lecture 4 notes"
            />
          </div>
          <div className="fd-field">
            <label htmlFor="mat-text" className="fd-label" style={{ fontSize: 12 }}>Text</label>
            <textarea
              id="mat-text"
              className="fd-textarea"
              rows={9}
              style={{ fontSize: 14 }}
              placeholder="Paste your notes or text…"
              value={request.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </div>
          <div className="fd-form-actions">
            {sources.length ? (
              <button type="button" className="fd-btn fd-btn-ghost fd-btn-md" onClick={handleCancelNotesEdit} disabled={isSavingSource}>
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="fd-btn fd-btn-accent fd-btn-md"
              onClick={handleSaveNotes}
              disabled={isSavingSource || request.notes.trim().length < 10}
            >
              {isSavingSource ? <span className="fd-spinner" aria-hidden="true" /> : null}
              {isSavingSource ? "Saving…" : "Add text"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderSourcePanel = () => (
    <aside
      className={cn("fd-panel is-left", isDraggingLeft && "is-dragging")}
      style={{ width: leftWidth }}
      aria-label="Source material and learning path"
    >
      <div className="fd-panel-head">
        <div>
          <strong title={roomTitle}>{roomTitle}</strong>
          <span className="fd-kicker">{sourceCountLabel}</span>
        </div>
        {sources.length ? (
          <button
            type="button"
            className={cn("fd-btn fd-btn-secondary fd-btn-sm")}
            aria-expanded={isAddMaterialOpen}
            onClick={openAddMaterialSheet}
          >
            {isAddMaterialOpen ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
            {isAddMaterialOpen ? "Close" : "Add material"}
          </button>
        ) : null}
      </div>

      {postClearMode === "fresh_recall" ? (
        <div className="fd-panel-block">
          <div className="fd-notice is-amber">
            <span><strong>Recall mode.</strong> Try it without checking your notes.</span>
          </div>
        </div>
      ) : null}

      {pathUpdateNotice ? (
        <div className="fd-panel-block">
          <div className="fd-notice is-amber" role="status" style={{ flexDirection: "column", gap: 0 }}>
            <strong>{pathUpdateNotice.startsWith("New material") ? "New material added" : "Study material changed"}</strong>
            <span>{pathUpdateNotice}</span>
            <div className="fd-notice-actions">
              <button type="button" className="fd-btn fd-btn-dark fd-btn-sm" onClick={handleUpdateLearningPath} disabled={conceptsLoading}>
                {conceptsLoading ? "Updating…" : "Update learning path"}
              </button>
              <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={() => setPathUpdateNotice(null)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMaterialForm ? renderMaterialForm() : null}

      {sourceActionError ? (
        <div className="fd-panel-block">
          <div className="fd-notice is-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span>{sourceActionError}</span>
          </div>
        </div>
      ) : null}

      {sources.length ? (
        <div className="fd-source-stack" aria-label="Room sources">
          {sources.map((item) => {
            const isSourcePending = pendingSourceIds.includes(item.id) ||
              (sourceActionState.status === "pending" && sourceActionState.data?.sourceId === item.id);
            const isSourceSaved = sourceActionState.status === "success" && sourceActionState.data?.sourceId === item.id;
            const isOpen = openSourceId === item.id;

            return (
              <div
                key={item.id}
                className={cn("fd-source-item", isOpen && "is-open", !item.is_active && "is-inactive", isSourcePending && "is-pending")}
              >
                <div className="fd-source-row">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => (isOpen ? setOpenSourceId(null) : openSourcePreview(item.id))}
                  >
                    <span className="fd-file-badge is-sm" aria-hidden="true">{item.source_type === "pdf" ? "PDF" : "TXT"}</span>
                    <span>
                      <strong>{getSourceDisplayTitle(item)}</strong>
                      <small>
                        {isSourcePending
                          ? "Saving…"
                          : isSourceSaved
                            ? "Saved just now"
                            : formatSourceMeta(item)}
                      </small>
                    </span>
                  </button>
                  <button
                    ref={(element) => {
                      sourceMenuTriggerRefs.current[item.id] = element;
                    }}
                    type="button"
                    className="fd-icon-btn is-plain fd-icon-btn-sm"
                    aria-label={`Actions for ${getSourceDisplayTitle(item)}`}
                    aria-haspopup="menu"
                    aria-expanded={openSourceMenuId === item.id}
                    onClick={() => setOpenSourceMenuId((current) => (current === item.id ? null : item.id))}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                {openSourceMenuId === item.id ? (
                  <SourceActionMenuPortal
                    triggerElement={sourceMenuTriggerRefs.current[item.id]}
                    onClose={() => setOpenSourceMenuId(null)}
                    actions={[
                      { label: isOpen ? "Hide preview" : "View source", onSelect: () => (isOpen ? setOpenSourceId(null) : openSourcePreview(item.id)) },
                      { label: "Rename", onSelect: () => startRenameSource(item) },
                      {
                        label: item.is_active ? "Exclude from learning path" : "Include in learning path",
                        onSelect: () => handleToggleSourceActive(item),
                      },
                      { label: "Delete", destructive: true, onSelect: () => setPendingDeleteSourceId(item.id) },
                    ]}
                  />
                ) : null}
                {renamingSourceId === item.id ? (
                  <form
                    className="fd-inline-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleRenameSource(item);
                    }}
                  >
                    <input
                      className="fd-input fd-input-sm"
                      style={{ height: 32, fontSize: 13 }}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      aria-label="Source title"
                      autoFocus
                    />
                    <button type="submit" className="fd-btn fd-btn-dark fd-btn-sm" disabled={sourceActionState.status === "pending"}>Save</button>
                    <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={() => setRenamingSourceId(null)}>Cancel</button>
                  </form>
                ) : null}
                {pendingDeleteSourceId === item.id ? (
                  <div className="fd-inline-confirm" role="alertdialog" aria-label="Delete this material?">
                    <span>Delete this material?</span>
                    <button type="button" className="fd-btn fd-btn-danger fd-btn-sm" onClick={() => handleDeleteSource(item)}>Delete</button>
                    <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={() => setPendingDeleteSourceId(null)}>Cancel</button>
                  </div>
                ) : null}
                {isOpen && openSourcePreviewSections.length ? (
                  <div className={cn("fd-source-preview", !isSourcePreviewExpanded && "is-collapsed")}>
                    <div className="fd-source-preview-head">
                      <span className="fd-eyebrow">{item.source_type === "pdf" ? "Extracted text" : "Pasted text"}</span>
                      <div>
                        <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" style={{ height: 26, padding: "0 8px", fontSize: 12 }} onClick={() => setIsSourcePreviewExpanded((current) => !current)}>
                          {isSourcePreviewExpanded ? "Collapse" : "Expand"}
                        </button>
                      </div>
                    </div>
                    {visiblePreviewSections.map((section) => (
                      <section key={`${item.id}-${section.title}`}>
                        <h5>{section.title}</h5>
                        <p>{section.body}</p>
                      </section>
                    ))}
                    {!isSourcePreviewExpanded && openSourcePreviewSections.length > 1 ? (
                      <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" style={{ alignSelf: "flex-start", padding: "0 6px", fontSize: 12 }} onClick={() => setIsSourcePreviewExpanded(true)}>
                        Show all {openSourcePreviewSections.length} sections
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="fd-path-head">
        <div>
          <span>Learning path</span>
          <span className="fd-kicker">{conceptsLoading ? "Mapping…" : panelConcepts.length ? `${completedConceptCount} / ${panelConcepts.length} clear` : roomProgressLabel}</span>
        </div>
        <div className="fd-bar is-thin" aria-hidden="true">
          <span style={{ width: `${clearPercent}%` }} />
        </div>
        {panelConcepts.length ? (
          <div className="fd-path-stats">
            <span>{gapConceptCount} weak spot{gapConceptCount === 1 ? "" : "s"}</span>
            <span>{previousExplanations.length} explanation{previousExplanations.length === 1 ? "" : "s"}</span>
          </div>
        ) : null}
      </div>
      {conceptsLoading ? (
        <div className="fd-path-skeleton fd-pulse" aria-hidden="true">
          <span className="fd-skeleton" style={{ width: "80%" }} />
          <span className="fd-skeleton" style={{ width: "64%" }} />
          <span className="fd-skeleton" style={{ width: "72%" }} />
        </div>
      ) : panelConcepts.length ? (
        <ul className="fd-path-list" aria-label="Concept progress">
          {panelConcepts.map((concept) => {
            const isActive = concept.id === (selectedConcept ? getConceptId(selectedConcept) : "");
            return (
              <li key={concept.id}>
                <button
                  type="button"
                  className="fd-path-item"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => {
                    selectConcept(concept.title);
                    if (isCompactLayout()) setIsSourcePanelOpen(false);
                  }}
                  title={concept.title}
                >
                  <span className="fd-dot" data-status={concept.status} aria-hidden="true" />
                  <span>{concept.title}</span>
                  {concept.latestClarityScore != null ? (
                    <span className={cn("fd-path-score", concept.status === "clear" && "is-clear")}>{concept.latestClarityScore}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="fd-path-empty">
          {hasSavedMaterial ? "No concepts yet. Pick one in the middle or type your own." : "Concepts from your material will appear here."}
        </div>
      )}
    </aside>
  );

  const renderCenter = () => {
    if (!hasSavedMaterial) {
      return (
        <main className="fd-center is-middle" ref={conversationRef}>
          <div className="fd-center-inner is-narrow fd-enter">
            <div className="fd-empty-tile" aria-hidden="true">
              <FileText size={24} strokeWidth={1.8} />
            </div>
            <div className="fd-center-head">
              <h1 style={{ fontSize: 22 }}>{isEditingNotes ? "Save material to begin" : "Add study material to begin"}</h1>
              <p>
                {isEditingNotes
                  ? "Save your notes on the left, then Feynduck will map the concepts in them."
                  : "Feynduck needs your material before it can check your explanation. Paste notes or upload a PDF on the left."}
              </p>
            </div>
            <ol className="fd-flow-steps">
              <li className="is-active"><span>1</span>Add material</li>
              <li><span>2</span>Pick a concept</li>
              <li><span>3</span>Explain it</li>
            </ol>
            {!isSourcePanelOpen ? (
              <button type="button" className="fd-btn fd-btn-accent" onClick={() => setIsSourcePanelOpen(true)}>
                Open the material panel
              </button>
            ) : null}
          </div>
        </main>
      );
    }

    if (isChoosingConcept) {
      return (
        <main className="fd-center" ref={conversationRef}>
          <div className="fd-center-inner fd-enter" style={{ gap: 24 }}>
            <div className="fd-center-head">
              <h1>{isChoosingNextConcept ? "What would you like to learn next?" : "Choose a concept to explain"}</h1>
              <p>
                {isChoosingNextConcept
                  ? "Pick another concept from this material, or type your own."
                  : "Pick one from your material, or type your own. You’ll explain it in your own words and Feynduck will find the missing link."}
              </p>
            </div>

            {conceptsLoading ? (
              <section className="fd-busy-card" aria-busy="true">
                <div className="fd-busy">
                  <span className="fd-spinner" aria-hidden="true" />
                  Mapping the concepts in your material…
                </div>
                <div className="fd-busy-grid fd-pulse" aria-hidden="true">
                  <span className="fd-skeleton" />
                  <span className="fd-skeleton" />
                  <span className="fd-skeleton" />
                  <span className="fd-skeleton" />
                </div>
              </section>
            ) : conceptsError ? (
              <div className="fd-notice is-error" role="alert" style={{ flexDirection: "column", gap: 0 }}>
                <strong>{conceptsError}</strong>
                <span>Try again, or type the concept you want to explain below.</span>
                <div className="fd-notice-actions">
                  <button type="button" className="fd-btn fd-btn-dark fd-btn-sm" onClick={() => mapLearningPath(false)}>Try again</button>
                  <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={() => composerTextareaRef.current?.focus()}>Type my own</button>
                </div>
              </div>
            ) : chooserConcepts.length ? (
              <section aria-labelledby="from-h" className="fd-section" style={{ gap: 10 }}>
                <div className="fd-section-head">
                  <h2 id="from-h" className="fd-section-title" style={{ fontSize: 13 }}>From your material</h2>
                  <span className="fd-kicker">{chooserConcepts.length} concept{chooserConcepts.length === 1 ? "" : "s"}</span>
                </div>
                <div className="fd-concept-grid fd-stagger">
                  {chooserConcepts.map((concept, index) => (
                    <button
                      key={concept.id}
                      type="button"
                      className="fd-concept-pick"
                      style={{ "--i": index } as CSSProperties}
                      onClick={() => selectConcept(concept.title)}
                      title={concept.description || undefined}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span>{concept.title}</span>
                      <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {renderComposer(2, true)}

            {isChoosingNextConcept && selectedConcept ? (
              <button type="button" className="fd-btn fd-btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setIsChoosingNextConcept(false)}>
                <ArrowLeft size={16} strokeWidth={1.8} />
                Back to {selectedConcept}
              </button>
            ) : null}
            {renderMessages()}
          </div>
        </main>
      );
    }

    return (
      <main className="fd-center" ref={conversationRef}>
        <section className="fd-center-inner" aria-label="Explanation workspace">
          <div className="fd-center-head">
            <span className="fd-kicker">{attemptLabel}</span>
            <h1>{selectedConcept}</h1>
          </div>

          {isConceptSwitchPending ? (
            <section className="fd-busy-card" aria-busy="true">
              <div className="fd-busy">
                <span className="fd-spinner" aria-hidden="true" />
                Loading {selectedConcept}…
              </div>
              <div className="fd-busy-lines fd-pulse" aria-hidden="true">
                <span className="fd-skeleton" style={{ width: "80%" }} />
                <span className="fd-skeleton" style={{ width: "62%" }} />
              </div>
            </section>
          ) : null}

          {postClearMode === "fresh_recall" ? (
            <section className="fd-callout is-amber" aria-label="Fresh recall">
              <span className="fd-eyebrow is-amber">Fresh recall</span>
              <h3>One more time, without looking back.</h3>
              <p>Explain {selectedConcept} in your own words.</p>
              {freshRecallBaseline?.attempt ? (
                <div className="fd-callout-actions">
                  <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" aria-expanded={showPreviousAttempt} onClick={() => setShowPreviousAttempt((current) => !current)}>
                    {showPreviousAttempt ? "Hide previous attempt" : "Show previous attempt"}
                  </button>
                </div>
              ) : null}
              {showPreviousAttempt && freshRecallBaseline?.attempt ? <p style={{ whiteSpace: "pre-wrap" }}>{freshRecallBaseline.attempt}</p> : null}
            </section>
          ) : null}

          {lastWeakLink && (!result || postClearMode === "fresh_recall") && !isLoading ? (
            <section className="fd-callout" aria-label="Last weak link">
              <span className="fd-eyebrow is-amber">Last weak link</span>
              <p style={{ color: "var(--fd-ink)", fontSize: 15, fontWeight: 500 }}>{lastWeakLink}</p>
              {activeConceptMemory?.last_socratic_question ? (
                <p>{activeConceptMemory.last_socratic_question}</p>
              ) : null}
            </section>
          ) : null}

          {nextRecommendation ? (
            <section className="fd-callout" aria-label="Recommended next">
              <span className="fd-eyebrow">Recommended next</span>
              {nextRecommendation.allClear ? (
                <>
                  <h3>You’ve explained every concept in this room clearly.</h3>
                  <p>{nextRecommendation.reason}</p>
                  <div className="fd-callout-actions">
                    <button type="button" className="fd-btn fd-btn-accent fd-btn-md" onClick={handleChooseAnotherConcept}>
                      Choose a concept to revisit
                    </button>
                  </div>
                </>
              ) : nextRecommendation.concept ? (
                <>
                  <h3>{nextRecommendation.concept.title}</h3>
                  <p>{nextRecommendation.reason}</p>
                  <div className="fd-callout-actions">
                    <button type="button" className="fd-btn fd-btn-accent fd-btn-md" onClick={() => selectConcept(nextRecommendation.concept!.title)}>
                      Start explaining it
                      <ArrowRight size={14} className="fd-arrow" />
                    </button>
                    <button type="button" className="fd-btn fd-btn-ghost fd-btn-md" onClick={handleChooseAnotherConcept}>
                      See all concepts
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {followUpAnswer ? (
            <section className="fd-callout" aria-label="Follow-up answer">
              <span className="fd-eyebrow">Your question</span>
              <p style={{ color: "var(--fd-ink)", fontWeight: 500 }}>{followUpAnswer.question}</p>
              <span className="fd-eyebrow" style={{ marginTop: 6 }}>Answer</span>
              <p style={{ color: "var(--fd-ink-2)", fontSize: 15 }}>{followUpAnswer.answer}</p>
              <div className="fd-ask" style={{ margin: "6px 0 0" }}>
                <CircleHelp size={18} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <span>Try thinking about it this way</span>
                  <span>{followUpAnswer.thinking}</span>
                </div>
              </div>
            </section>
          ) : null}

          {postClearMode === "fresh_recall" && freshRecallBaseline && result ? (
            <section className={cn("fd-callout", isConceptClear ? "is-success" : "is-amber")} aria-label="Recall result">
              <h3>{isConceptClear ? "It stuck. Strongly understood." : "Previously clear · still improving on recall"}</h3>
              <p className="fd-mono" style={{ fontSize: 13 }}>
                First clear explanation {freshRecallBaseline.score ?? "—"}
                {typeof result.clarityScore === "number" ? ` · Fresh recall ${result.clarityScore}` : ""}
              </p>
            </section>
          ) : null}

          {isLoading ? (
            <section className="fd-busy-card" aria-label="Checking your explanation" aria-busy="true">
              <div className="fd-busy">
                <span className="fd-spinner" aria-hidden="true" />
                Finding the missing link in your reasoning…
              </div>
              <div className="fd-busy-lines fd-pulse" aria-hidden="true">
                <span className="fd-skeleton" style={{ width: "80%" }} />
                <span className="fd-skeleton" style={{ width: "62%" }} />
                <span className="fd-skeleton" style={{ width: "70%" }} />
              </div>
            </section>
          ) : null}

          {showEvaluationFeedback && result && !isLoading ? (
            <section className="fd-feedback" aria-labelledby="fb-h">
              <div className="fd-feedback-head">
                <div>
                  <h2 id="fb-h">Feedback</h2>
                  <span className={cn("fd-pill", feedbackStatus.tone)}>
                    <span className="fd-dot is-sm" data-status={isConceptClear ? "clear" : "gap_found"} style={feedbackStatus.tone === "is-danger" ? { background: "var(--fd-danger)" } : undefined} />
                    {feedbackStatus.label}
                  </span>
                </div>
                {result.status !== "topic_mismatch" && typeof result.clarityScore === "number" ? (
                  <div className="fd-score" aria-label={`Clarity ${result.clarityScore} out of 100`}>
                    <span className="fd-muted" style={{ fontSize: 12 }}>Clarity</span>
                    <div className={cn("fd-bar", isConceptClear ? "is-success" : "is-amber")} aria-hidden="true">
                      <span style={{ width: `${result.clarityScore}%` }} />
                    </div>
                    <span className="fd-score-num">
                      {result.clarityScore}
                      <small>/100</small>
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="fd-feedback-lead">
                <span className={cn("fd-eyebrow", !isConceptClear && "is-amber")}>
                  {isConceptClear ? "What you got right" : result.status === "topic_mismatch" ? "Off topic" : "Missing link"}
                </span>
                <p>{assistantFeedback || latestMainGap || "No feedback yet."}</p>
              </div>

              {assistantQuestion && !isConceptClear ? (
                <div className="fd-ask">
                  <CircleHelp size={18} strokeWidth={1.8} aria-hidden="true" />
                  <div>
                    <span>Ask yourself</span>
                    <span>{assistantQuestion}</span>
                  </div>
                </div>
              ) : null}

              {!isConceptClear && (latestWhyItMatters || latestRetryPrompt) ? (
                <div className="fd-feedback-grid">
                  {latestWhyItMatters ? (
                    <div>
                      <span>Why it matters</span>
                      <p>{latestWhyItMatters}</p>
                    </div>
                  ) : null}
                  {latestRetryPrompt ? (
                    <div>
                      <span>Try this</span>
                      <p>{latestRetryPrompt}</p>
                    </div>
                  ) : null}
                </div>
              ) : <div style={{ height: 20 }} />}

              {sessionImprovement || scoreChanged || sessionNextAction ? (
                <div className="fd-feedback-next">
                  {scoreChanged ? (
                    <span className="fd-mono">Clarity {scoreBeforeLatestAttempt} → {result.clarityScore}</span>
                  ) : null}
                  {sessionImprovement ? <span>{sessionImprovement}</span> : null}
                  <span><strong>Next:</strong> {sessionNextAction}</span>
                </div>
              ) : null}

              {latestAttempt ? (
                <details className="fd-details">
                  <summary>
                    <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                    Your attempt
                  </summary>
                  <p>{latestAttempt}</p>
                </details>
              ) : null}
            </section>
          ) : null}

          {isConceptClear && !isLoading ? (
            <section className="fd-callout is-success" aria-label="Concept clear">
              <h3>You can explain {selectedConcept} clearly.</h3>
              <p>Want it to stick? Explain it once more from memory, or move on.</p>
              <div className="fd-callout-actions">
                <button type="button" className="fd-btn fd-btn-dark fd-btn-md" onClick={handleChooseAnotherConcept}>
                  Choose another concept
                </button>
                <button type="button" className="fd-btn fd-btn-secondary fd-btn-md" onClick={handleTestMyselfAgain}>
                  Test myself again
                </button>
                <button type="button" className="fd-btn fd-btn-ghost fd-btn-md" onClick={handleAskFollowUp}>
                  Ask a follow-up
                </button>
              </div>
            </section>
          ) : null}

          {renderComposer(4)}
          {renderMessages()}
        </section>
      </main>
    );
  };

  function renderMessages() {
    return (
      <>
        {notice ? (
          <div className="fd-notice" role="status">
            <span>{notice}</span>
          </div>
        ) : null}
        {error ? (
          <div className="fd-notice is-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span>{error}</span>
          </div>
        ) : null}
        {voiceInputError ? (
          <div className="fd-notice is-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span>{voiceInputError}</span>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="fd fd-session">
      <header className="fd-session-header">
        <div>
          <a href={roomHref} className="fd-icon-btn is-plain" aria-label={room ? "Back to room" : "Back to study rooms"}>
            <ArrowLeft size={18} strokeWidth={1.8} />
          </a>
          <img className="fd-session-duck" src="/feynduckhead.png" alt="" width={26} height={26} />
          <nav aria-label="Breadcrumb" className="fd-crumbs">
            {selectedConcept && !isChoosingNextConcept ? (
              <>
                <a href={roomHref} className="fd-crumb-hide-sm">{roomTitle}</a>
                <span aria-hidden="true" className="fd-crumb-sep fd-crumb-hide-sm">/</span>
                <span className="fd-crumb-current" aria-current="page">{selectedConcept}</span>
              </>
            ) : (
              <span className="fd-crumb-current" aria-current="page">{roomTitle}</span>
            )}
          </nav>
        </div>
        <div>
          <button
            type="button"
            className="fd-icon-btn"
            aria-pressed={isSourcePanelOpen}
            aria-label={isSourcePanelOpen ? "Hide source panel" : "Show source panel"}
            title={isSourcePanelOpen ? "Hide source panel" : "Show source panel"}
            onClick={() => setIsSourcePanelOpen((current) => !current)}
          >
            <PanelLeft size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="fd-icon-btn"
            aria-pressed={isSupportPanelOpen}
            aria-label={isSupportPanelOpen ? "Hide support panel" : "Show support panel"}
            title={isSupportPanelOpen ? "Hide support panel" : "Show support panel"}
            onClick={() => setIsSupportPanelOpen((current) => !current)}
          >
            <PanelRight size={18} strokeWidth={1.8} />
          </button>
          <span aria-hidden="true" className="fd-header-divider" />
          <AccountMenu authUser={authUser} small />
        </div>
      </header>

      <div className="fd-session-body">
        {isSourcePanelOpen || isSupportPanelOpen ? (
          <button
            type="button"
            className="fd-session-scrim"
            aria-label="Close panels"
            tabIndex={-1}
            onClick={() => {
              setIsSourcePanelOpen(false);
              setIsSupportPanelOpen(false);
            }}
          />
        ) : null}
        {isSourcePanelOpen ? (
          <>
            {renderSourcePanel()}
            <div
              className={cn("fd-resize", isDraggingLeft && "is-active")}
              onPointerDown={(event) => {
                event.preventDefault();
                setIsDraggingLeft(true);
              }}
              onDoubleClick={() => setLeftWidth(clampPanelWidth("left", 320))}
              onKeyDown={(event) => resizeWithKeys("left", event)}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize source panel"
              aria-valuenow={leftWidth}
              tabIndex={0}
            />
          </>
        ) : null}

        {renderCenter()}

        {isSupportPanelOpen ? (
          <>
            <div
              className={cn("fd-resize", isDraggingRight && "is-active")}
              onPointerDown={(event) => {
                event.preventDefault();
                setIsDraggingRight(true);
              }}
              onDoubleClick={() => setRightWidth(clampPanelWidth("right", 360))}
              onKeyDown={(event) => resizeWithKeys("right", event)}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize support panel"
              aria-valuenow={rightWidth}
              tabIndex={0}
            />
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
              onConceptSelect={(title) => {
                selectConcept(title);
                if (isCompactLayout()) setIsSupportPanelOpen(false);
              }}
            />
          </>
        ) : null}
      </div>

    </div>
  );
}
