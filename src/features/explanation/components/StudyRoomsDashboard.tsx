"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createStudyRoomAction,
  deleteStudyRoomAction,
  renameStudyRoomAction,
} from "@src/app/study/actions";
import { AppNavbar } from "./AppNavbar";
import { useThemeMode } from "@src/lib/useThemeMode";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { StudyRoomWithSourceCount } from "@src/lib/repositories/study-rooms";
import { MoreVertical } from "lucide-react";

const PINNED_ROOMS_KEY = "feynduck-pinned-room-ids";
const MAX_PINNED_ROOMS = 4;

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatus(room: StudyRoomWithSourceCount) {
  if (room.status === "clear") return "Clear";
  if (room.status === "in_progress") return "In progress";
  return "Not started";
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
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const [rooms, setRooms] = useState<StudyRoomWithSourceCount[]>(initialRooms);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);
  const [openMenuRoomId, setOpenMenuRoomId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
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

  useEffect(() => {
    const closeMenu = () => setOpenMenuRoomId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const handleCreateRoom = () => {
    const title = newRoomTitle.trim();
    if (!title) {
      setError("Enter a room name.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createStudyRoomAction({
        title,
        description: newRoomDescription,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      window.location.href = `/study/session?roomId=${result.data.id}`;
    });
  };

  const openRoom = (roomId: string) => {
    window.location.href = `/study/session?roomId=${roomId}`;
  };

  const updatePinnedRooms = (nextPinnedRoomIds: string[]) => {
    setPinnedRoomIds(nextPinnedRoomIds);
    localStorage.setItem(PINNED_ROOMS_KEY, JSON.stringify(nextPinnedRoomIds));
  };

  const handleTogglePin = (room: StudyRoomWithSourceCount) => {
    setError(null);
    const isPinned = pinnedRoomIds.includes(room.id);
    if (isPinned) {
      updatePinnedRooms(pinnedRoomIds.filter((id) => id !== room.id));
      return;
    }

    if (pinnedRoomIds.length >= MAX_PINNED_ROOMS) {
      setError("You can pin up to 4 study rooms.");
      return;
    }

    updatePinnedRooms([room.id, ...pinnedRoomIds]);
  };

  const handleRenameRoom = (room: StudyRoomWithSourceCount) => {
    const nextTitle = window.prompt("Rename study room", room.title)?.trim();
    if (!nextTitle || nextTitle === room.title) return;

    startTransition(async () => {
      const previousRooms = rooms;
      setRooms((current) => current.map((item) => (item.id === room.id ? { ...item, title: nextTitle } : item)));
      const result = await renameStudyRoomAction(room.id, nextTitle);
      if (!result.ok) {
        setRooms(previousRooms);
        setError(result.error);
      }
    });
  };

  const handleDeleteRoom = (room: StudyRoomWithSourceCount) => {
    const confirmed = window.confirm(`Delete "${room.title}"? Its source material will be deleted too.`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteStudyRoomAction(room.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRooms((current) => current.filter((item) => item.id !== room.id));
      updatePinnedRooms(pinnedRoomIds.filter((id) => id !== room.id));
    });
  };

  const pinnedRooms = pinnedRoomIds
    .map((id) => rooms.find((room) => room.id === id))
    .filter((room): room is StudyRoomWithSourceCount => Boolean(room));
  const unpinnedRooms = rooms.filter((room) => !pinnedRoomIds.includes(room.id));

  const renderRoomCard = (room: StudyRoomWithSourceCount) => {
    const statusText = room.latest_clarity_score != null ? `Clarity ${room.latest_clarity_score}%` : formatStatus(room);
    const sourceCount = Number.isFinite(room.source_count) ? room.source_count : 0;
    const sourceLabel = `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`;
    const isPinned = pinnedRoomIds.includes(room.id);

    return (
      <article
        key={room.id}
        className={`room-card local-room room-card-link ${isPinned ? "pinned-room-card" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => openRoom(room.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openRoom(room.id);
          }
        }}
      >
        <div className="room-card-menu">
          <button
            type="button"
            className="room-menu-trigger"
            aria-label={`Open options for ${room.title}`}
            aria-expanded={openMenuRoomId === room.id}
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenuRoomId((current) => (current === room.id ? null : room.id));
            }}
          >
            <MoreVertical size={18} />
          </button>
          {openMenuRoomId === room.id ? (
            <div className="room-menu-popover" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => handleTogglePin(room)}>
                {isPinned ? "Unpin" : "Pin to top"}
              </button>
              <button type="button" onClick={() => handleRenameRoom(room)} disabled={isPending}>
                Edit name
              </button>
              <button type="button" className="danger" onClick={() => handleDeleteRoom(room)} disabled={isPending}>
                Delete
              </button>
            </div>
          ) : null}
        </div>
        <div className="card-top">
          <span className="room-subject">{room.selected_concept || room.description || "Study room"}</span>
          <h3>{room.title}</h3>
          <p className="room-card-summary">{sourceLabel}</p>
          <div className="room-date-list">
            <span className="room-meta">Last activity {formatDate(room.last_activity_at)}</span>
            <span className="room-meta">Created {formatDate(room.created_at)}</span>
          </div>
        </div>
        <div className="card-bottom">
          <span className={`room-status ${room.status === "in_progress" ? "in-progress" : ""}`}>
            <span aria-hidden="true" />
            {statusText}
          </span>
          <span className="room-card-arrow" aria-hidden="true">→</span>
        </div>
      </article>
    );
  };

  return (
    <div className="app-workspace dashboard-rooms">
      <AppNavbar themeMode={themeMode} toggleTheme={toggleTheme} mounted={mounted} isSession={false} authUser={authUser} />
      <main className="rooms-main">
        <header className="rooms-header">
          <h1>Your study rooms</h1>
          <p>Create a room for each exam, topic, or paper you want to explain clearly.</p>
        </header>

        {error ? (
          <div className="rooms-error">
            <span>{error || "We couldn't load your study rooms."}</span>
            <button type="button" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : null}

        <div className="rooms-grid">
          <div className="room-card create-card" onClick={() => setIsModalOpen(true)}>
            <div className="create-icon">+</div>
            <h3>Create study room</h3>
            <p>Add material and start explaining what you understand.</p>
          </div>

          {rooms.length === 0 ? (
            <div className="room-card empty-room-card">
              <div className="card-top">
                <h3>Create your first study room</h3>
                <p>Add material and start explaining what you understand.</p>
              </div>
            </div>
          ) : null}

          {pinnedRooms.length ? (
            <div className="rooms-section-heading">
              <span>Pinned</span>
              <small>{pinnedRooms.length}/{MAX_PINNED_ROOMS}</small>
            </div>
          ) : null}
          {pinnedRooms.map(renderRoomCard)}

          {pinnedRooms.length && unpinnedRooms.length ? (
            <div className="rooms-section-heading all-rooms-heading">
              <span>All rooms</span>
            </div>
          ) : null}
          {unpinnedRooms.map(renderRoomCard)}
        </div>
      </main>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create study room</h3>
            <div className="modal-body">
              <div className="input-group">
                <label>Room name</label>
                <input
                  type="text"
                  placeholder="Kidney physiology"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Optional description</label>
                <input
                  type="text"
                  placeholder="Human anatomy, finals, lecture 4..."
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setIsModalOpen(false)} disabled={isPending}>
                Cancel
              </button>
              <button className="modal-btn-create" onClick={handleCreateRoom} disabled={isPending}>
                {isPending ? "Creating..." : "Create room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
