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

function getRecommendedConcept(concepts: RoomConceptRow[]) {
  const byPriority = [
    concepts.filter((concept) => concept.status === "gap_found"),
    concepts.filter((concept) => concept.status === "improving"),
    concepts.filter((concept) => concept.status === "in_progress"),
    concepts.filter((concept) => concept.status === "not_started"),
    concepts.filter((concept) => concept.status === "clear"),
  ];

  for (const group of byPriority) {
    if (!group.length) continue;
    return [...group].sort((first, second) => {
      const firstDate = new Date(first.last_activity_at || first.created_at || 0).getTime();
      const secondDate = new Date(second.last_activity_at || second.created_at || 0).getTime();
      return firstDate - secondDate;
    })[0];
  }

  return null;
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

  const stats = useMemo(() => {
    const clear = concepts.filter((concept) => concept.status === "clear").length;
    const improving = concepts.filter((concept) => concept.status === "improving" || concept.status === "in_progress").length;
    const gaps = concepts.filter((concept) => concept.status === "gap_found").length;
    return { clear, improving, gaps };
  }, [concepts]);

  const recommendedConcept = getRecommendedConcept(concepts);

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
                ? `${concepts.length} concepts · ${stats.clear} clear · ${stats.improving} improving · ${stats.gaps} gaps found`
                : source
                  ? "Source material added. Build your learning path to start."
                  : "Add source material to build a learning path."}
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
            <p>Add notes first, then Feynduck can build a source-grounded path of concepts.</p>
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
              <section className="recommended-concept-card" onClick={() => openConcept(recommendedConcept.id)}>
                <div>
                  <span>Recommended next</span>
                  <h2>{recommendedConcept.title}</h2>
                  <p>{recommendedConcept.description || "Continue from the concept that needs the most attention."}</p>
                </div>
                <strong className={statusClass(recommendedConcept.status)}>{statusLabel(recommendedConcept.status)}</strong>
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
                        <div>
                          <strong>{concept.title}</strong>
                          {concept.description ? <span>{concept.description}</span> : null}
                        </div>
                        <em className={statusClass(concept.status)}>
                          {concept.latest_clarity_score != null ? `${statusLabel(concept.status)} · ${concept.latest_clarity_score}` : statusLabel(concept.status)}
                        </em>
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
