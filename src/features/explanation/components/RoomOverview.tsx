"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "./AppNavbar";
import { createCustomRoomConceptAction } from "@src/app/study/actions";
import { useThemeMode } from "@src/lib/useThemeMode";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { RoomConceptRow, StudyUnitWithConcepts } from "@src/lib/repositories/study-path";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import { getConceptStatusLabel, getEffectiveConceptStatus } from "@src/lib/study/recommendations";

type RoomOverviewProps = {
  authUser?: AuthenticatedUser;
  room: StudyRoomRow;
  source?: SourceRow | null;
  units: StudyUnitWithConcepts[];
  concepts: RoomConceptRow[];
  loadError?: string | null;
};

function statusLabel(concept: RoomConceptRow) {
  return getConceptStatusLabel(concept.status, concept.next_review_at);
}

function statusClass(concept: RoomConceptRow) {
  return `concept-status ${getEffectiveConceptStatus(concept.status, concept.next_review_at).replaceAll("_", "-")}`;
}

function statusIcon(concept: RoomConceptRow) {
  const status = getEffectiveConceptStatus(concept.status, concept.next_review_at);
  if (status === "clear") return "✓";
  if (status === "due_for_review") return "↻";
  if (status === "needs_recall") return "◷";
  if (status === "improving") return "◐";
  if (status === "gap_found") return "!";
  if (status === "explaining") return "◌";
  return "○";
}

function statusText(concept: RoomConceptRow) {
  const label = statusLabel(concept);
  return concept.latest_clarity_score != null ? `${label} · Clarity ${concept.latest_clarity_score}` : label;
}

function rowStatusText(concept: RoomConceptRow) {
  const label = statusLabel(concept);
  return concept.latest_clarity_score != null ? `${label} · ${concept.latest_clarity_score}` : label;
}

function isConceptExplained(concept: RoomConceptRow) {
  return concept.status === "clear" || concept.status === "needs_recall" || concept.status === "due_for_review";
}

