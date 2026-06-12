"use client";

import { useState, useEffect } from "react";
import { AppNavbar } from "./AppNavbar";
import { useThemeMode } from "@src/lib/useThemeMode";
import { getStudyRooms, saveStudyRooms } from "@src/lib/storage/studyRoomsStorage";
import type { StudyRoom } from "../types";

export function StudyRoomsDashboard() {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomSubject, setNewRoomSubject] = useState("");
  const [newRoomNotes, setNewRoomNotes] = useState("");

  useEffect(() => {
    setRooms(getStudyRooms());
  }, []);

  const handleCreateRoom = () => {
    const newRoom: StudyRoom = {
      id: Math.random().toString(36).substring(2, 11),
      title: newRoomTitle || "Untitled Room",
      subject: newRoomSubject || "General",
      notes: newRoomNotes,
      createdAt: Date.now(),
    };
    const updated = [newRoom, ...rooms];
    setRooms(updated);
    saveStudyRooms(updated);
    setIsModalOpen(false);
    
    // Redirect to the new room session
    window.location.href = `/study/session?roomId=${newRoom.id}`;
  };

  return (
    <div className="app-workspace dashboard-rooms">
      <AppNavbar themeMode={themeMode} toggleTheme={toggleTheme} mounted={mounted} isSession={false} />
      <main className="rooms-main">
        <header className="rooms-header">
          <h1>Your study rooms</h1>
          <p>Create a room for each exam, topic, or paper you want to explain clearly.</p>
        </header>

        <div className="rooms-grid">
          <div className="room-card create-card" onClick={() => setIsModalOpen(true)}>
            <div className="create-icon">+</div>
            <h3>Create study room</h3>
            <p>Add study material, explain concepts, and find the gaps before the exam does.</p>
          </div>

          <div className="room-card quick-card" onClick={() => window.location.href = '/study/session'}>
            <div className="card-top">
              <h3>Quick explain</h3>
              <p>Add study material and test one explanation without setting up a room.</p>
            </div>
            <div className="card-bottom">
              <span className="card-cta">Start</span>
            </div>
          </div>

          {rooms.map(room => (
            <div key={room.id} className="room-card local-room" onClick={() => window.location.href = `/study/session?roomId=${room.id}`}>
              <div className="card-top">
                <span className="room-subject">{room.subject}</span>
                <h3>{room.title}</h3>
                <span className="room-meta">{room.notes ? "Material added" : "No material yet"}</span>
              </div>
              <div className="card-bottom">
                <span className="room-status">
                  {room.clarityScore ? `Clarity ${room.clarityScore}%` : "Not tested yet"}
                </span>
                <span className="card-cta">Open &rarr;</span>
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
                  placeholder="Biology Midterm" 
                  value={newRoomTitle} 
                  onChange={(e) => setNewRoomTitle(e.target.value)} 
                />
              </div>
              <div className="input-group">
                <label>Subject</label>
                <input 
                  type="text" 
                  placeholder="Biology, Law, Economics..." 
                  value={newRoomSubject} 
                  onChange={(e) => setNewRoomSubject(e.target.value)} 
                />
              </div>
              <div className="input-group">
                <label>Optional source material</label>
                <textarea 
                  placeholder="Add study material now, or add it later..." 
                  value={newRoomNotes} 
                  onChange={(e) => setNewRoomNotes(e.target.value)} 
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="modal-btn-create" onClick={handleCreateRoom}>Create room</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
