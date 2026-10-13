"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, FileText, MoreVertical, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { deleteStudyRoomAction, renameStudyRoomAction } from "@src/app/study/actions";
import { AppHeader } from "@src/components/app/AppHeader";
import { Dialog } from "@src/components/app/Dialog";
import { Menu } from "@src/components/app/Menu";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { StudyRoomWithSourceCount } from "@src/lib/repositories/study-rooms";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import { CreateRoomForm, HowFeynduckWorks } from "./CreateRoomForm";

const PINNED_ROOMS_KEY = "feynduck-pinned-room-ids";
const MAX_PINNED_ROOMS = 4;

function formatDate(value: string | null | undefined, withYear = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(date);
}

function sourceLabel(room: StudyRoomWithSourceCount) {
  const count = Number.isFinite(room.source_count) ? room.source_count : 0;
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

function lastActivity(room: StudyRoomWithSourceCount) {
  return room.last_activity_at || room.created_at;
}

function RoomStatus({ room }: { room: StudyRoomWithSourceCount }) {
  if (room.status === "clear") {
    return (
      <span className="fd-pill is-success">
        <span className="fd-dot is-sm" data-status="clear" />
        Clear
      </span>
    );
  }

  if (room.status === "not_started") {
    return (
      <span className="fd-pill">
        <span className="fd-dot is-sm" data-status="not_started" />
        Not started
      </span>
    );
  }

  return (
    <span className="fd-pill">
      <span className="fd-dot is-sm" data-status="gap_found" />
      In progress
    </span>
  );
}

export function StudyRoomsDashboard({
  authUser,
  initialRooms,
  loadError,
}: {
  authUser?: AuthenticatedUser;
  initialRooms: StudyRoomWithSourceCount[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState<StudyRoomWithSourceCount[]>(initialRooms);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renamingRoom, setRenamingRoom] = useState<StudyRoomWithSourceCount | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingRoom, setDeletingRoom] = useState<StudyRoomWithSourceCount | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError || null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PINNED_ROOMS_KEY) || "[]");
      if (Array.isArray(parsed)) {
        setPinnedRoomIds(parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_PINNED_ROOMS));
      }
    } catch {
      setPinnedRoomIds([]);
    }
  }, []);

  const updatePinnedRooms = (next: string[]) => {
    setPinnedRoomIds(next);
    try {
      localStorage.setItem(PINNED_ROOMS_KEY, JSON.stringify(next));
    } catch {
      // Pinning is a local preference; keep the UI usable if storage is blocked.
    }
  };

  const togglePin = (room: StudyRoomWithSourceCount) => {
    setError(null);
    if (pinnedRoomIds.includes(room.id)) {
      updatePinnedRooms(pinnedRoomIds.filter((id) => id !== room.id));
      return;
    }
    if (pinnedRoomIds.length >= MAX_PINNED_ROOMS) {
      setError(`You can pin up to ${MAX_PINNED_ROOMS} study rooms.`);
      return;
    }
    updatePinnedRooms([room.id, ...pinnedRoomIds]);
  };

  const openRoom = (roomId: string) => {
    const endTiming = startInteractionTiming("room-open");
    startTransition(() => {
      router.push(`/study/room/${roomId}`);
      endTiming();
    });
  };

  const confirmRename = () => {
    if (!renamingRoom) return;
    const nextTitle = renameDraft.trim();
    if (!nextTitle) {
      setDialogError("Enter a room name.");
      return;
    }
    if (nextTitle === renamingRoom.title) {
      setRenamingRoom(null);
      return;
    }

    const room = renamingRoom;
    const previousRooms = rooms;
    const endTiming = startInteractionTiming("room-rename");
    setRooms((current) => current.map((item) => (item.id === room.id ? { ...item, title: nextTitle } : item)));
    setRenamingRoom(null);
    startTransition(async () => {
      const result = await renameStudyRoomAction(room.id, nextTitle);
      if (!result.ok) {
        setRooms(previousRooms);
        setError(result.error);
      }
      endTiming();
    });
  };

  const confirmDelete = () => {
    if (!deletingRoom) return;
    const room = deletingRoom;
    const endTiming = startInteractionTiming("room-delete");
    startTransition(async () => {
      const result = await deleteStudyRoomAction(room.id);
      if (!result.ok) {
        setDialogError(result.error);
        endTiming();
        return;
      }
      setRooms((current) => current.filter((item) => item.id !== room.id));
      updatePinnedRooms(pinnedRoomIds.filter((id) => id !== room.id));
      setDeletingRoom(null);
      endTiming();
    });
  };

  const pinnedRooms = pinnedRoomIds
    .map((id) => rooms.find((room) => room.id === id))
    .filter((room): room is StudyRoomWithSourceCount => Boolean(room));
  const otherRooms = rooms.filter((room) => !pinnedRoomIds.includes(room.id));
  const continueRoom = [...rooms].sort(
    (first, second) => new Date(lastActivity(second) || 0).getTime() - new Date(lastActivity(first) || 0).getTime(),
  )[0] || null;
  const firstName = (authUser?.displayName || "").trim().split(/\s+/)[0];

  const renderRoomCard = (room: StudyRoomWithSourceCount, index: number) => {
    const isPinned = pinnedRoomIds.includes(room.id);
    const subtitle = room.selected_concept
      ? `Last: ${room.selected_concept}`
      : room.description || "No concepts yet";
    const date = formatDate(lastActivity(room));

    return (
      <article
        key={room.id}
        className="fd-card fd-card-hover fd-room-card"
        style={{ "--i": index } as CSSProperties}
        tabIndex={0}
        aria-label={`Open ${room.title}`}
        onClick={() => openRoom(room.id)}
        onMouseEnter={() => router.prefetch(`/study/room/${room.id}`)}
        onFocus={() => router.prefetch(`/study/room/${room.id}`)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openRoom(room.id);
          }
        }}
      >
        {isPinned ? <span className="fd-room-pin" aria-hidden="true" /> : null}
        <div className="fd-room-card-top">
          <div>
            <a
              className="fd-room-name"
              href={`/study/room/${room.id}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openRoom(room.id);
              }}
            >
              {room.title}
            </a>
            <span className="fd-room-sub">{subtitle}</span>
          </div>
          <Menu
            label={`Options for ${room.title}`}
            trigger={<MoreVertical size={16} />}
            triggerClassName="fd-icon-btn is-plain fd-icon-btn-sm"
            items={[
              {
                label: isPinned ? "Unpin" : "Pin to top",
                icon: isPinned ? <PinOff size={16} strokeWidth={1.8} /> : <Pin size={16} strokeWidth={1.8} />,
                onSelect: () => togglePin(room),
              },
              {
                label: "Rename",
                icon: <Pencil size={16} strokeWidth={1.8} />,
                onSelect: () => {
                  setDialogError(null);
                  setRenameDraft(room.title);
                  setRenamingRoom(room);
                },
              },
              {
                label: "Delete",
                icon: <Trash2 size={16} strokeWidth={1.8} />,
                danger: true,
                onSelect: () => {
                  setDialogError(null);
                  setDeletingRoom(room);
                },
              },
            ]}
          />
        </div>
        <div className="fd-room-card-foot">
          <span className="fd-kicker">
            {sourceLabel(room)}
            {date ? ` · ${date}` : ""}
          </span>
          <RoomStatus room={room} />
        </div>
      </article>
    );
  };

  return (
    <div className="fd">
      <AppHeader authUser={authUser} />

      {rooms.length === 0 ? (
        <main className="fd-page fd-enter" style={{ paddingTop: 56 }}>
          <div className="fd-page-head">
            <div>
              <h1 className="fd-page-title is-hero">{firstName ? `Welcome, ${firstName}` : "Welcome to Feynduck"}</h1>
              <p className="fd-page-sub">Start with one room — one exam, topic or paper you want to explain clearly.</p>
            </div>
          </div>
          {error ? (
            <div className="fd-notice is-error" role="alert">
              <AlertCircle size={16} strokeWidth={1.8} />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="fd-welcome-grid">
            <CreateRoomForm heading="Create your first study room" />
            <HowFeynduckWorks />
          </div>
        </main>
      ) : (
        <main className="fd-page fd-enter">
          <div className="fd-page-head">
            <div>
              <h1 className="fd-page-title">Study rooms</h1>
              <p className="fd-page-sub">One room per exam, topic or paper you want to explain clearly.</p>
            </div>
            <button type="button" className="fd-btn fd-btn-accent" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} strokeWidth={2} />
              New room
            </button>
          </div>

          {error ? (
            <div className="fd-notice is-error" role="alert">
              <AlertCircle size={16} strokeWidth={1.8} />
              <span style={{ flex: 1 }}>{error}</span>
              {loadError ? (
                <button type="button" className="fd-btn fd-btn-secondary fd-btn-sm" onClick={() => window.location.reload()}>
                  Retry
                </button>
              ) : (
                <button type="button" className="fd-btn fd-btn-ghost fd-btn-sm" onClick={() => setError(null)}>
                  Dismiss
                </button>
              )}
            </div>
          ) : null}

          {continueRoom ? (
            <section aria-label="Continue learning" className="fd-card fd-continue">
              <div className="fd-continue-main">
                <div className="fd-icon-tile" aria-hidden="true">
                  <FileText size={20} strokeWidth={1.8} />
                </div>
                <div>
                  <span className="fd-kicker">Pick up where you left off</span>
                  <span className="fd-continue-title">{continueRoom.title}</span>
                  <span className="fd-muted" style={{ fontSize: 13 }}>
                    {continueRoom.selected_concept ? `${continueRoom.selected_concept} · ` : ""}
                    {sourceLabel(continueRoom)}
                    {formatDate(lastActivity(continueRoom), true) ? ` · Last activity ${formatDate(lastActivity(continueRoom), true)}` : ""}
                  </span>
                </div>
              </div>
              <a
                href={`/study/session?roomId=${encodeURIComponent(continueRoom.id)}`}
                className="fd-btn fd-btn-dark"
                onMouseEnter={() => router.prefetch(`/study/session?roomId=${encodeURIComponent(continueRoom.id)}`)}
              >
                Continue
                <ArrowRight size={16} className="fd-arrow" />
              </a>
            </section>
          ) : null}

          {pinnedRooms.length ? (
            <section aria-label="Pinned rooms" className="fd-section">
              <div className="fd-section-head">
                <h2 className="fd-section-title">
                  Pinned <span className="fd-count">{pinnedRooms.length}/{MAX_PINNED_ROOMS}</span>
                </h2>
              </div>
              <div className="fd-room-grid fd-stagger">{pinnedRooms.map(renderRoomCard)}</div>
            </section>
          ) : null}

          {otherRooms.length ? (
            <section aria-label="All rooms" className="fd-section">
              <div className="fd-section-head">
                <h2 className="fd-section-title">
                  {pinnedRooms.length ? "Other rooms" : "All rooms"} <span className="fd-count">{otherRooms.length}</span>
                </h2>
              </div>
              <div className="fd-room-grid fd-stagger">{otherRooms.map(renderRoomCard)}</div>
            </section>
          ) : null}
        </main>
      )}

      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New study room"
        description="Name it after the exam, topic or paper you want to explain clearly."
        wide
      >
        <CreateRoomForm onCancel={() => setIsCreateOpen(false)} />
      </Dialog>

      <Dialog
        open={Boolean(renamingRoom)}
        onClose={() => setRenamingRoom(null)}
        title="Rename room"
      >
        <form
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
          onSubmit={(event) => {
            event.preventDefault();
            confirmRename();
          }}
        >
          <div className="fd-field">
            <label htmlFor="rename-room" className="fd-label">Room name</label>
            <input
              id="rename-room"
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
            <button type="button" className="fd-btn fd-btn-ghost" onClick={() => setRenamingRoom(null)}>Cancel</button>
            <button type="submit" className="fd-btn fd-btn-accent">Save</button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deletingRoom)}
        onClose={() => setDeletingRoom(null)}
        title="Delete this room?"
        description={deletingRoom ? `“${deletingRoom.title}” and its study material will be deleted. This can’t be undone.` : undefined}
        dismissible={!isPending}
      >
        {dialogError ? (
          <div className="fd-notice is-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span>{dialogError}</span>
          </div>
        ) : null}
        <div className="fd-dialog-actions">
          <button type="button" className="fd-btn fd-btn-ghost" onClick={() => setDeletingRoom(null)} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className="fd-btn fd-btn-danger" onClick={confirmDelete} disabled={isPending}>
            {isPending ? <span className="fd-spinner" aria-hidden="true" /> : null}
            {isPending ? "Deleting…" : "Delete room"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
