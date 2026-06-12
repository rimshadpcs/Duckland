"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { GapResultPanel } from "@src/features/gap-analysis";
import { ArrowUp, Loader2, MessageSquareText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@src/lib/utils";
import { clampPanelWidth, getPanelWidth, savePanelWidth } from "@src/lib/storage/panelStorage";
import { getStudyRoomById, updateStudyRoom } from "@src/lib/storage/studyRoomsStorage";
import type { ExplanationRequest, ExplanationResult, StudyRoom } from "../types";

const initialRequest: ExplanationRequest = {
  notes: "",
  explanation: "",
};

type ExplainApiResponse = ExplanationResult & {
  mockMode?: boolean;
  warning?: string;
};

export function ExplainForm({ onRoomLoaded }: { onRoomLoaded?: (title: string, subject: string) => void }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [roomStatus, setRoomStatus] = useState<"loading" | "found" | "not_found" | "quick">("loading");
  const [request, setRequest] = useState<ExplanationRequest>(initialRequest);
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("roomId");
    if (id) {
      setRoomId(id);
      const found = getStudyRoomById(id);
      if (found) {
        setRoom(found);
        setRequest(prev => ({ ...prev, notes: found.notes || "" }));
        setRoomStatus("found");
        if (onRoomLoaded) onRoomLoaded(found.title, found.subject);
      } else {
        setRoomStatus("not_found");
      }
    } else {
      setRoomStatus("quick");
      if (onRoomLoaded) onRoomLoaded("Quick explain", "");
    }
  }, []);

  const handleSaveNotes = () => {
    setIsEditingNotes(false);
    if (roomId && room) {
      const updatedRoom = updateStudyRoom(roomId, {
        notes: request.notes,
        lastStudiedAt: Date.now(),
      });
      setRoom(updatedRoom ?? { ...room, notes: request.notes });
    }
  };

  // Resize State
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    setLeftWidth(getPanelWidth("left"));
    setRightWidth(getPanelWidth("right"));
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      savePanelWidth("left", leftWidth);
      savePanelWidth("right", rightWidth);
    }
  }, [leftWidth, rightWidth, isLoaded]);

  // Handle Dragging
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingLeft) {
        setLeftWidth(clampPanelWidth("left", e.clientX));
      } else if (isDraggingRight) {
        setRightWidth(clampPanelWidth("right", window.innerWidth - e.clientX));
      }
    };

    const handlePointerUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDraggingLeft, isDraggingRight]);

  const [history, setHistory] = useState<Array<{ role: "duck" | "student"; text: string }>>([]);

  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [history]);

  const updateField = (field: keyof ExplanationRequest, value: string) => {
    setRequest((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    if (isLoading || !request.explanation.trim()) return;
    
    if (request.notes.trim().length < 10) {
      setError("Please provide study material (min 10 characters).");
      setIsSourcePanelOpen(true);
      return;
    }

    const currentExplanation = request.explanation.trim();
    
    setHistory(prev => [...prev, { role: "student", text: currentExplanation }]);
    setIsLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: request.notes,
          explanation: currentExplanation
        }),
      });

      const payload = (await response.json()) as ExplainApiResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Could not analyse this explanation.");
      }

      const resultPayload = payload as ExplainApiResponse;
      setResult(resultPayload);

      if (resultPayload.mockMode && resultPayload.warning) {
        setNotice(resultPayload.warning);
      }
      
      if (roomId && resultPayload.status !== "topic_mismatch") {
        updateStudyRoom(roomId, {
          clarityScore: resultPayload.clarityScore ?? room?.clarityScore,
          lastStudiedAt: Date.now(),
        });
      }
      
      setHistory(prev => [...prev, { 
        role: "duck", 
        text: resultPayload.chatMessage || `You're close, but there's a reasoning gap. ${resultPayload.gapSummary} ${resultPayload.socraticQuestion}` 
      }]);
      
      setRequest(prev => ({ ...prev, explanation: "" }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "Could not analyse this explanation.";
      setResult(null);
      setError(errorMessage);
      setHistory(prev => [...prev, { role: "duck", text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (roomStatus === "loading") {
    return null;
  }

  if (roomStatus === "not_found") {
    return (
      <div className="empty-insights" style={{ height: '100vh', justifyContent: 'center' }}>
        <h4 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Study room not found</h4>
        <a href="/study" className="app-start-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', background: 'var(--duck)', color: 'var(--ink)' }}>Back to study rooms</a>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${!isSourcePanelOpen ? 'left-closed' : ''}`}>
      {/* Left Panel: Study Material */}
      <aside 
        className={`dashboard-panel left-panel ${!isSourcePanelOpen ? 'closed' : ''}`}
        style={{ 
          width: isSourcePanelOpen ? leftWidth : 0, 
          transition: isDraggingLeft ? "none" : undefined 
        }}
      >
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'inherit', fontWeight: 700 }}>Source Material</h3>
          <button 
            className="panel-toggle-btn" 
            onClick={() => setIsSourcePanelOpen(false)}
            aria-label="Close study material panel"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="panel-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--ink)' }}>{room ? room.title : "Quick explain"}</h4>
              <div className="source-meta">{room ? room.subject : "Study material added"}</div>
            </div>
          </div>

          {!request.notes && !isEditingNotes ? (
            <div className="empty-insights" style={{ alignItems: 'flex-start', textAlign: 'left', padding: '0', height: 'auto' }}>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--ink)' }}>No study material added yet</h4>
              <p style={{ marginBottom: '24px' }}>Add source material for Feynduck to use as the source.</p>
              <button 
                className="app-start-btn" 
                style={{ background: 'var(--amber)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setIsEditingNotes(true)}
              >
                Add material
              </button>
              <p style={{ fontSize: '0.75rem', marginTop: '12px', opacity: 0.6 }}>PDF upload coming later</p>
            </div>
          ) : isEditingNotes ? (
            <div>
              <textarea
                className="notes-textarea-minimal"
                placeholder="Add your study material here..."
                value={request.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={15}
                style={{ width: '100%', minWidth: '220px', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button 
                  className="source-action-btn" 
                  onClick={() => setIsEditingNotes(false)}
                  style={{ color: 'var(--muted)' }}
                >
                  Cancel
                </button>
                <button 
                  className="source-action-btn" 
                  onClick={handleSaveNotes}
                  style={{ color: 'var(--amber-dark)' }}
                >
                  Save material
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="metadata-pills">
                <span className="metadata-pill">Source material</span>
              </div>

              <div style={{ marginTop: '24px', position: 'relative' }}>
                <div className="notes-preview-card" style={{ whiteSpace: 'pre-wrap' }}>
                  {request.notes}
                </div>
              </div>
              <div className="source-actions">
                <button className="source-action-btn" onClick={() => setIsEditingNotes(true)}>Edit source</button>
              </div>
            </>
          )}
        </div>
      </aside>

      {isSourcePanelOpen && (
        <div
          className={cn("resize-handle", isDraggingLeft && "active")}
          onPointerDown={(e) => { e.preventDefault(); setIsDraggingLeft(true); }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize study material panel"
        />
      )}

      {/* Center Panel: Conversation */}
      <main className="dashboard-panel center-panel">
        {!isSourcePanelOpen && (
          <button 
            className="panel-toggle-btn sidebar-open-btn" 
            onClick={() => setIsSourcePanelOpen(true)}
            aria-label="Open study material panel"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}
        
        <div className="conversation-area" ref={conversationRef}>
          {!request.notes ? (
            <div className="empty-insights" style={{ height: '100%' }}>
              <h4 style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>Add study material to begin</h4>
              <p>Feynduck needs your material before it can check your explanation.</p>
            </div>
          ) : (
            <>
              {history.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="avatar">
                    {msg.role === "duck" ? (
                      <img src="/feynduckhead.png" alt="Duck" />
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>You</span>
                    )}
                  </div>
                  <div className="message-content">
                    <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  </div>
                </div>
              ))}
              {notice && <div className="app-notice">{notice}</div>}
              {error && <div className="app-error">{error}</div>}
            </>
          )}
        </div>

        <div className="composer-container">
          <div className="composer-label-icon">
            <MessageSquareText size={14} />
            <span>Your explanation</span>
          </div>
          <div className={`composer-wrapper ${isLoading ? "loading" : ""}`}>
            <textarea
              className="composer-textarea"
              placeholder={!request.notes ? "Add study material first..." : result ? "Try explaining it again..." : "Explain what you understand..."}
              value={request.explanation}
              onChange={(e) => updateField("explanation", e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={!request.notes}
            />
            <button
              className="composer-send-btn"
              onClick={handleSubmit}
              disabled={isLoading || !request.explanation.trim() || !request.notes}
              aria-label="Send explanation"
            >
              {isLoading ? (
                <Loader2 className="icon-spin" size={20} />
              ) : (
                <ArrowUp size={20} />
              )}
            </button>
          </div>
          <p className="composer-hint">
            <span className="kb-shortcut">Cmd + Enter to send</span>
          </p>
        </div>
      </main>

      <div
        className={cn("resize-handle", isDraggingRight && "active")}
        onPointerDown={(e) => { e.preventDefault(); setIsDraggingRight(true); }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize session insights panel"
      />

      {/* Right Panel: Insights */}
      <GapResultPanel result={result} isLoading={isLoading} width={rightWidth} isDragging={isDraggingRight} hasNotes={!!request.notes} />
    </div>
  );
}
