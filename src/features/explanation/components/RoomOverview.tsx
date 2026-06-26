"use client";

import { useMemo, useState, useTransition } from "react";
import { AppNavbar } from "./AppNavbar";
import { createCustomRoomConceptAction } from "@src/app/study/actions";
import { useThemeMode } from "@src/lib/useThemeMode";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { RoomConceptRow, StudyUnitWithConcepts } from "@src/lib/repositories/study-path";

type RoomOverviewProps = {
  authUser?: AuthenticatedUser;
  room: StudyRoomRow;
  source?: SourceRow | null;
  units: StudyUnitWithConcepts[];
  concepts: RoomConceptRow[];
  loadError?: string | null;
};

function statusLabel(status: RoomConceptRow["status"]) {
  if (status === "clear") return "Clear";
  if (status === "gap_found") return "Gap found";
  if (status === "improving") return "Improving";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function statusClass(status: RoomConceptRow["status"]) {
  return `concept-status ${status.replace("_", "-")}`;
}

function statusIcon(status: RoomConceptRow["status"]) {
  if (status === "clear") return "✓";
  if (status === "improving") return "◐";
  if (status === "gap_found") return "!";
  if (status === "in_progress") return "◌";
  return "○";
}

function statusText(concept: RoomConceptRow) {
  const label = statusLabel(concept.status);
  return concept.latest_clarity_score != null ? `${label} · Clarity ${concept.latest_clarity_score}` : label;
}

function rowStatusText(concept: RoomConceptRow) {
  const label = statusLabel(concept.status);
  return concept.latest_clarity_score != null ? `${label} · ${concept.latest_clarity_score}` : label;
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
  const gapFound = concepts.filter((concept) => concept.status === "gap_found").sort(sortMostRecent)[0];
  if (gapFound) return gapFound;

  const improving = concepts.filter((concept) => concept.status === "improving").sort(sortMostRecent)[0];
  if (improving) return improving;

  const notStarted = getFirstFoundationalConcept(units, "not_started");
  if (notStarted) return notStarted;

  const inProgress = concepts.filter((concept) => concept.status === "in_progress").sort(sortMostRecent)[0];
  if (inProgress) return inProgress;

  return null;
}

function getSummaryText(concepts: RoomConceptRow[]) {
  if (!concepts.length) return "";

  const counts = {
    clear: concepts.filter((concept) => concept.status === "clear").length,
    improving: concepts.filter((concept) => concept.status === "improving" || concept.status === "in_progress").length,
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
  const [customConcept, setCustomConcept] = useState("");
  const [error, setError] = useState<string | null>(loadError || null);
  const [isPending, startTransition] = useTransition();

  const summaryText = useMemo(() => getSummaryText(concepts), [concepts]);
  const recommendedConcept = getRecommendedConcept(concepts, units);
  const firstClearConcept = concepts.find((concept) => concept.status === "clear") || concepts[0] || null;
  const allConceptsClear = concepts.length > 0 && concepts.every((concept) => concept.status === "clear");

  const openConcept = (conceptId?: string) => {
    const conceptParam = conceptId ? `&conceptId=${encodeURIComponent(conceptId)}` : "";
    window.location.href = `/study/session?roomId=${encodeURIComponent(room.id)}${conceptParam}`;
  };

  const createCustomConcept = () => {
    const title = customConcept.trim();
    if (title.length < 2) {
      setError("Enter a concept to add.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createCustomRoomConceptAction(room.id, title);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.data?.id) {
        window.location.href = `/study/session?roomId=${encodeURIComponent(room.id)}&conceptId=${encodeURIComponent(result.data.id)}`;
        return;
      }

      window.location.href = `/study/session?roomId=${encodeURIComponent(room.id)}`;
    });
  };

  return (
    <div className="app-workspace dashboard-rooms room-overview-page">
      <AppNavbar themeMode={themeMode} toggleTheme={toggleTheme} mounted={mounted} isSession={false} authUser={authUser} />
      <main className="room-overview-main">
        <div className="room-overview-topline">
          <a href="/study">← Back to rooms</a>
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
          </div>
          <button type="button" onClick={() => openConcept()}>
            {source ? "Open workspace" : "Add material"}
          </button>
        </header>

        {error ? <div className="rooms-error">{error}</div> : null}

        {!source ? (
          <section className="room-overview-empty">
            <h2>No source material yet</h2>
            <p>Add study material to create your learning path.</p>
            <button type="button" onClick={() => openConcept()}>Add source material</button>
          </section>
        ) : concepts.length === 0 ? (
          <section className="room-overview-empty">
            <h2>No learning path yet</h2>
            <p>Save or update your material in the workspace to generate source-derived concepts.</p>
            <button type="button" onClick={() => openConcept()}>Open workspace</button>
          </section>
        ) : (
          <>
            {recommendedConcept ? (
              <section className="recommended-concept-card">
                <div>
                  <span>Continue learning</span>
                  <h2>{recommendedConcept.title}</h2>
                  <strong className={statusClass(recommendedConcept.status)}>{statusText(recommendedConcept)}</strong>
                  <p>
                    {recommendedConcept.main_gap ||
                      (recommendedConcept.status === "gap_found" || recommendedConcept.status === "improving"
                        ? "Continue explaining this concept to strengthen your understanding."
                        : recommendedConcept.description || "Start with this source-grounded concept.")}
                  </p>
                </div>
                <button type="button" onClick={() => openConcept(recommendedConcept.id)}>Continue explaining</button>
              </section>
            ) : allConceptsClear ? (
              <section className="recommended-concept-card">
                <div>
                  <span>Continue learning</span>
                  <h2>You’ve explained every concept in this room clearly.</h2>
                  <p>Choose one concept to review whenever you want to revisit the material.</p>
                </div>
                <button type="button" onClick={() => openConcept(firstClearConcept?.id)}>Review a concept</button>
              </section>
            ) : null}

            <section className="learning-path-list">
              {units.map((unit) => (
                <details key={unit.id} className="learning-unit" open>
                  <summary>
                    <div>
                      <h2>{unit.title}</h2>
                      {unit.description ? <p>{unit.description}</p> : null}
                    </div>
                    <span>{unit.concepts.length} concepts</span>
                  </summary>
                  <div className="concept-row-list">
                    {unit.concepts.map((concept) => (
                      <button key={concept.id} type="button" className="concept-row" onClick={() => openConcept(concept.id)}>
                        <div className="concept-row-main">
                          <span className={statusClass(concept.status)} aria-label={statusLabel(concept.status)}>
                            <span aria-hidden="true">{statusIcon(concept.status)}</span>
                          </span>
                          <div>
                            <strong>{concept.title}</strong>
                            <em>{rowStatusText(concept)}</em>
                          </div>
                        </div>
                        <div className="concept-row-description">
                          {concept.description ? <span>{concept.description}</span> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          </>
        )}

        <section className="add-custom-concept">
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
        </section>
      </main>
    </div>
  );
}
