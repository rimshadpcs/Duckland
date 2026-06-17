"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { GapResultPanel } from "@src/features/gap-analysis";
import { ArrowUp, Loader2, MessageSquareText, Mic, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { saveRoomSourceAction, updateRoomSelectedConceptAction } from "@src/app/study/actions";
import { cn } from "@src/lib/utils";
import { clampPanelWidth, getPanelWidth, savePanelWidth } from "@src/lib/storage/panelStorage";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
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
  requestedRoomId,
}: {
  onRoomLoaded?: (title: string, subject: string) => void;
  initialRoom?: StudyRoomRow | null;
  initialSource?: SourceRow | null;
  requestedRoomId?: string | null;
}) {
  const [roomId] = useState<string | null>(initialRoom?.id || null);
  const [room, setRoom] = useState<StudyRoomRow | null>(initialRoom || null);
  const [source, setSource] = useState<SourceRow | null>(initialSource || null);
  const [roomStatus] = useState<"found" | "not_found" | "quick">(
    initialRoom ? "found" : requestedRoomId ? "not_found" : "quick",
  );
  const [request, setRequest] = useState<ExplanationRequest>(initialRequest);
  const [savedSourceMaterial, setSavedSourceMaterial] = useState("");
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [previousExplanations, setPreviousExplanations] = useState<string[]>([]);
  const [previousMainGaps, setPreviousMainGaps] = useState<string[]>([]);
  const [previousSocraticQuestions, setPreviousSocraticQuestions] = useState<string[]>([]);
  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);
  const [conceptSuggestions, setConceptSuggestions] = useState<ConceptSuggestion[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setRequest((prev) => ({ ...prev, notes: sourceMaterial }));
    setSavedSourceMaterial(sourceMaterial);
    setSelectedConcept(initialRoom?.selected_concept || null);
    if (sourceMaterial) void fetchConceptSuggestions(sourceMaterial);
    if (onRoomLoaded) {
      onRoomLoaded(initialRoom?.title || "Quick explain", initialRoom?.selected_concept || initialRoom?.description || "");
    }
  }, []);

  const resetEvaluationSession = () => {
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
      return;
    }

    setSource((current) => ({
      id: result.data.sourceId,
      room_id: roomId,
      user_id: current?.user_id || room.user_id,
      source_type: "pasted_text",
      title: result.data.title,
      content: sourceMaterial,
      metadata: current?.metadata || {},
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    setSavedSourceMaterial(sourceMaterial);
    setRoom((current) =>
      current
        ? {
            ...current,
            title: result.data.roomTitle || current.title,
            status: "in_progress",
            last_activity_at: new Date().toISOString(),
          }
        : current,
    );
    setRequest(prev => ({ ...prev, notes: sourceMaterial }));
    setNotice("Material saved");
    void fetchConceptSuggestions(sourceMaterial);
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

  const [history, setHistory] = useState<ConversationMessage[]>([]);

  const conversationRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [history, result]);

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

    const selectionId = createMessageId("concept");
    setSelectedConcept(nextConcept);
    if (roomId) {
      void updateRoomSelectedConceptAction(roomId, nextConcept);
    }
    setResult(null);
    setError(null);
    setNotice(null);
    setPreviousExplanations([]);
    setPreviousMainGaps([]);
    setPreviousSocraticQuestions([]);
    setResolvedGaps([]);
    setHistory([
      conceptQuestionMessage,
      {
        id: `${selectionId}-student`,
        role: "user",
        content: nextConcept,
      },
      {
        id: `${selectionId}-assistant`,
        role: "assistant",
        kind: "feedback",
        content: `Great — explain ${nextConcept} in your own words.`,
      },
    ]);
    setRequest(prev => ({ ...prev, explanation: "" }));

    if (onRoomLoaded) {
      onRoomLoaded(room ? room.title : "Quick explain", nextConcept);
    }
  };

  const focusCustomConceptInput = () => {
    setRequest(prev => ({ ...prev, explanation: "" }));
    showToast("Type your concept in the chat box below.");
    window.setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 0);
  };

  const handleChangeTopic = () => {
    const shouldReset = window.confirm("Change topic? This will clear the current conversation and feedback, but keep your source material.");
    if (!shouldReset) return;

    setSelectedConcept(null);
    setResult(null);
    setError(null);
    setNotice(null);
    setPreviousExplanations([]);
    setPreviousMainGaps([]);
    setPreviousSocraticQuestions([]);
    setResolvedGaps([]);
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
      content: "Thinking about your explanation...",
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
              <div className="source-meta">{hasSavedMaterial ? "Study material added" : room?.description || "No material yet"}</div>
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
                >
                  Cancel
                </button>
                <button
                  className="source-action-btn source-action-btn-primary"
                  onClick={handleSaveNotes}
                >
                  Save material
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
          ) : (
            <>
              <div className="conversation-kicker">Conversation</div>
              {conversationMessages.map((msg) => {
                const content = msg.content?.trim() || "Thinking about your explanation...";
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

        <div className="composer-container">
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
      />
    </div>
  );
}
