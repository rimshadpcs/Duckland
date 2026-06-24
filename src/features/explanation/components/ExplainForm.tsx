"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { GapResultPanel } from "@src/features/gap-analysis";
import { ArrowUp, CheckCircle2, Loader2, MessageSquareText, Mic, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  clearRoomSessionStateAction,
  saveRoomSessionStateAction,
  saveRoomSourceAction,
  startRoomConceptAction,
  updateRoomConceptProgressAction,
  updateRoomSelectedConceptAction,
} from "@src/app/study/actions";
import { cn } from "@src/lib/utils";
import { clampPanelWidth, getPanelWidth, savePanelWidth } from "@src/lib/storage/panelStorage";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { RoomConceptRow } from "@src/lib/repositories/study-path";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { Json } from "@src/types/database";
import type { ExplanationRequest, ExplanationResult } from "../types";

const initialRequest: ExplanationRequest = {
  notes: "",
  explanation: "",
};

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

type ConceptSuggestion = {
  title: string;
  description?: string;
};

type ConceptStatus = "not_started" | "in_progress" | "gap_found" | "improving" | "clear";

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
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  snapshot: ConceptTrackSnapshot;
};

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

function getConceptStatus(result: ExplanationResult | null, hasHistory: boolean): ConceptStatus {
  if (result?.status === "clear") return "clear";
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
  if (result.status === "clear") {
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
  if (result.status === "clear") {
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
  initialSource,
  initialSessionState,
  initialConcept,
  initialRoomConcepts = [],
  requestedRoomId,
}: {
  onRoomLoaded?: (title: string, subject: string) => void;
  initialRoom?: StudyRoomRow | null;
  initialSource?: SourceRow | null;
  initialSessionState?: Json | null;
  initialConcept?: RoomConceptRow | null;
  initialRoomConcepts?: RoomConceptRow[];
  requestedRoomId?: string | null;
}) {
  const [roomId] = useState<string | null>(initialRoom?.id || null);
  const [room, setRoom] = useState<StudyRoomRow | null>(initialRoom || null);
  const [source, setSource] = useState<SourceRow | null>(initialSource || null);
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
  const [sourceSavedAt, setSourceSavedAt] = useState<string | null>(initialSource?.updated_at || null);
  const [isSourceFreshlySaved, setIsSourceFreshlySaved] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [previousExplanations, setPreviousExplanations] = useState<string[]>([]);
  const [previousMainGaps, setPreviousMainGaps] = useState<string[]>([]);
  const [previousSocraticQuestions, setPreviousSocraticQuestions] = useState<string[]>([]);
  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [conceptSuggestions, setConceptSuggestions] = useState<ConceptSuggestion[]>([]);
  const [serverConcepts, setServerConcepts] = useState<RoomConceptRow[]>(initialRoomConcepts);
  const [activeServerConceptId, setActiveServerConceptId] = useState<string | null>(initialConcept?.id || null);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [studyToolsState, setStudyToolsState] = useState<Json | null>(null);
  const [conceptTracks, setConceptTracks] = useState<Record<string, RoomConceptTrack>>({});
  const [isChoosingNextConcept, setIsChoosingNextConcept] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
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

  const fetchConceptSuggestions = async (sourceMaterial: string) => {
    if (sourceMaterial.trim().length < 10) {
      setConceptSuggestions([]);
      setConceptsError(null);
      setConceptsLoading(false);
      return;
    }

    setConceptsLoading(true);
    setConceptsError(null);

    try {
      const response = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceMaterial }),
      });

      const payload = (await response.json()) as {
        concepts?: ConceptSuggestion[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "I couldn't generate suggestions, but you can still enter a concept below.");
      }

      setConceptSuggestions(
        Array.isArray(payload.concepts)
          ? payload.concepts.filter((concept) => concept.title?.trim()).slice(0, 6)
          : [],
      );
    } catch (caught) {
      setConceptSuggestions([]);
      setConceptsError(
        caught instanceof Error
          ? caught.message
          : "I couldn't generate suggestions, but you can still enter a concept below.",
      );
    } finally {
      setConceptsLoading(false);
    }
  };

  useEffect(() => {
    const sourceMaterial = initialSource?.content || "";
    const initialConceptTitle = initialConcept?.title || initialRoom?.selected_concept || null;
    setRequest((prev) => ({ ...prev, notes: sourceMaterial }));
    setSavedSourceMaterial(sourceMaterial);
    setSelectedConcept(initialConceptTitle);
    setActiveServerConceptId(initialConcept?.id || null);
    if (initialConceptTitle) {
      setHistory(createEmptyConceptSnapshot(initialConceptTitle).history);
    }
    if (sourceMaterial) void fetchConceptSuggestions(sourceMaterial);
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
    setConceptSuggestions([]);
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
    setIsSavingSource(true);
    setIsEditingNotes(false);
    resetEvaluationSession();

    const result = await saveRoomSourceAction({
      roomId,
      roomTitle: room.title,
      content: sourceMaterial,
    });

    if (!result.ok) {
      setError(result.error);
      setIsEditingNotes(true);
      setIsSavingSource(false);
      return;
    }

    const savedAt = new Date().toISOString();
    setSource((current) => ({
      id: result.data.sourceId,
      room_id: roomId,
      user_id: current?.user_id || room.user_id,
      source_type: "pasted_text",
      title: result.data.title,
      content: sourceMaterial,
      metadata: current?.metadata || {},
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: savedAt,
    }));
    setSavedSourceMaterial(sourceMaterial);
    setSourceSavedAt(savedAt);
    setIsSourceFreshlySaved(true);
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
    setRequest(prev => ({ ...prev, notes: sourceMaterial }));
    setIsSavingSource(false);
    setConceptsLoading(true);
    setConceptsError(null);
    void fetch("/api/study-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        source: sourceMaterial,
        sourceTitle: result.data.title,
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as { concepts?: RoomConceptRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not build learning path.");
        if (Array.isArray(payload.concepts)) {
          setServerConcepts(payload.concepts);
          setConceptSuggestions(
            payload.concepts.slice(0, 6).map((concept) => ({
              title: concept.title,
              description: concept.description || undefined,
            })),
          );
        }
      })
      .catch((caught) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Study] learning path generation failed", caught);
        }
        setConceptsError("We couldn’t create your learning path yet. You can still enter a concept below.");
        void fetchConceptSuggestions(sourceMaterial);
      })
      .finally(() => {
        setConceptsLoading(false);
      });
    window.setTimeout(() => setIsSourceFreshlySaved(false), 3200);
    if (onRoomLoaded) {
      onRoomLoaded(result.data.roomTitle || room.title, room.selected_concept || room.description || "");
    }
  };

  const handleCancelNotesEdit = () => {
    setRequest(prev => ({ ...prev, notes: savedSourceMaterial }));
    setIsEditingNotes(false);
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
      sourceUpdatedAt: source?.updated_at || initialSource?.updated_at || null,
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
    source?.updated_at,
    initialSource?.updated_at,
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
    const status = getConceptStatus(result, cleanHistory.length > 0);
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

    const currentTracks = saveCurrentConceptTrack();
    const conceptId = getConceptId(nextConcept);
    const existingTrack = currentTracks[conceptId];
    const serverConcept = serverConcepts.find((item) => getConceptId(item.title) === conceptId) || null;
    setActiveServerConceptId(serverConcept?.id || null);

    if (existingTrack) {
      restoreConceptTrack(existingTrack);
      if (serverConcept?.id && roomId) void startRoomConceptAction(roomId, serverConcept.id);
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

    setConceptTracks({
      ...currentTracks,
      [conceptId]: nextTrack,
    });
    setSelectedConcept(nextConcept);
    if (roomId) {
      void updateRoomSelectedConceptAction(roomId, nextConcept);
      if (serverConcept?.id) void startRoomConceptAction(roomId, serverConcept.id);
    }
    setResult(null);
    setError(null);
    setNotice(null);
    setPreviousExplanations([]);
    setPreviousMainGaps([]);
    setPreviousSocraticQuestions([]);
    setResolvedGaps([]);
    setStudyToolsState(null);
    setHistory(emptySnapshot.history);
    setIsChoosingNextConcept(false);
    setRequest(prev => ({ ...prev, explanation: "" }));

    if (onRoomLoaded) {
      onRoomLoaded(room ? room.title : "Quick explain", nextConcept);
    }
  };

  const handleChooseAnotherConcept = () => {
    saveCurrentConceptTrack();
    setIsChoosingNextConcept(true);
    setError(null);
    setNotice(null);
    if (!conceptSuggestions.length && savedSourceMaterial) {
      void fetchConceptSuggestions(savedSourceMaterial);
    }
  };

  const handleAskFollowUp = () => {
    setIsChoosingNextConcept(false);
    window.setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 0);
  };

  const handleReviewThisConcept = () => {
    setIsChoosingNextConcept(false);
    setNotice("Quiz and flashcards are ready in the study panel.");
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
    setRequest(prev => ({ ...prev, explanation: "" }));

    if (onRoomLoaded) {
      onRoomLoaded(room ? room.title : "Quick explain", room?.description || "");
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

    if (!selectedConcept) {
      selectConcept(currentExplanation);
      return;
    }

    submitLockRef.current = true;
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
          previousExplanations,
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
        });
        setServerConcepts((current) =>
          current.map((concept) =>
            concept.id === activeServerConceptId
              ? {
                  ...concept,
                  status: nextStatus,
                  latest_clarity_score:
                    resultPayload.status === "topic_mismatch" ? concept.latest_clarity_score : resultPayload.clarityScore,
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

  const hasSavedMaterial = !!savedSourceMaterial.trim() && !isEditingNotes;
  const isConceptClear = result?.status === "clear" && (result.clarityScore ?? 0) >= 90;
  const conceptSuggestionOptions = conceptSuggestions.filter(
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
    ...conceptSuggestions
      .filter((concept) => !conceptTracks[getConceptId(concept.title)])
      .filter((concept) => !serverConcepts.some((item) => getConceptId(item.title) === getConceptId(concept.title)))
      .map((concept): RoomConceptTrack => ({
        id: getConceptId(concept.title),
        roomId,
        title: concept.title,
        status: "not_started",
        latestClarityScore: null,
        startedAt: null,
        completedAt: null,
        lastActivityAt: null,
        snapshot: createEmptyConceptSnapshot(concept.title),
      })),
  ].filter((concept, index, all) => (
    all.findIndex((item) => item.id === concept.id) === index
  ));
  const conversationMessages = getRenderableMessages(
    history,
    result,
    isLoading,
    hasSavedMaterial,
    selectedConcept,
  );
  const composerPlaceholder = !hasSavedMaterial
    ? "Add study material first..."
    : !selectedConcept
      ? "Enter a concept or topic..."
      : isConceptClear
        ? `Ask a follow-up about ${selectedConcept}...`
      : result
        ? `Re-explain ${selectedConcept}...`
        : `Explain ${selectedConcept}...`;

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--ink)' }}>{room ? room.title : "Quick explain"}</h4>
              <div className="source-meta">
                {hasSavedMaterial
                  ? `Pasted text · ${isSourceFreshlySaved ? "Saved just now" : sourceSavedAt ? "Saved" : "Saved"}`
                  : room?.description || "No material yet"}
              </div>
              {selectedConcept && (
                <div className="current-focus-pill">
                  <span>Current focus</span>
                  <strong>{selectedConcept}</strong>
                </div>
              )}
            </div>
          </div>

          {!request.notes && !isEditingNotes ? (
            <div className="empty-insights" style={{ alignItems: 'flex-start', textAlign: 'left', padding: '0', height: 'auto' }}>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--ink)' }}>No study material added yet</h4>
              <p style={{ marginBottom: '24px' }}>Add source material for Feynduck to use as the source.</p>
              <button 
                className="app-start-btn" 
                style={{ background: 'var(--duck)', color: '#1a1612', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setIsEditingNotes(true)}
              >
                Add material
              </button>
              <p style={{ fontSize: '0.75rem', marginTop: '12px', opacity: 0.6 }}>PDF upload coming later</p>
            </div>
          ) : isEditingNotes ? (
            <div>
              <textarea
                className="notes-textarea-minimal"
                placeholder="Add your study material here..."
                value={request.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={15}
                style={{ width: '100%', minWidth: '220px', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="source-action-btn"
                  onClick={handleCancelNotesEdit}
                  disabled={isSavingSource}
                >
                  Cancel
                </button>
                <button
                  className="source-action-btn source-action-btn-primary"
                  onClick={handleSaveNotes}
                  disabled={isSavingSource}
                >
                  {isSavingSource ? "Saving..." : "Save material"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="metadata-pills">
                <span className="metadata-pill">{source?.title || "Source material"}</span>
              </div>

              <div style={{ marginTop: '24px', position: 'relative' }}>
                <div className="notes-preview-card" style={{ whiteSpace: 'pre-wrap' }}>
                  {request.notes}
                </div>
              </div>
              <div className="source-actions">
                <button className="source-action-btn" onClick={() => setIsEditingNotes(true)}>Edit source</button>
                {selectedConcept && (
                  <button className="source-action-btn" onClick={handleChangeTopic}>Change topic</button>
                )}
              </div>
            </>
          )}
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

      {/* Center Panel: Conversation */}
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
        
        <div className="conversation-area" ref={conversationRef}>
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
                  <span>Finding the next concepts in your material...</span>
                </div>
              ) : null}
              {!conceptsLoading && conceptsError ? (
                <div className="concept-error">{conceptsError}</div>
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
            <>
              <div className="conversation-kicker">Conversation</div>
              {conversationMessages.map((msg) => {
                const content = msg.content?.trim() || "Looking for the missing link...";
                const visualRole = msg.role === "assistant" ? "assistant" : "student";
                const avatar = (
                  <div className="avatar">
                    {msg.role === "assistant" ? (
                      <img src="/feynduckhead.png" alt="Duck" />
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>You</span>
                    )}
                  </div>
                );

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "message",
                      visualRole,
                      msg.kind === "loading" && "typing",
                      msg.kind === "question" && "question",
                    )}
                  >
                    {msg.role === "assistant" ? avatar : null}
                    <div className="message-content">
                      <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.kind === "loading" ? (
                          <span aria-live="polite">{content}</span>
                        ) : (
                          content
                        )}
                      </div>
                    </div>
                    {msg.role === "user" ? avatar : null}
                  </div>
                );
              })}
              {isConceptClear && selectedConcept ? (
                <div className="concept-complete-card">
                  <div className="concept-complete-icon"><CheckCircle2 size={22} /></div>
                  <div>
                    <h3>You can explain {selectedConcept} clearly.</h3>
                    <p>
                      {result.chatMessage ||
                        result.whyItMatters ||
                        "You connected the central mechanism clearly enough to move on or review it later."}
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
                      <button type="button" className="source-action-btn" onClick={handleReviewThisConcept}>
                        Review this concept
                      </button>
                      <button type="button" className="source-action-btn" onClick={handleAskFollowUp}>
                        Ask a follow-up
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {hasSavedMaterial && !selectedConcept && (
                <div className="concept-suggestions" aria-label="Suggested concepts">
                  {conceptsLoading && (
                    <div className="concept-loading" aria-live="polite">
                      <Loader2 className="icon-spin" size={16} />
                      <span>Finding concepts in your material...</span>
                    </div>
                  )}
                  {!conceptsLoading && conceptsError && (
                    <div className="concept-error">{conceptsError}</div>
                  )}
                  {!conceptsLoading && conceptSuggestions.map((concept) => (
                    <button
                      key={concept.title}
                      type="button"
                      className="concept-chip"
                      onClick={() => selectConcept(concept.title)}
                      title={concept.description}
                    >
                      {concept.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="concept-chip"
                    onClick={focusCustomConceptInput}
                    disabled={conceptsLoading}
                  >
                    Other
                  </button>
                </div>
              )}
              {toastMessage && <div className="app-toast" role="status">{toastMessage}</div>}
              {notice && <div className="app-notice">{notice}</div>}
              {error && <div className="app-error">{error}</div>}
            </>
          )}
        </div>

        <div className={cn("composer-container", isConceptClear && "secondary")}>
          <div className="composer-label-icon">
            <MessageSquareText size={14} />
            <span>{selectedConcept ? "Your explanation" : "Concept to study"}</span>
          </div>
          <div className={`composer-wrapper ${isLoading ? "loading" : ""}`}>
            <textarea
              ref={composerTextareaRef}
              className="composer-textarea"
              placeholder={composerPlaceholder}
              value={request.explanation}
              onChange={(e) => updateField("explanation", e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={!hasSavedMaterial}
            />
            <div className="composer-actions">
              <button
                className="composer-mic-btn"
                type="button"
                aria-label="Explain by voice"
                disabled={!hasSavedMaterial}
              >
                <Mic size={22} />
              </button>
              <button
                className="composer-send-btn"
                onClick={handleSubmit}
                disabled={isLoading || !request.explanation.trim() || !hasSavedMaterial}
                aria-label="Send explanation"
              >
                {isLoading ? (
                  <Loader2 className="icon-spin" size={20} />
                ) : (
                  <ArrowUp size={20} />
                )}
              </button>
            </div>
          </div>
          <p className="composer-hint">
            <span className="kb-shortcut">Cmd + Enter to send</span>
          </p>
        </div>
      </main>

      <div
        className={cn("resize-handle", isDraggingRight && "active")}
        onPointerDown={(e) => { e.preventDefault(); setIsDraggingRight(true); }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize session insights panel"
      />

      {/* Right Panel: Insights */}
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
        concepts={panelConcepts.map((concept) => ({
          id: concept.id,
          title: concept.title,
          status: concept.status,
          latestClarityScore: concept.latestClarityScore,
        }))}
        activeConceptId={selectedConcept ? getConceptId(selectedConcept) : null}
        onConceptSelect={selectConcept}
      />
    </div>
  );
}
