"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createCustomRoomConceptAction,
  deleteRoomSourceAction,
  deleteStudyRoomAction,
  renameRoomSourceAction,
  renameStudyRoomAction,
  toggleRoomSourceActiveAction,
} from "@src/app/study/actions";
import { AppHeader } from "@src/components/app/AppHeader";
import { Dialog } from "@src/components/app/Dialog";
import { Menu } from "@src/components/app/Menu";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { RoomConceptRow, StudyUnitWithConcepts } from "@src/lib/repositories/study-path";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import { getConceptStatusLabel, getEffectiveConceptStatus } from "@src/lib/study/recommendations";
import { cn } from "@src/lib/utils";

type RoomOverviewProps = {
  authUser?: AuthenticatedUser;
  room: StudyRoomRow;
  sources: SourceRow[];
  units: StudyUnitWithConcepts[];
  concepts: RoomConceptRow[];
  loadError?: string | null;
};

type RenameTarget = { kind: "room" } | { kind: "source"; source: SourceRow };
type DeleteTarget = { kind: "room" } | { kind: "source"; source: SourceRow };

function effectiveStatus(concept: RoomConceptRow) {
  return getEffectiveConceptStatus(concept.status, concept.next_review_at);
}

function isConceptExplained(concept: RoomConceptRow) {
  return concept.status === "clear" || concept.status === "needs_recall" || concept.status === "due_for_review";
}

function conceptGuidance(concept: RoomConceptRow) {
  const gap = concept.main_unresolved_gap || concept.main_gap;
  if (gap) return `Focus: ${gap}`;
  return concept.description || "Open this concept to start explaining it.";
}

function formatDate(value: string | null | undefined, withYear = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(date);
}

function sortMostRecent(first: RoomConceptRow, second: RoomConceptRow) {
  return new Date(second.last_activity_at || second.created_at || 0).getTime() - new Date(first.last_activity_at || first.created_at || 0).getTime();
}

function getRecommendedConcept(concepts: RoomConceptRow[], units: StudyUnitWithConcepts[]) {
  const byStatus = (status: string) => concepts.filter((concept) => effectiveStatus(concept) === status).sort(sortMostRecent)[0];

  const dueRecall = byStatus("due_for_review");
  if (dueRecall) return dueRecall;
  const gapFound = byStatus("gap_found");
  if (gapFound) return gapFound;
  const improving = byStatus("improving");
  if (improving) return improving;
  const explaining = byStatus("explaining");
  if (explaining) return explaining;

  for (const unit of units) {
    const next = [...unit.concepts].sort((first, second) => first.sort_order - second.sort_order).find((concept) => concept.status === "not_started");
    if (next) return next;
  }

  return null;
}

function sourceChars(source: SourceRow) {
  return source.extracted_text_length ?? source.content.length;
}

function sourceMeta(source: SourceRow) {
  const parts = [
    source.page_count ? `${source.page_count} page${source.page_count === 1 ? "" : "s"}` : null,
    `${sourceChars(source).toLocaleString()} chars`,
    source.is_active ? null : "excluded",
  ];
  return parts.filter(Boolean).join(" · ");
}

function sourceTitle(source: SourceRow) {
  return source.title || source.original_file_name || "Untitled source";
}