function conceptGuidance(concept: RoomConceptRow) {
  const gap = concept.main_unresolved_gap || concept.main_gap;
  if (gap) return `Focus: ${gap}`;
  return concept.description || "Open this concept to start explaining it.";
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function sortMostRecent(first: RoomConceptRow, second: RoomConceptRow) {
  const firstDate = new Date(first.last_activity_at || first.created_at || 0).getTime();
  const secondDate = new Date(second.last_activity_at || second.created_at || 0).getTime();
  return secondDate - firstDate;
}

function getFirstFoundationalConcept(units: StudyUnitWithConcepts[], status: RoomConceptRow["status"]) {
  for (const unit of units) {
    const concept = [...unit.concepts].sort((first, second) => first.sort_order - second.sort_order).find((item) => item.status === status);
    if (concept) return concept;
  }

  return null;
}

function getRecommendedConcept(concepts: RoomConceptRow[], units: StudyUnitWithConcepts[]) {
  const dueRecall = concepts
    .filter((concept) => getEffectiveConceptStatus(concept.status, concept.next_review_at) === "due_for_review")
    .sort(sortMostRecent)[0];
  if (dueRecall) return dueRecall;

  const gapFound = concepts.filter((concept) => concept.status === "gap_found").sort(sortMostRecent)[0];
  if (gapFound) return gapFound;

  const improving = concepts.filter((concept) => concept.status === "improving").sort(sortMostRecent)[0];
  if (improving) return improving;

  const inProgress = concepts.filter((concept) => concept.status === "explaining").sort(sortMostRecent)[0];
  if (inProgress) return inProgress;

  const notStarted = getFirstFoundationalConcept(units, "not_started");
  if (notStarted) return notStarted;

  return null;
}

function getSummaryText(concepts: RoomConceptRow[]) {
  if (!concepts.length) return "";

  const counts = {
    clear: concepts.filter((concept) => concept.status === "clear").length,
    improving: concepts.filter((concept) => concept.status === "improving" || concept.status === "explaining").length,
    gaps: concepts.filter((concept) => concept.status === "gap_found").length,
  };

  if (counts.clear === 0 && counts.improving === 0 && counts.gaps === 0) {
    return `${concepts.length} concepts ready to explain`;
  }

  return [
    `${concepts.length} concepts`,
    counts.clear ? `${counts.clear} clear` : null,
    counts.improving ? `${counts.improving} improving` : null,
    counts.gaps ? `${counts.gaps} gaps found` : null,
  ].filter(Boolean).join(" · ");
}

export function RoomOverview({
  authUser,
  room,
  source,
  units,
  concepts,
  loadError,
}: RoomOverviewProps) {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const router = useRouter();
  const [customConcept, setCustomConcept] = useState("");
  const [error, setError] = useState<string | null>(loadError || null);
  const [openingTarget, setOpeningTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const summaryText = useMemo(() => getSummaryText(concepts), [concepts]);
  const recommendedConcept = getRecommendedConcept(concepts, units);
  const recommendedStatus = recommendedConcept
    ? getEffectiveConceptStatus(recommendedConcept.status, recommendedConcept.next_review_at)
    : null;
  const recommendedLabel = recommendedStatus === "due_for_review"
    ? "Due for recall"
    : recommendedStatus === "gap_found"
      ? "Last weak link"
      : recommendedStatus === "not_started"
        ? "Start next concept"
        : "Next best step";
  const firstClearConcept = concepts.find((concept) => concept.status === "clear") || concepts[0] || null;
  const allConceptsClear = concepts.length > 0 && concepts.every((concept) => (
    isConceptExplained(concept)
  ));
  const explainedCount = concepts.filter(isConceptExplained).length;
  const progressPercent = concepts.length ? Math.round((explainedCount / concepts.length) * 100) : 0;
  const recommendedUnitId = recommendedConcept
    ? units.find((unit) => unit.concepts.some((concept) => concept.id === recommendedConcept.id))?.id
    : null;
  const firstIncompleteUnitId = units.find((unit) => unit.concepts.some((concept) => !isConceptExplained(concept)))?.id;
  const initialOpenUnitId = recommendedUnitId || firstIncompleteUnitId || units[0]?.id || null;
  const [openUnitIds, setOpenUnitIds] = useState<string[]>(initialOpenUnitId ? [initialOpenUnitId] : []);
  const nextReviewAt = concepts
    .map((concept) => concept.next_review_at)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => new Date(first).getTime() - new Date(second).getTime())[0] || null;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`feynduck-room-open-units:${room.id}`) || "null");
      if (!Array.isArray(saved)) return;
      const validUnitIds = saved.filter((id): id is string => (
        typeof id === "string" && units.some((unit) => unit.id === id)
      ));
      setOpenUnitIds(validUnitIds);
    } catch {
      // Unit expansion is a local preference; use the recommended unit if storage is unavailable.
    }
  }, [room.id, units]);

  const setUnitOpen = (unitId: string, isOpen: boolean) => {
    setOpenUnitIds((current) => {
      const next = isOpen
        ? Array.from(new Set([...current, unitId]))
        : current.filter((id) => id !== unitId);
      try {
        localStorage.setItem(`feynduck-room-open-units:${room.id}`, JSON.stringify(next));
      } catch {
        // Keep the interaction working if local storage is unavailable.
      }
      return next;
    });
  };

  const openConcept = (conceptId?: string, recall = false) => {
    const conceptParam = conceptId ? `&conceptId=${encodeURIComponent(conceptId)}` : "";
    const recallParam = recall ? "&mode=recall" : "";
    const href = `/study/session?roomId=${encodeURIComponent(room.id)}${conceptParam}${recallParam}`;
    const endTiming = startInteractionTiming("concept-session-open");
    setOpeningTarget(conceptId || "workspace");
    startTransition(() => {
      router.push(href);
      endTiming();
    });
  };

  const createCustomConcept = () => {
    const title = customConcept.trim();
    if (title.length < 2) {
      setError("Enter a concept to add.");
      return;
    }

    setError(null);
    const endTiming = startInteractionTiming("custom-concept-create");
    startTransition(async () => {
      const result = await createCustomRoomConceptAction(room.id, title);
      if (!result.ok) {
        setError(result.error);
        endTiming();
        return;
      }

      if (result.data?.id) {
        router.push(`/study/session?roomId=${encodeURIComponent(room.id)}&conceptId=${encodeURIComponent(result.data.id)}`);
        endTiming();
        return;
      }

      router.push(`/study/session?roomId=${encodeURIComponent(room.id)}`);
      endTiming();
    });
  };

  return (
    <div className="app-workspace dashboard-rooms room-overview-page">
      <AppNavbar themeMode={themeMode} toggleTheme={toggleTheme} mounted={mounted} isSession={false} authUser={authUser} />
      <main className="room-overview-main">
        <div className="room-overview-topline">
          <Link href="/study">← Back to rooms</Link>
        </div>

        <header className="room-overview-header">
          <div>
            <span>Study room</span>
            <h1>{room.title}</h1>
            <p>
              {concepts.length
                ? summaryText
                  : source
                  ? "Source material added. Build your learning path to start."
                  : "Add study material to create your learning path."}
            </p>
            {concepts.length ? (
              <div
                className="room-progress"
                role="progressbar"
                aria-label="Concepts explained"
                aria-valuemin={0}
                aria-valuemax={concepts.length}
                aria-valuenow={explainedCount}
              >
                <span className="room-progress-track" aria-hidden="true">
                  <span style={{ width: `${progressPercent}%` }} />
                </span>
                <small>{explainedCount} of {concepts.length} explained</small>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={source ? "room-material-button" : undefined}
            onClick={() => openConcept()}
            disabled={openingTarget !== null}
          >
            {openingTarget === "workspace" ? "Opening…" : source ? "Manage material" : "Add material"}
          </button>
        </header>

        {error ? <div className="rooms-error">{error}</div> : null}

        {!source ? (
          <section className="room-overview-empty">
            <h2>No source material yet</h2>
            <p>Add study material to create your learning path.</p>
            <button type="button" onClick={() => openConcept()} disabled={openingTarget !== null}>
              {openingTarget ? "Opening…" : "Add source material"}
            </button>
          </section>
        ) : concepts.length === 0 ? (
          <section className="room-overview-empty">
            <h2>No learning path yet</h2>
            <p>Save or update your material in the workspace to generate source-derived concepts.</p>
            <button type="button" onClick={() => openConcept()} disabled={openingTarget !== null}>
              {openingTarget ? "Opening…" : "Manage material"}
            </button>
          </section>
        ) : (
          <>
            {recommendedConcept ? (
              <section className="recommended-concept-card room-next-step-card">
                <div>
                  <span>{recommendedLabel}</span>
                  <h2>{recommendedConcept.title}</h2>
                  <strong className={statusClass(recommendedConcept)}>{statusText(recommendedConcept)}</strong>
                  <p>
                    {recommendedConcept.main_unresolved_gap || recommendedConcept.main_gap ||
                      (recommendedConcept.status === "gap_found" || recommendedConcept.status === "improving"
                        ? "Continue explaining this concept to strengthen your understanding."
                        : recommendedConcept.description || "Start with this source-grounded concept.")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={openingTarget !== null}
                  onClick={() => openConcept(
                    recommendedConcept.id,
                    recommendedStatus === "due_for_review",
                  )}
                >
                  {openingTarget === recommendedConcept.id
                    ? "Opening…"
                    : recommendedStatus === "due_for_review"
                    ? "Start recall"
                    : "Continue"}
                </button>
              </section>
            ) : allConceptsClear ? (
              <section className="recommended-concept-card room-next-step-card">
                <div>
                  <span>Room complete</span>
                  <h2>You’ve explained every concept in this room clearly.</h2>
                  <p>
                    {nextReviewAt
                      ? `No review is due now. Your next recall is ${formatReviewDate(nextReviewAt)}.`
                      : "Choose any concept whenever you want to revisit the material."}
                  </p>
                </div>
                <button type="button" onClick={() => openConcept(firstClearConcept?.id)} disabled={openingTarget !== null}>
                  {openingTarget ? "Opening…" : "Review a concept"}
                </button>
              </section>
            ) : null}

            <section className="learning-path-list">
              {units.map((unit) => {
                const unitExplainedCount = unit.concepts.filter(isConceptExplained).length;
                return (
                  <details
                    key={unit.id}
                    className="learning-unit"
                    open={openUnitIds.includes(unit.id)}
                    onToggle={(event) => setUnitOpen(unit.id, event.currentTarget.open)}
                  >
                    <summary>
                      <div>
                        <h2>{unit.title}</h2>
                        {unit.description ? <p>{unit.description}</p> : null}
                      </div>
                      <span className="learning-unit-progress">
                        {unitExplainedCount} of {unit.concepts.length} explained
                        <span className="learning-unit-chevron" aria-hidden="true">⌄</span>
                      </span>
                    </summary>
                    <div className="concept-row-list">
                      {unit.concepts.map((concept) => (
                        <button
                          key={concept.id}
                          type="button"
                          className="concept-row"
                          disabled={openingTarget !== null}
                          onClick={() => openConcept(
                            concept.id,
                            getEffectiveConceptStatus(concept.status, concept.next_review_at) === "due_for_review",
                          )}
                        >
                          <div className="concept-row-main">
                            <span className={statusClass(concept)} aria-label={statusLabel(concept)}>
                              <span aria-hidden="true">{statusIcon(concept)}</span>
                            </span>
                            <div>
                              <strong>{concept.title}</strong>
                              <em>{rowStatusText(concept)}</em>
                            </div>
                          </div>
                          <div className="concept-row-description">
                            <span>{conceptGuidance(concept)}</span>
                          </div>
                          <span className="concept-row-arrow" aria-hidden="true">
                            {openingTarget === concept.id ? "Opening…" : "→"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                );
              })}
            </section>
          </>
        )}

        <details className="add-custom-concept">
          <summary><span aria-hidden="true">+</span> Add a concept</summary>
          <div className="add-custom-concept-body">
            <div>
              <h2>Add your own concept</h2>
              <p>Use this when the material includes something Feynduck did not list.</p>
            </div>
            <div>
              <input
                value={customConcept}
                onChange={(event) => setCustomConcept(event.target.value)}
                placeholder="e.g. Tubular reabsorption"
              />
              <button type="button" onClick={createCustomConcept} disabled={isPending}>
                {isPending ? "Adding..." : "Add concept"}
              </button>
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}
