"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import type { GapAnalysisResult } from "../types";
import type { Json } from "@src/types/database";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import { cn } from "@src/lib/utils";

type StudyPanelTab = "insights" | "quiz" | "flashcards";

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  focus: string;
};

type Flashcard = {
  id: string;
  front: string;
  back: string;
  focus: string;
  priority: "high" | "medium" | "low";
};

type FlashcardReviewState = "understood" | "needs_review";

type StudyToolsSnapshot = {
  activeTab?: StudyPanelTab;
  quizQuestions?: QuizQuestion[];
  quizIndex?: number;
  selectedAnswerIndex?: number | null;
  checkedAnswerIndex?: number | null;
  flashcards?: Flashcard[];
  cardIndex?: number;
  isCardRevealed?: boolean;
  flashcardReviewState?: Record<string, FlashcardReviewState>;
};

type ConceptStatus = "not_started" | "explaining" | "gap_found" | "improving" | "clear" | "needs_recall" | "due_for_review";

type PanelConcept = {
  id: string;
  title: string;
  status: ConceptStatus;
  latestClarityScore: number | null;
};

type GapResultPanelProps = {
  result: GapAnalysisResult | null;
  isLoading?: boolean;
  width?: number;
  isDragging?: boolean;
  hasNotes?: boolean;
  hasSelectedConcept?: boolean;
  sourceMaterial?: string;
  selectedConcept?: string | null;
  explanationAttempts?: string[];
  sessionId?: string;
  initialStudyToolsState?: Json | null;
  onStudyToolsStateChange?: (state: Json | null) => void;
  concepts?: PanelConcept[];
  activeConceptId?: string | null;
  isConceptSwitching?: boolean;
  onConceptSelect?: (title: string) => void;
};

const CLEAR_THRESHOLD = 90;
const SWIPE_THRESHOLD = 64;

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return fallback;
}

function getLatestEvaluation(result: GapAnalysisResult | null) {
  if (!result) return null;

  return {
    status: result.status,
    clarityScore: result.clarityScore,
    mainGap: result.mainGap ?? result.gapSummary ?? null,
    socraticQuestion: result.socraticQuestion,
    resolvedGaps: result.resolvedGaps,
  };
}

function parseStudyToolsSnapshot(value: unknown): StudyToolsSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as StudyToolsSnapshot;

  return {
    activeTab: snapshot.activeTab === "insights" || snapshot.activeTab === "quiz" || snapshot.activeTab === "flashcards"
      ? snapshot.activeTab
      : undefined,
    quizQuestions: Array.isArray(snapshot.quizQuestions) ? snapshot.quizQuestions : [],
    quizIndex: typeof snapshot.quizIndex === "number" ? snapshot.quizIndex : 0,
    selectedAnswerIndex: typeof snapshot.selectedAnswerIndex === "number" ? snapshot.selectedAnswerIndex : null,
    checkedAnswerIndex: typeof snapshot.checkedAnswerIndex === "number" ? snapshot.checkedAnswerIndex : null,
    flashcards: Array.isArray(snapshot.flashcards) ? snapshot.flashcards : [],
    cardIndex: typeof snapshot.cardIndex === "number" ? snapshot.cardIndex : 0,
    isCardRevealed: Boolean(snapshot.isCardRevealed),
    flashcardReviewState: snapshot.flashcardReviewState && typeof snapshot.flashcardReviewState === "object"
      ? snapshot.flashcardReviewState
      : {},
  };
}

function SupportEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="fd-support-empty">
      <span>{title}</span>
      <span>{body}</span>
    </div>
  );
}

function BusyBlock({ label, lines = 2 }: { label: string; lines?: number }) {
  return (
    <div className="fd-busy-card" aria-busy="true" style={{ border: "none", padding: 0 }}>
      <div className="fd-busy">
        <span className="fd-spinner" aria-hidden="true" />
        {label}
      </div>
      <div className="fd-busy-lines fd-pulse" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className="fd-skeleton" style={{ width: `${[82, 64, 74, 58][index % 4]}%` }} />
        ))}
      </div>
    </div>
  );
}

function ToolError({ message }: { message: string }) {
  return (
    <div className="fd-notice is-error" role="alert">
      <AlertCircle size={16} strokeWidth={1.8} />
      <span>{message}</span>
    </div>
  );
}

