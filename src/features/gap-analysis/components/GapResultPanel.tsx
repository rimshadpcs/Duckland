"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import type { GapAnalysisResult } from "../types";

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
};

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

function PanelTabs({ activeTab, onChange }: { activeTab: StudyPanelTab; onChange: (tab: StudyPanelTab) => void }) {
  const tabs: Array<{ id: StudyPanelTab; label: string }> = [
    { id: "insights", label: "Insights" },
    { id: "quiz", label: "Quiz" },
    { id: "flashcards", label: "Flashcards" },
  ];

  return (
    <div className="study-panel-tabs" role="tablist" aria-label="Study panel sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function InsightsTab({
  result,
  isLoading,
  hasNotes,
  hasSelectedConcept,
}: {
  result: GapAnalysisResult | null;
  isLoading: boolean;
  hasNotes: boolean;
  hasSelectedConcept: boolean;
}) {
  const isClear = result?.status === "clear";
  const mainGap = result?.mainGap ?? result?.gapSummary;

  if (!result && !isLoading) {
    return (
      <div className="empty-insights">
        <Lightbulb size={48} strokeWidth={1.5} />
        {!hasNotes ? (
          <>
            <h4>Waiting for study material</h4>
            <p>Add notes on the left, then explain the concept to get feedback.</p>
          </>
        ) : !hasSelectedConcept ? (
          <>
            <h4>Choose a concept to begin</h4>
            <p>Pick the concept Feynduck should evaluate before you explain.</p>
          </>
        ) : (
          <>
            <h4>Waiting for your explanation</h4>
            <p>Send your explanation to generate a clarity score, main gap, and Socratic question.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="insights-card">
      <div className="score-section">
        <span className="score-label">Clarity Score</span>
        <span className="score-value">{result?.status === "topic_mismatch" ? "—" : (result ? result.clarityScore : "--")}</span>
      </div>

      {isClear ? (
        <div className="insight-card strong" style={{ borderColor: "#22c55e" }}>
          <h4 style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "#15803d", margin: "0 0 8px" }}>
            Clear
          </h4>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>
            {result.chatMessage || "You clearly explained the key mechanism."}
          </p>
        </div>
      ) : (
        <div className={`insight-card strong ${isLoading ? "loading-pulse" : ""}`} style={{ borderColor: result?.status === "topic_mismatch" ? "#eab308" : undefined }}>
          <h4 style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: result?.status === "topic_mismatch" ? "#eab308" : "var(--amber-dark)", margin: "0 0 8px" }}>
            {result?.status === "topic_mismatch" ? "Topic mismatch" : "Main Gap"}
          </h4>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>
            {isLoading ? "Analyzing reasoning..." : mainGap}
          </p>
        </div>
      )}

      {!isClear && result?.socraticQuestion && (
        <div className={`insight-card highlight ${isLoading ? "loading-pulse" : ""}`}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "#8a5a0a", margin: "0 0 8px" }}>
            <AlertCircle size={14} /> Socratic Question
          </h4>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#6f4a05", lineHeight: 1.5 }}>
            {isLoading ? "..." : result.socraticQuestion}
          </p>
        </div>
      )}

      {result?.status !== "topic_mismatch" && !isClear && (
        <div className={`insight-card ${isLoading ? "loading-pulse" : ""}`}>
          <h4 style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px" }}>
            Why it matters
          </h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.5 }}>
            {isLoading ? "..." : result?.whyItMatters}
          </p>
        </div>
      )}

      {!isClear && (
        <div className={`insight-card ${isLoading ? "loading-pulse" : ""}`}>
          <h4 style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px" }}>
            Try again
          </h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.5 }}>
            {isLoading ? "..." : result?.suggestedReExplanationPrompt}
          </p>
        </div>
      )}
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
}: GapResultPanelProps) {
  const panelStyle = {
    width: width ? `${width}px` : undefined,
    transition: isDragging ? "none" : undefined,
  };

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
    try {
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
  }, [quizStorageKey, flashcardsStorageKey]);

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
    }
  };

  const generateFlashcards = async () => {
    if (!selectedConcept || !sourceMaterial || !latestEvaluation) return;

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
    }
  };

  const currentQuestion = quizQuestions[quizIndex];
  const currentCard = flashcards[cardIndex];
  const isAnswerChecked = checkedAnswerIndex !== null;
  const currentCardReviewState = currentCard ? flashcardReviewState[currentCard.id] : undefined;

  const markFlashcard = (state: FlashcardReviewState) => {
    if (!currentCard) return;

    setFlashcardReviewState((current) => ({
      ...current,
      [currentCard.id]: state,
    }));
  };

  return (
    <aside className="dashboard-panel right-panel" style={panelStyle}>
      <div className="panel-header study-panel-header">
        <h3 style={{ fontFamily: "inherit", fontWeight: 700 }}>Study panel</h3>
        <PanelTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="panel-content study-panel-content">
        {activeTab === "insights" && (
          <InsightsTab
            result={result}
            isLoading={isLoading}
            hasNotes={hasNotes}
            hasSelectedConcept={hasSelectedConcept}
          />
        )}

        {activeTab === "quiz" && (
          <div className="study-tool">
            <div>
              <span className="study-tool-label">Built from your gaps</span>
              {topicMismatchNotice && <p className="study-tool-note">{topicMismatchNotice}</p>}
            </div>

            {!hasCompletedExplanation && (
              <div className="empty-insights compact">
                <Lightbulb size={36} strokeWidth={1.5} />
                <h4>Complete an explanation first</h4>
                <p>Complete an explanation first, then generate a focused quiz.</p>
              </div>
            )}

            {hasCompletedExplanation && !quizQuestions.length && !quizLoading && (
              <div className="study-tool-empty">
                <p>Generate 3-5 questions focused on the selected concept and your latest gaps.</p>
                {quizError && <div className="study-tool-error">{quizError}</div>}
                <button className="study-tool-primary" type="button" onClick={generateQuiz}>
                  Generate quiz
                </button>
              </div>
            )}

            {quizLoading && (
              <div className="study-tool-loading">
                <Loader2 className="icon-spin" size={18} />
                Generating focused quiz...
              </div>
            )}

            {currentQuestion && !quizLoading && (
              <div className="study-tool-session">
                <div className="study-tool-card">
                  <span className="study-tool-focus">{currentQuestion.focus}</span>
                  <h4>{currentQuestion.question}</h4>
                  <div className="quiz-options">
                    {currentQuestion.options.map((option, optionIndex) => {
                      const isSelected = selectedAnswerIndex === optionIndex;
                      const isCorrect = currentQuestion.correctAnswerIndex === optionIndex;
                      const isCheckedSelected = isAnswerChecked && isSelected;

                      return (
                        <button
                          key={option}
                          type="button"
                          className={[
                            "quiz-option",
                            isSelected ? "selected" : "",
                            isAnswerChecked && isCorrect ? "correct" : "",
                            isCheckedSelected && !isCorrect ? "incorrect" : "",
                          ].filter(Boolean).join(" ")}
                          disabled={isAnswerChecked}
                          onClick={() => setSelectedAnswerIndex(optionIndex)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {!isAnswerChecked ? (
                    <button
                      className="study-tool-primary"
                      type="button"
                      disabled={selectedAnswerIndex === null}
                      onClick={() => setCheckedAnswerIndex(selectedAnswerIndex)}
                    >
                      Check answer
                    </button>
                  ) : (
                    <div className="answer-feedback">
                      <strong>{checkedAnswerIndex === currentQuestion.correctAnswerIndex ? "Correct" : "Not quite"}</strong>
                      <p>{currentQuestion.explanation}</p>
                    </div>
                  )}
                </div>
                <div className="study-tool-nav">
                  <button
                    type="button"
                    aria-label="Previous question"
                    disabled={quizIndex === 0}
                    onClick={() => {
                      setQuizIndex((current) => Math.max(0, current - 1));
                      setSelectedAnswerIndex(null);
                      setCheckedAnswerIndex(null);
                    }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span>{quizIndex + 1} / {quizQuestions.length}</span>
                  <button
                    type="button"
                    aria-label="Next question"
                    disabled={quizIndex === quizQuestions.length - 1}
                    onClick={() => {
                      setQuizIndex((current) => Math.min(quizQuestions.length - 1, current + 1));
                      setSelectedAnswerIndex(null);
                      setCheckedAnswerIndex(null);
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                <button className="study-tool-secondary" type="button" onClick={generateQuiz}>
                  <RotateCcw size={14} /> Regenerate
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "flashcards" && (
          <div className="study-tool">
            <div>
              <span className="study-tool-label">Focused on your weak spots</span>
              {topicMismatchNotice && <p className="study-tool-note">{topicMismatchNotice}</p>}
            </div>

            {!hasCompletedExplanation && (
              <div className="empty-insights compact">
                <Lightbulb size={36} strokeWidth={1.5} />
                <h4>Complete an explanation first</h4>
                <p>Complete an explanation first, then generate focused flashcards.</p>
              </div>
            )}

            {hasCompletedExplanation && !flashcards.length && !flashcardsLoading && (
              <div className="study-tool-empty">
                <p>Generate 4-8 cards from the selected concept, source material, and your weak links.</p>
                {flashcardsError && <div className="study-tool-error">{flashcardsError}</div>}
                <button className="study-tool-primary" type="button" onClick={generateFlashcards}>
                  Generate flashcards
                </button>
              </div>
            )}

            {flashcardsLoading && (
              <div className="study-tool-loading">
                <Loader2 className="icon-spin" size={18} />
                Generating flashcards...
              </div>
            )}

            {currentCard && !flashcardsLoading && (
              <div className="study-tool-session">
                <div className={`flashcard ${isCardRevealed ? "revealed" : ""}`}>
                  <span className={`priority-pill ${currentCard.priority}`}>{currentCard.priority} priority</span>
                  <h4>{currentCard.front}</h4>
                  {isCardRevealed ? (
                    <p>{currentCard.back}</p>
                  ) : (
                    <button className="study-tool-primary" type="button" onClick={() => setIsCardRevealed(true)}>
                      Reveal answer
                    </button>
                  )}
                </div>
                {isCardRevealed && (
                  <div className="flashcard-actions">
                    <button
                      type="button"
                      className={currentCardReviewState === "understood" ? "active understood" : ""}
                      aria-pressed={currentCardReviewState === "understood"}
                      onClick={() => markFlashcard("understood")}
                    >
                      <Check size={14} /> Understood
                    </button>
                    <button
                      type="button"
                      className={currentCardReviewState === "needs_review" ? "active needs-review" : ""}
                      aria-pressed={currentCardReviewState === "needs_review"}
                      onClick={() => markFlashcard("needs_review")}
                    >
                      Needs review
                    </button>
                  </div>
                )}
                <div className="study-tool-nav">
                  <button
                    type="button"
                    aria-label="Previous flashcard"
                    disabled={cardIndex === 0}
                    onClick={() => {
                      setCardIndex((current) => Math.max(0, current - 1));
                      setIsCardRevealed(false);
                    }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span>{cardIndex + 1} / {flashcards.length}</span>
                  <button
                    type="button"
                    aria-label="Next flashcard"
                    disabled={cardIndex === flashcards.length - 1}
                    onClick={() => {
                      setCardIndex((current) => Math.min(flashcards.length - 1, current + 1));
                      setIsCardRevealed(false);
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                <button className="study-tool-secondary" type="button" onClick={generateFlashcards}>
                  <RotateCcw size={14} /> Regenerate
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
