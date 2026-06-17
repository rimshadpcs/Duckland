"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createStudyRoomAction,
  deleteStudyRoomAction,
  renameStudyRoomAction,
} from "@src/app/study/actions";
import { AppNavbar } from "./AppNavbar";
import { useThemeMode } from "@src/lib/useThemeMode";
import { getStudyRooms as getLegacyStudyRooms } from "@src/lib/storage/studyRoomsStorage";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";

function formatDate(value: string) {
  return value.slice(0, 10);
}

function formatStatus(room: StudyRoomRow) {
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
  initialRooms: StudyRoomRow[];
  loadError?: string | null;
}) {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const [rooms, setRooms] = useState<StudyRoomRow[]>(initialRooms);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [error, setError] = useState<string | null>(loadError || null);
  const [hasLegacyRooms, setHasLegacyRooms] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setHasLegacyRooms(getLegacyStudyRooms().length > 0);
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

  const handleRenameRoom = (room: StudyRoomRow) => {
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

  const handleDeleteRoom = (room: StudyRoomRow) => {
    const confirmed = window.confirm(`Delete "${room.title}"? Its source material will be deleted too.`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteStudyRoomAction(room.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRooms((current) => current.filter((item) => item.id !== room.id));
    });
  };

  return (
    <div className="app-workspace dashboard-rooms">
      <AppNavbar themeMode={themeMode} toggleTheme={toggleTheme} mounted={mounted} isSession={false} authUser={authUser} />
      <main className="rooms-main">
        <header className="rooms-header">
          <h1>Your study rooms</h1>
          <p>Create a room for each exam, topic, or paper you want to explain clearly.</p>
        </header>

        {hasLegacyRooms ? (
          <div className="rooms-notice">
            You have study rooms saved on this device. Local room import will be available soon.
          </div>
        ) : null}

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

          {rooms.map((room) => (
            <div key={room.id} className="room-card local-room">
              <div className="card-top">
                <span className="room-subject">{room.selected_concept || room.description || "Study room"}</span>
                <h3>{room.title}</h3>
                <span className="room-meta">Last activity {formatDate(room.last_activity_at)}</span>
                <span className="room-meta">Created {formatDate(room.created_at)}</span>
              </div>
              <div className="card-bottom">
                <span className="room-status">
                  {room.latest_clarity_score != null ? `Clarity ${room.latest_clarity_score}%` : formatStatus(room)}
                </span>
                <div className="room-card-actions">
                  <button type="button" className="card-cta" onClick={() => handleRenameRoom(room)} disabled={isPending}>
                    Rename
                  </button>
                  <button type="button" className="card-cta danger" onClick={() => handleDeleteRoom(room)} disabled={isPending}>
                    Delete
                  </button>
                  <button
                    type="button"
                    className="card-cta"
                    onClick={() => {
                      window.location.href = `/study/session?roomId=${room.id}`;
                    }}
                  >
                    Open &rarr;
                  </button>
                </div>
              </div>
            </div>
          ))}
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