export function RoomOverview({ authUser, room, sources, units, concepts, loadError }: RoomOverviewProps) {
  const router = useRouter();
  const [roomTitle, setRoomTitle] = useState(room.title);
  const [customConcept, setCustomConcept] = useState("");
  const [error, setError] = useState<string | null>(loadError || null);
  const [openingTarget, setOpeningTarget] = useState<string | null>(null);
  const [isBuildingPath, setIsBuildingPath] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const workspaceHref = `/study/session?roomId=${encodeURIComponent(room.id)}`;
  const recommended = getRecommendedConcept(concepts, units);
  const recommendedStatus = recommended ? effectiveStatus(recommended) : null;
  const explainedCount = concepts.filter(isConceptExplained).length;
  const allExplained = concepts.length > 0 && explainedCount === concepts.length;
  const progressPercent = concepts.length ? Math.round((explainedCount / concepts.length) * 100) : 0;
  const activeSources = sources.filter((source) => source.is_active);
  const totalChars = activeSources.reduce((total, source) => total + sourceChars(source), 0);
  const nextReviewAt = concepts
    .map((concept) => concept.next_review_at)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => new Date(first).getTime() - new Date(second).getTime())[0] || null;

  const initialOpenUnitId = useMemo(() => {
    const recommendedUnit = recommended ? units.find((unit) => unit.concepts.some((concept) => concept.id === recommended.id))?.id : null;
    const firstIncomplete = units.find((unit) => unit.concepts.some((concept) => !isConceptExplained(concept)))?.id;
    return recommendedUnit || firstIncomplete || units[0]?.id || null;
  }, [recommended, units]);
  const [openUnitIds, setOpenUnitIds] = useState<string[]>(initialOpenUnitId ? [initialOpenUnitId] : []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`feynduck-room-open-units:${room.id}`) || "null");
      if (!Array.isArray(saved)) return;
      setOpenUnitIds(saved.filter((id): id is string => typeof id === "string" && units.some((unit) => unit.id === id)));
    } catch {
      // Unit expansion is a local preference; keep the recommended unit open if storage is unavailable.
    }
  }, [room.id, units]);

  const setUnitOpen = (unitId: string, isOpen: boolean) => {
    setOpenUnitIds((current) => {
      const next = isOpen ? Array.from(new Set([...current, unitId])) : current.filter((id) => id !== unitId);
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
    const endTiming = startInteractionTiming("concept-session-open");
    setOpeningTarget(conceptId || "workspace");
    startTransition(() => {
      router.push(`${workspaceHref}${conceptParam}${recallParam}`);
      endTiming();
    });
  };

  const buildLearningPath = async () => {
    setIsBuildingPath(true);
    setError(null);
    try {
      const response = await fetch("/api/study-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Couldn’t build a learning path from this material yet.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t build a learning path from this material yet.");
    } finally {
      setIsBuildingPath(false);
    }
  };

  const addCustomConcept = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      router.push(result.data?.id ? `${workspaceHref}&conceptId=${encodeURIComponent(result.data.id)}` : workspaceHref);
      endTiming();
    });
  };

  const openRename = (target: RenameTarget) => {
    setDialogError(null);
    setRenameDraft(target.kind === "room" ? roomTitle : sourceTitle(target.source));
    setRenameTarget(target);
  };

  const confirmRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTarget) return;
    const nextTitle = renameDraft.trim();
    if (!nextTitle) {
      setDialogError("Enter a name.");
      return;
    }

    const target = renameTarget;
    startTransition(async () => {
      const result = target.kind === "room"
        ? await renameStudyRoomAction(room.id, nextTitle)
        : await renameRoomSourceAction(target.source.id, nextTitle, room.id);
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      if (target.kind === "room") setRoomTitle(nextTitle);
      setRenameTarget(null);
      router.refresh();
    });
  };

  const toggleSource = (source: SourceRow) => {
    setError(null);
    startTransition(async () => {
      const result = await toggleRoomSourceActiveAction(source.id, room.id, !source.is_active);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const result = target.kind === "room"
        ? await deleteStudyRoomAction(room.id)
        : await deleteRoomSourceAction(target.source.id, room.id);
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      setDeleteTarget(null);
      if (target.kind === "room") {
        router.push("/study");
      } else {
        router.refresh();
      }
    });
  };

  const metaParts = [
    `${sources.length} ${sources.length === 1 ? "source" : "sources"}`,
    sources.length ? `${totalChars.toLocaleString()} characters` : null,
    formatDate(room.created_at, true) ? `Created ${formatDate(room.created_at, true)}` : null,
  ].filter(Boolean);

  const recommendedLabel = recommendedStatus === "due_for_review"
    ? "Due for recall"
    : recommendedStatus === "gap_found"
      ? "Last weak link"
      : recommendedStatus === "not_started"
        ? "Start next concept"
        : "Next best step";

  return (
    <div className="fd">
      <AppHeader authUser={authUser} crumbs={[{ label: "Study rooms", href: "/study" }, { label: roomTitle }]} />

      <main className="fd-page is-room fd-enter">
        <div className="fd-page-head">
          <div>
            <h1 className="fd-page-title">{roomTitle}</h1>
            <p className="fd-room-meta">{metaParts.join(" · ")}</p>
          </div>
          <div className="fd-page-actions">
            <Menu
              label="Room options"
              trigger={<MoreHorizontal size={16} />}
              triggerClassName="fd-icon-btn fd-icon-btn-lg"
              items={[
                { label: "Rename room", icon: <Pencil size={16} strokeWidth={1.8} />, onSelect: () => openRename({ kind: "room" }) },
                {
                  label: "Delete room",
                  icon: <Trash2 size={16} strokeWidth={1.8} />,
                  danger: true,
                  onSelect: () => {
                    setDialogError(null);
                    setDeleteTarget({ kind: "room" });
                  },
                },
              ]}
            />
            <a
              href={workspaceHref}
              className="fd-btn fd-btn-dark"
              onMouseEnter={() => router.prefetch(workspaceHref)}
              onClick={(event) => {
                event.preventDefault();
                openConcept();
              }}
            >
              {openingTarget === "workspace" ? "Opening…" : "Open workspace"}
              {openingTarget === "workspace" ? <span className="fd-spinner" aria-hidden="true" /> : <ArrowRight size={16} className="fd-arrow" />}
            </a>
          </div>
        </div>

        {error ? (
          <div className="fd-notice is-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span style={{ flex: 1 }}>{error}</span>
            <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={() => setError(null)}>Dismiss</button>
          </div>
        ) : null}

        {recommended ? (
          <section className="fd-next-card" aria-label={recommendedLabel}>
            <div>
              <span className="fd-eyebrow is-amber">{recommendedLabel}</span>
              <h2>{recommended.title}</h2>
              <p>
                {recommended.main_unresolved_gap || recommended.main_gap ||
                  (recommendedStatus === "due_for_review"
                    ? "Explain it from memory to check the understanding stuck."
                    : recommended.description || "Start with this source-grounded concept.")}
              </p>
            </div>
            <button
              type="button"
              className="fd-btn fd-btn-accent fd-btn-lg"
              disabled={openingTarget !== null}
              onClick={() => openConcept(recommended.id, recommendedStatus === "due_for_review")}
            >
              {openingTarget === recommended.id
                ? "Opening…"
                : recommendedStatus === "due_for_review"
                  ? "Start recall"
                  : recommendedStatus === "not_started"
                    ? "Start explaining"
                    : "Continue"}
              {openingTarget === recommended.id ? <span className="fd-spinner" aria-hidden="true" /> : <ArrowRight size={16} className="fd-arrow" />}
            </button>
          </section>
        ) : allExplained ? (
          <section className="fd-callout is-success" aria-label="Room complete">
            <h3>You’ve explained every concept in this room clearly.</h3>
            <p>
              {nextReviewAt
                ? `No recall is due yet. The next one is ${formatDate(nextReviewAt)}.`
                : "Revisit any concept whenever you want to keep it fresh."}
            </p>
          </section>
        ) : null}

        <div className="fd-room-columns">
          <section aria-labelledby="path-h" className="fd-room-main">
            <div className="fd-section-head">
              <h2 id="path-h" className="fd-section-title">Learning path</h2>
              {concepts.length ? (
                <div className="fd-progress-summary" role="progressbar" aria-label="Concepts explained" aria-valuemin={0} aria-valuemax={concepts.length} aria-valuenow={explainedCount}>
                  <span className="fd-kicker">{explainedCount} / {concepts.length} explained</span>
                  <div className="fd-bar is-thin" style={{ width: 160 }}>
                    <span style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              ) : null}
            </div>

            {concepts.length === 0 ? (
              <div className="fd-card fd-empty-card" aria-busy={isBuildingPath}>
                <div className={cn("fd-path-illustration", isBuildingPath && "fd-pulse")} aria-hidden="true">
                  <div><span className="fd-ring" /><span className="fd-skeleton" style={{ flex: 1 }} /></div>
                  <div><span className="fd-ring" /><span className="fd-skeleton" style={{ width: "70%" }} /></div>
                  <div><span className="fd-ring" /><span className="fd-skeleton" style={{ width: "85%" }} /></div>
                </div>
                {isBuildingPath ? (
                  <>
                    <div className="fd-busy">
                      <span className="fd-spinner" aria-hidden="true" />
                      Mapping the concepts in your material…
                    </div>
                    <p>This usually takes under a minute.</p>
                  </>
                ) : sources.length ? (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <h3>No learning path yet</h3>
                      <p>Feynduck reads your source and lists the concepts in it, in the order worth learning them.</p>
                    </div>
                    <button type="button" className="fd-btn fd-btn-accent" onClick={buildLearningPath}>
                      Build learning path
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <h3>Add study material first</h3>
                      <p>Upload a PDF or paste notes, and Feynduck will map the concepts in it.</p>
                    </div>
                    <a href={workspaceHref} className="fd-btn fd-btn-accent">Add material</a>
                  </>
                )}
              </div>
            ) : (
              units.map((unit) => {
                const unitExplained = unit.concepts.filter(isConceptExplained).length;
                return (
                  <details
                    key={unit.id}
                    className="fd-unit"
                    open={openUnitIds.includes(unit.id)}
                    onToggle={(event) => setUnitOpen(unit.id, event.currentTarget.open)}
                  >
                    <summary>
                      <div>
                        <h3>{unit.title}</h3>
                        {unit.description ? <p>{unit.description}</p> : null}
                      </div>
                      <span className="fd-unit-meta">
                        {unitExplained} / {unit.concepts.length}
                        <ChevronDown size={16} className="fd-chevron" aria-hidden="true" />
                      </span>
                    </summary>
                    <ul className="fd-concept-list">
                      {unit.concepts.map((concept) => {
                        const status = effectiveStatus(concept);
                        const label = getConceptStatusLabel(concept.status, concept.next_review_at);
                        return (
                          <li key={concept.id}>
                            <button
                              type="button"
                              className="fd-concept-row"
                              disabled={openingTarget !== null}
                              onClick={() => openConcept(concept.id, status === "due_for_review")}
                            >
                              <span className="fd-concept-row-main">
                                <span className="fd-dot is-lg" data-status={status} aria-hidden="true" />
                                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                  <strong>{concept.title}</strong>
                                  <small>
                                    {label}
                                    {concept.latest_clarity_score != null ? (
                                      <span className="fd-mono"> · {concept.latest_clarity_score}</span>
                                    ) : null}
                                  </small>
                                </span>
                              </span>
                              <span className="fd-concept-row-note">{conceptGuidance(concept)}</span>
                              <span className="fd-concept-row-go" aria-hidden="true">
                                {openingTarget === concept.id ? <span className="fd-spinner" /> : <ArrowRight size={16} />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })
            )}

            <form className="fd-card fd-add-concept" onSubmit={addCustomConcept}>
              <label htmlFor="own-concept">
                <span>Add a concept yourself</span>
                <span>For anything in your material Feynduck didn’t list.</span>
              </label>
              <div>
                <input
                  id="own-concept"
                  className="fd-input fd-input-sm"
                  value={customConcept}
                  onChange={(event) => setCustomConcept(event.target.value)}
                  placeholder="e.g. Tubular reabsorption"
                />
                <button type="submit" className="fd-btn fd-btn-secondary" disabled={isPending && !renameTarget && !deleteTarget}>
                  Add
                </button>
              </div>
            </form>
          </section>

          <aside aria-labelledby="src-h" className="fd-room-aside">
            <div className="fd-section-head">
              <h2 id="src-h" className="fd-section-title">Sources</h2>
              <a href={workspaceHref} className="fd-btn fd-btn-ghost fd-btn-sm">
                <Plus size={14} strokeWidth={2} />
                Add
              </a>
            </div>
            {sources.length ? (
              sources.map((source) => (
                <div key={source.id} className={cn("fd-card fd-source-card", !source.is_active && "is-inactive")}>
                  <span className="fd-file-badge" aria-hidden="true">{source.source_type === "pdf" ? "PDF" : "TXT"}</span>
                  <div>
                    <strong title={sourceTitle(source)}>{sourceTitle(source)}</strong>
                    <span className="fd-kicker">{sourceMeta(source)}</span>
                  </div>
                  <Menu
                    label={`Options for ${sourceTitle(source)}`}
                    trigger={<MoreVertical size={16} />}
                    triggerClassName="fd-icon-btn is-plain fd-icon-btn-sm"
                    items={[
                      { label: "Rename", icon: <Pencil size={16} strokeWidth={1.8} />, onSelect: () => openRename({ kind: "source", source }) },
                      {
                        label: source.is_active ? "Exclude from learning path" : "Include in learning path",
                        icon: source.is_active ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />,
                        onSelect: () => toggleSource(source),
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 size={16} strokeWidth={1.8} />,
                        danger: true,
                        onSelect: () => {
                          setDialogError(null);
                          setDeleteTarget({ kind: "source", source });
                        },
                      },
                    ]}
                  />
                </div>
              ))
            ) : (
              <div className="fd-path-empty" style={{ margin: 0 }}>No material yet. Add a PDF or notes in the workspace.</div>
            )}
          </aside>
        </div>
      </main>

      <Dialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title={renameTarget?.kind === "source" ? "Rename source" : "Rename room"}
      >
        <form style={{ display: "flex", flexDirection: "column", gap: 20 }} onSubmit={confirmRename}>
          <div className="fd-field">
            <label htmlFor="rename-input" className="fd-label">Name</label>
            <input
              id="rename-input"
              className="fd-input"
              value={renameDraft}
              onChange={(event) => {
                setRenameDraft(event.target.value);
                setDialogError(null);
              }}
              onFocus={(event) => event.currentTarget.select()}
            />
            {dialogError ? <small className="fd-field-error">{dialogError}</small> : null}
          </div>
          <div className="fd-dialog-actions">
            <button type="button" className="fd-btn fd-btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button type="submit" className="fd-btn fd-btn-accent" disabled={isPending}>
              {isPending ? <span className="fd-spinner" aria-hidden="true" /> : null}
              Save
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        dismissible={!isPending}
        title={deleteTarget?.kind === "source" ? "Delete this material?" : "Delete this room?"}
        description={
          deleteTarget?.kind === "source"
            ? `“${sourceTitle(deleteTarget.source)}” will be removed from this room. This can’t be undone.`
            : `“${roomTitle}” and its study material will be deleted. This can’t be undone.`
        }
      >
        {dialogError ? (
          <div className="fd-notice is-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span>{dialogError}</span>
          </div>
        ) : null}
        <div className="fd-dialog-actions">
          <button type="button" className="fd-btn fd-btn-ghost" onClick={() => setDeleteTarget(null)} disabled={isPending}>Cancel</button>
          <button type="button" className="fd-btn fd-btn-danger" onClick={confirmDelete} disabled={isPending}>
            {isPending ? <span className="fd-spinner" aria-hidden="true" /> : null}
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