function PagerButtons({
  label,
  index,
  total,
  onPrevious,
  onNext,
}: {
  label: string;
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <button type="button" className="fd-icon-btn fd-icon-btn-sm" aria-label={`Previous ${label}`} disabled={index === 0} onClick={onPrevious}>
        <ArrowLeft size={14} strokeWidth={2} />
      </button>
      <button type="button" className="fd-icon-btn fd-icon-btn-sm" aria-label={`Next ${label}`} disabled={index >= total - 1} onClick={onNext}>
        <ArrowRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function GapResultPanel({
  result,
  isLoading = false,
  width,
  isDragging = false,
  hasNotes = true,
  hasSelectedConcept = true,
  sourceMaterial = "",
  selectedConcept = null,
  explanationAttempts = [],
  sessionId = "quick",
  initialStudyToolsState = null,
  onStudyToolsStateChange,
  concepts = [],
  activeConceptId = null,
  isConceptSwitching = false,
  onConceptSelect,
}: GapResultPanelProps) {
  const panelStyle = width ? { width: `${width}px` } : undefined;

  const [activeTab, setActiveTab] = useState<StudyPanelTab>("insights");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [checkedAnswerIndex, setCheckedAnswerIndex] = useState<number | null>(null);

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardRevealed, setIsCardRevealed] = useState(false);
  const [flashcardReviewState, setFlashcardReviewState] = useState<Record<string, FlashcardReviewState>>({});
  const [isTabPending, startTabTransition] = useTransition();
  const hydratedStudyToolsKeyRef = useRef<string | null>(null);

  const latestEvaluation = useMemo(() => getLatestEvaluation(result), [result]);
  const hasCompletedExplanation = Boolean(result && selectedConcept && sourceMaterial);
  const storageSuffix = `${sessionId}_${selectedConcept || "none"}`.replace(/[^a-z0-9_-]+/gi, "_");
  const quizStorageKey = `feynduck_quiz_${storageSuffix}`;
  const flashcardsStorageKey = `feynduck_flashcards_${storageSuffix}`;
  const topicMismatchNotice = result?.status === "topic_mismatch" && selectedConcept
    ? `Your last explanation was off-topic. Study tools will remain focused on ${selectedConcept}.`
    : null;

  useEffect(() => {
    setQuizQuestions([]);
    setQuizError(null);
    setQuizIndex(0);
    setSelectedAnswerIndex(null);
    setCheckedAnswerIndex(null);
    setFlashcards([]);
    setFlashcardsError(null);
    setCardIndex(0);
    setIsCardRevealed(false);
    setFlashcardReviewState({});
  }, [selectedConcept, sourceMaterial]);

  useEffect(() => {
    const hydrationKey = `${sessionId}_${selectedConcept || "none"}`;
    if (hydratedStudyToolsKeyRef.current === hydrationKey) return;
    hydratedStudyToolsKeyRef.current = hydrationKey;

    try {
      const initialSnapshot = parseStudyToolsSnapshot(initialStudyToolsState);
      if (initialSnapshot) {
        if (initialSnapshot.activeTab) setActiveTab(initialSnapshot.activeTab);
        setQuizQuestions(initialSnapshot.quizQuestions || []);
        setQuizIndex(
          initialSnapshot.quizQuestions?.length
            ? Math.min(initialSnapshot.quizIndex || 0, initialSnapshot.quizQuestions.length - 1)
            : 0,
        );
        setSelectedAnswerIndex(initialSnapshot.selectedAnswerIndex ?? null);
        setCheckedAnswerIndex(initialSnapshot.checkedAnswerIndex ?? null);
        setFlashcards(initialSnapshot.flashcards || []);
        setCardIndex(
          initialSnapshot.flashcards?.length
            ? Math.min(initialSnapshot.cardIndex || 0, initialSnapshot.flashcards.length - 1)
            : 0,
        );
        setIsCardRevealed(Boolean(initialSnapshot.isCardRevealed));
        setFlashcardReviewState(initialSnapshot.flashcardReviewState || {});
        return;
      }

      const storedQuiz = window.localStorage.getItem(quizStorageKey);
      if (storedQuiz) {
        const parsed = JSON.parse(storedQuiz) as {
          questions?: QuizQuestion[];
          index?: number;
        };
        if (Array.isArray(parsed.questions)) {
          setQuizQuestions(parsed.questions);
          setQuizIndex(typeof parsed.index === "number" ? Math.min(parsed.index, parsed.questions.length - 1) : 0);
        }
      }

      const storedFlashcards = window.localStorage.getItem(flashcardsStorageKey);
      if (storedFlashcards) {
        const parsed = JSON.parse(storedFlashcards) as {
          cards?: Flashcard[];
          index?: number;
          reviewState?: Record<string, FlashcardReviewState>;
        };
        if (Array.isArray(parsed.cards)) {
          setFlashcards(parsed.cards);
          setCardIndex(typeof parsed.index === "number" ? Math.min(parsed.index, parsed.cards.length - 1) : 0);
          setFlashcardReviewState(parsed.reviewState || {});
        }
      }
    } catch {
      window.localStorage.removeItem(quizStorageKey);
      window.localStorage.removeItem(flashcardsStorageKey);
    }
  }, [quizStorageKey, flashcardsStorageKey, initialStudyToolsState, selectedConcept, sessionId]);

  useEffect(() => {
    const hasStudyTools = quizQuestions.length > 0 || flashcards.length > 0;
    if (!hasStudyTools) {
      onStudyToolsStateChange?.(null);
      return;
    }

    onStudyToolsStateChange?.({
      activeTab,
      quizQuestions,
      quizIndex,
      selectedAnswerIndex,
      checkedAnswerIndex,
      flashcards,
      cardIndex,
      isCardRevealed,
      flashcardReviewState,
    } as Json);
  }, [
    activeTab,
    quizQuestions,
    quizIndex,
    selectedAnswerIndex,
    checkedAnswerIndex,
    flashcards,
    cardIndex,
    isCardRevealed,
    flashcardReviewState,
    onStudyToolsStateChange,
  ]);

  useEffect(() => {
    if (!quizQuestions.length) return;
    window.localStorage.setItem(quizStorageKey, JSON.stringify({ questions: quizQuestions, index: quizIndex }));
  }, [quizQuestions, quizIndex, quizStorageKey]);

  useEffect(() => {
    if (!flashcards.length) return;
    window.localStorage.setItem(
      flashcardsStorageKey,
      JSON.stringify({ cards: flashcards, index: cardIndex, reviewState: flashcardReviewState }),
    );
  }, [flashcards, cardIndex, flashcardReviewState, flashcardsStorageKey]);

  const generateQuiz = async () => {
    if (!selectedConcept || !sourceMaterial || !latestEvaluation) return;

    const endTiming = startInteractionTiming("quiz-generation");
    setQuizLoading(true);
    setQuizError(null);
    setSelectedAnswerIndex(null);
    setCheckedAnswerIndex(null);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMaterial,
          selectedConcept,
          explanationAttempts,
          latestEvaluation,
        }),
      });
      const payload = (await response.json()) as { questions?: QuizQuestion[]; error?: string };

      if (!response.ok || !Array.isArray(payload.questions)) {
        throw new Error(getErrorMessage(payload, "Could not generate a quiz."));
      }

      setQuizQuestions(payload.questions);
      setQuizIndex(0);
    } catch (caught) {
      setQuizQuestions([]);
      setQuizError(caught instanceof Error ? caught.message : "Could not generate a quiz.");
    } finally {
      setQuizLoading(false);
      endTiming();
    }
  };

  const generateFlashcards = async () => {
    if (!selectedConcept || !sourceMaterial || !latestEvaluation) return;

    const endTiming = startInteractionTiming("flashcard-generation");
    setFlashcardsLoading(true);
    setFlashcardsError(null);
    setIsCardRevealed(false);
    setFlashcardReviewState({});

    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMaterial,
          selectedConcept,
          explanationAttempts,
          latestEvaluation: {
            status: latestEvaluation.status,
            clarityScore: latestEvaluation.clarityScore,
            mainGap: latestEvaluation.mainGap,
            resolvedGaps: latestEvaluation.resolvedGaps,
          },
        }),
      });
      const payload = (await response.json()) as { cards?: Flashcard[]; error?: string };

      if (!response.ok || !Array.isArray(payload.cards)) {
        throw new Error(getErrorMessage(payload, "Could not generate flashcards."));
      }

      setFlashcards(payload.cards);
      setCardIndex(0);
    } catch (caught) {
      setFlashcards([]);
      setFlashcardReviewState({});
      setFlashcardsError(caught instanceof Error ? caught.message : "Could not generate flashcards.");
    } finally {
      setFlashcardsLoading(false);
      endTiming();
    }
  };

  const currentQuestion = quizQuestions[quizIndex];
  const currentCard = flashcards[cardIndex];
  const isAnswerChecked = checkedAnswerIndex !== null;
  const currentCardReviewState = currentCard ? flashcardReviewState[currentCard.id] : undefined;
  const activeConcept = concepts.find((concept) => concept.id === activeConceptId);
  const reviewedFlashcardCount = flashcards.filter((card) => flashcardReviewState[card.id]).length;
  const understoodFlashcardCount = flashcards.filter((card) => flashcardReviewState[card.id] === "understood").length;
  const needsReviewFlashcardCount = flashcards.filter((card) => flashcardReviewState[card.id] === "needs_review").length;
  const isFlashcardRoundComplete = flashcards.length > 0 && reviewedFlashcardCount === flashcards.length;

  const markFlashcard = (state: FlashcardReviewState) => {
    if (!currentCard) return;

    setFlashcardReviewState((current) => ({
      ...current,
      [currentCard.id]: state,
    }));

    if (cardIndex < flashcards.length - 1) {
      setCardIndex((current) => Math.min(flashcards.length - 1, current + 1));
      setIsCardRevealed(false);
    }
  };

  const [dragX, setDragX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const toolsReady = hasCompletedExplanation || quizQuestions.length > 0 || flashcards.length > 0;
  const visibleTab: StudyPanelTab = toolsReady ? activeTab : "insights";

  const handleTabChange = (tab: StudyPanelTab) => {
    startTabTransition(() => setActiveTab(tab));
  };

  const goToQuestion = (index: number) => {
    setQuizIndex(Math.max(0, Math.min(quizQuestions.length - 1, index)));
    setSelectedAnswerIndex(null);
    setCheckedAnswerIndex(null);
  };

  const goToCard = (index: number) => {
    setCardIndex(Math.max(0, Math.min(flashcards.length - 1, index)));
    setIsCardRevealed(false);
  };

  const handleCardPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!isSwiping) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        swipeStartRef.current = null;
        return;
      }
      setIsSwiping(true);
    }
    setDragX(dx);
  };

  const handleCardPointerEnd = () => {
    if (isSwiping) {
      if (dragX <= -SWIPE_THRESHOLD && cardIndex < flashcards.length - 1) goToCard(cardIndex + 1);
      else if (dragX >= SWIPE_THRESHOLD && cardIndex > 0) goToCard(cardIndex - 1);
    }
    swipeStartRef.current = null;
    setIsSwiping(false);
    setDragX(0);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToCard(cardIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToCard(cardIndex - 1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setIsCardRevealed((current) => !current);
    }
  };

  const weakSpots = concepts
    .filter((concept) => concept.status === "gap_found" || concept.status === "improving")
    .sort((first, second) => (first.latestClarityScore ?? 0) - (second.latestClarityScore ?? 0));
  const dueForRecall = concepts.filter((concept) => concept.status === "due_for_review");
  const conceptScore = typeof result?.clarityScore === "number" ? result.clarityScore : activeConcept?.latestClarityScore ?? null;
  const isConceptClear = result
    ? result.status === "clear" && (result.clarityScore ?? 0) >= CLEAR_THRESHOLD
    : activeConcept?.status === "clear" || activeConcept?.status === "needs_recall" || activeConcept?.status === "due_for_review";
  const attempts = explanationAttempts.length;
  const attemptLabel = `${attempts} attempt${attempts === 1 ? "" : "s"}`;

  const renderProgress = () => {
    if (!hasNotes) {
      return <SupportEmpty title="Waiting for study material" body="Quizzes and flashcards are built from the gaps in your explanations." />;
    }
    if (!hasSelectedConcept) {
      return <SupportEmpty title="Pick a concept to begin" body="Your clarity score, quiz and flashcards appear after your first explanation." />;
    }

    return (
      <div className={cn("fd-support-body", isTabPending && "is-pending")} key="progress" style={{ gap: 20 }}>
        <div className="fd-support-group">
          <span>This concept</span>
          <div className="fd-stat-card">
            <div>
              <span>Clarity</span>
              <span className={cn("fd-stat-big", isLoading && "fd-pulse")}>{isLoading ? "…" : conceptScore ?? "—"}</span>
            </div>
            <div className={cn("fd-bar", isConceptClear ? "is-success" : "is-amber")} aria-hidden="true">
              <span style={{ width: `${isLoading ? 0 : conceptScore ?? 0}%` }} />
            </div>
            <span className="fd-muted" style={{ fontSize: 12 }}>
              {isLoading
                ? "Checking your latest explanation…"
                : conceptScore == null
                  ? "Explain it once to get a clarity score."
                  : isConceptClear
                    ? `${attemptLabel} · marked clear`
                    : `${attemptLabel} · reach ${CLEAR_THRESHOLD} to mark it clear`}
            </span>
          </div>
        </div>

        {topicMismatchNotice ? <div className="fd-notice is-amber">{topicMismatchNotice}</div> : null}

        {dueForRecall.length ? (
          <div className="fd-support-group">
            <span>Due for recall</span>
            {dueForRecall.map((concept) => (
              <button
                key={concept.id}
                type="button"
                className="fd-weak-item"
                aria-current={concept.id === activeConceptId ? "true" : undefined}
                onClick={() => onConceptSelect?.(concept.title)}
              >
                <span>{concept.title}</span>
                <span className="fd-dot" data-status="due_for_review" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="fd-support-group">
          <span>Weak spots in this room</span>
          {weakSpots.length ? (
            weakSpots.map((concept) => (
              <button
                key={concept.id}
                type="button"
                className="fd-weak-item"
                aria-current={concept.id === activeConceptId ? "true" : undefined}
                onClick={() => onConceptSelect?.(concept.title)}
              >
                <span>{concept.title}</span>
                <span className="fd-path-score">{concept.latestClarityScore ?? "—"}</span>
              </button>
            ))
          ) : (
            <span className="fd-muted" style={{ fontSize: 13 }}>No weak spots yet. They show up as you explain concepts.</span>
          )}
        </div>
      </div>
    );
  };

  const renderQuiz = () => (
    <div className={cn("fd-support-body", isTabPending && "is-pending")} key="quiz">
      <div className="fd-support-row">
        <span className="fd-eyebrow">Built from your gaps</span>
        {quizQuestions.length && !quizLoading ? <span className="fd-kicker">{quizIndex + 1} / {quizQuestions.length}</span> : null}
      </div>
      {topicMismatchNotice ? <div className="fd-notice is-amber">{topicMismatchNotice}</div> : null}

      {!quizQuestions.length && !quizLoading ? (
        <div className="fd-tool-generate">
          <p>Generate 3–5 questions on {selectedConcept || "this concept"}, focused on your latest gaps.</p>
          {quizError ? <ToolError message={quizError} /> : null}
          <button type="button" className="fd-btn fd-btn-accent" onClick={generateQuiz} disabled={!hasCompletedExplanation}>
            Generate quiz
          </button>
        </div>
      ) : null}

      {quizLoading ? <BusyBlock label="Building a quiz around your weak spots…" lines={3} /> : null}

      {currentQuestion && !quizLoading ? (
        <>
          <fieldset className="fd-quiz-options" key={currentQuestion.id}>
            <legend className="fd-quiz-q">{currentQuestion.question}</legend>
            {currentQuestion.options.map((option, optionIndex) => {
              const isPicked = selectedAnswerIndex === optionIndex;
              const isCorrect = currentQuestion.correctAnswerIndex === optionIndex;
              const mark = isAnswerChecked && isCorrect ? "Correct" : isAnswerChecked && isPicked ? "Your pick" : "";
              return (
                <button
                  key={`${currentQuestion.id}-${optionIndex}`}
                  type="button"
                  className={cn(
                    "fd-quiz-option",
                    isPicked && !isAnswerChecked && "is-picked",
                    isAnswerChecked && isCorrect && "is-correct",
                    isAnswerChecked && isPicked && !isCorrect && "is-wrong",
                  )}
                  aria-pressed={isPicked}
                  disabled={isAnswerChecked}
                  onClick={() => setSelectedAnswerIndex(optionIndex)}
                >
                  <span className="fd-radio" aria-hidden="true" />
                  <span>{option}</span>
                  {mark ? <span className="fd-quiz-mark">{mark}</span> : null}
                </button>
              );
            })}
          </fieldset>

          {isAnswerChecked ? (
            <div className="fd-verdict" role="status">
              <strong>
                {checkedAnswerIndex === currentQuestion.correctAnswerIndex
                  ? "Correct"
                  : `Not quite — the answer is “${currentQuestion.options[currentQuestion.correctAnswerIndex]}”`}
              </strong>
              <p>{currentQuestion.explanation}</p>
            </div>
          ) : null}

          {isAnswerChecked ? (
            checkedAnswerIndex === currentQuestion.correctAnswerIndex ? (
              <button
                type="button"
                className="fd-btn fd-btn-accent"
                style={{ alignSelf: "flex-start" }}
                onClick={() => goToQuestion(quizIndex < quizQuestions.length - 1 ? quizIndex + 1 : 0)}
              >
                {quizIndex < quizQuestions.length - 1 ? "Next question" : "Start again"}
                <ArrowRight size={16} className="fd-arrow" />
              </button>
            ) : (
              <button type="button" className="fd-btn fd-btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => goToQuestion(quizIndex)}>
                Try again
              </button>
            )
          ) : (
            <button
              type="button"
              className="fd-btn fd-btn-accent"
              style={{ alignSelf: "flex-start" }}
              disabled={selectedAnswerIndex === null}
              onClick={() => setCheckedAnswerIndex(selectedAnswerIndex)}
            >
              Check answer
            </button>
          )}

          <div className="fd-tool-foot">
            <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={generateQuiz}>
              <RotateCcw size={14} strokeWidth={2} />
              Regenerate
            </button>
            <PagerButtons
              label="question"
              index={quizIndex}
              total={quizQuestions.length}
              onPrevious={() => goToQuestion(quizIndex - 1)}
              onNext={() => goToQuestion(quizIndex + 1)}
            />
          </div>
        </>
      ) : null}
    </div>
  );

  const renderFlashcards = () => (
    <div className={cn("fd-support-body", isTabPending && "is-pending")} key="flashcards">
      <div className="fd-support-row">
        <span className="fd-eyebrow">From your weak spots</span>
        {flashcards.length && !flashcardsLoading && !isFlashcardRoundComplete ? (
          <span className="fd-kicker">{cardIndex + 1} / {flashcards.length}</span>
        ) : null}
      </div>
      {topicMismatchNotice ? <div className="fd-notice is-amber">{topicMismatchNotice}</div> : null}

      {!flashcards.length && !flashcardsLoading ? (
        <div className="fd-tool-generate">
          <p>Build 4–8 review cards from {selectedConcept || "this concept"} and the weak links in your explanation.</p>
          {flashcardsError ? <ToolError message={flashcardsError} /> : null}
          <button type="button" className="fd-btn fd-btn-accent" onClick={generateFlashcards} disabled={!hasCompletedExplanation}>
            Generate flashcards
          </button>
        </div>
      ) : null}

      {flashcardsLoading ? <BusyBlock label="Creating focused review cards…" /> : null}

      {isFlashcardRoundComplete && !flashcardsLoading ? (
        <>
          <div className="fd-flashcard is-entering" style={{ minHeight: 0 }}>
            <span className="fd-pill is-success" style={{ alignSelf: "flex-start" }}>Round complete</span>
            <p className="fd-flashcard-front">
              {understoodFlashcardCount} understood · {needsReviewFlashcardCount} to review
            </p>
          </div>
          <div className="fd-review-btns">
            <button
              type="button"
              className="fd-btn fd-btn-accent"
              disabled={!needsReviewFlashcardCount}
              onClick={() => {
                const firstNeedsReviewIndex = flashcards.findIndex((card) => flashcardReviewState[card.id] === "needs_review");
                goToCard(firstNeedsReviewIndex >= 0 ? firstNeedsReviewIndex : 0);
              }}
            >
              Review weak cards
            </button>
            <button
              type="button"
              className="fd-btn fd-btn-secondary"
              onClick={() => {
                setFlashcardReviewState({});
                goToCard(0);
              }}
            >
              Review all again
            </button>
          </div>
        </>
      ) : currentCard && !flashcardsLoading ? (
        <>
          <div
            key={currentCard.id}
            className={cn("fd-flashcard", isSwiping ? "is-dragging" : "is-entering")}
            style={isSwiping ? { transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`, opacity: 1 - Math.min(Math.abs(dragX) / 500, 0.35) } : undefined}
            tabIndex={0}
            role="group"
            aria-roledescription="flashcard"
            aria-label={`Card ${cardIndex + 1} of ${flashcards.length}`}
            onPointerDown={handleCardPointerDown}
            onPointerMove={handleCardPointerMove}
            onPointerUp={handleCardPointerEnd}
            onPointerCancel={handleCardPointerEnd}
            onKeyDown={handleCardKeyDown}
          >
            <span
              className={cn("fd-pill", currentCard.priority === "high" && "is-amber")}
              style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 600, padding: "3px 8px" }}
            >
              {currentCard.priority === "high" ? "High priority" : currentCard.priority === "medium" ? "Medium priority" : "Low priority"}
            </span>
            <p className="fd-flashcard-front">{currentCard.front}</p>
            {isCardRevealed ? <p className="fd-flashcard-back">{currentCard.back}</p> : null}
            <div className="fd-flashcard-spacer" />
            <button
              type="button"
              className={cn("fd-btn", isCardRevealed ? "fd-btn-secondary" : "fd-btn-accent")}
              onClick={() => setIsCardRevealed((current) => !current)}
            >
              {isCardRevealed ? "Hide answer" : "Reveal answer"}
            </button>
          </div>

          {isCardRevealed ? (
            <div className="fd-review-btns" style={{ animation: "fd-rise-in 0.25s var(--fd-ease-out)" }}>
              <button
                type="button"
                className="fd-btn fd-btn-secondary is-understood"
                aria-pressed={currentCardReviewState === "understood"}
                onClick={() => markFlashcard("understood")}
              >
                <Check size={14} strokeWidth={2.2} />
                Understood
              </button>
              <button
                type="button"
                className="fd-btn fd-btn-secondary is-review"
                aria-pressed={currentCardReviewState === "needs_review"}
                onClick={() => markFlashcard("needs_review")}
              >
                Needs review
              </button>
            </div>
          ) : null}

          <p className="fd-swipe-hint">Swipe the card or use ← → to move between cards</p>

          <div className="fd-tool-foot">
            <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={generateFlashcards}>
              <RotateCcw size={14} strokeWidth={2} />
              Regenerate
            </button>
            <PagerButtons
              label="card"
              index={cardIndex}
              total={flashcards.length}
              onPrevious={() => goToCard(cardIndex - 1)}
              onNext={() => goToCard(cardIndex + 1)}
            />
          </div>
        </>
      ) : null}
    </div>
  );

  const tabs: Array<[StudyPanelTab, string]> = [
    ["insights", "Progress"],
    ["quiz", "Quiz"],
    ["flashcards", "Flashcards"],
  ];

  return (
    <aside className={cn("fd-panel is-right", isDragging && "is-dragging")} style={panelStyle} aria-label="Support">
      <div className="fd-support-tabs">
        <div role="tablist" aria-label="Support tools" className="fd-segmented">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={visibleTab === id}
              disabled={id !== "insights" && !toolsReady}
              title={id !== "insights" && !toolsReady ? "Available after your first explanation" : undefined}
              onClick={() => handleTabChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isConceptSwitching ? (
        <div className="fd-support-body">
          <BusyBlock label={`Loading ${selectedConcept || "concept"}…`} />
        </div>
      ) : visibleTab === "quiz" ? (
        renderQuiz()
      ) : visibleTab === "flashcards" ? (
        renderFlashcards()
      ) : (
        renderProgress()
      )}
    </aside>
  );
}
