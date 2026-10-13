"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Upload, X } from "lucide-react";
import { createStudyRoomAction, saveRoomSourceAction } from "@src/app/study/actions";
import { formatFileSize, uploadPdfSource, validatePdfFile } from "@src/lib/pdf/uploadPdfSource";
import { startInteractionTiming } from "@src/lib/performance/interactionTiming";
import { cn } from "@src/lib/utils";

type MaterialMode = "pdf" | "paste";

export function CreateRoomForm({
  heading,
  onCancel,
}: {
  heading?: string;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<MaterialMode>("pdf");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  const pickFile = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const validationError = validatePdfFile(next);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(next);
  };

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    pickFile(event.dataTransfer.files?.[0] || null);
  };

  const openSession = (roomId: string) => {
    router.push(`/study/session?roomId=${encodeURIComponent(roomId)}`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;

    if (createdRoomId) {
      openSession(createdRoomId);
      return;
    }

    const roomTitle = title.trim();
    if (!roomTitle) {
      setTitleError("Give your room a name.");
      return;
    }
    if (mode === "paste" && pastedText.trim() && pastedText.trim().length < 10) {
      setError("Paste at least a sentence or two, or leave it empty and add material later.");
      return;
    }

    setTitleError(null);
    setError(null);
    setIsBusy(true);
    setStatus("Creating your room…");
    const endTiming = startInteractionTiming("room-create");

    const created = await createStudyRoomAction({ title: roomTitle });
    if (!created.ok) {
      setError(created.error);
      setStatus(null);
      setIsBusy(false);
      endTiming();
      return;
    }

    const roomId = created.data.id;

    try {
      if (mode === "pdf" && file) {
        await uploadPdfSource({
          file,
          roomId,
          roomTitle,
          onStatus: setStatus,
          onProgress: (currentPage, totalPages) => setProgress(Math.round((currentPage / totalPages) * 100)),
        });
      } else if (mode === "paste" && pastedText.trim()) {
        setStatus("Saving your notes…");
        const saved = await saveRoomSourceAction({ roomId, roomTitle, content: pastedText.trim() });
        if (!saved.ok) throw new Error(saved.error);
      }

      setStatus("Opening your room…");
      openSession(roomId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save your material.";
      setCreatedRoomId(roomId);
      setError(`Your room was created, but the material wasn’t saved: ${message} You can add it from the room.`);
      setStatus(null);
      setIsBusy(false);
    } finally {
      setProgress(null);
      endTiming();
    }
  };

  return (
    <form className={heading ? "fd-create-card" : undefined} style={heading ? undefined : { display: "flex", flexDirection: "column", gap: 22 }} onSubmit={handleSubmit} noValidate>
      {heading ? <h2>{heading}</h2> : null}

      <div className="fd-field">
        <label htmlFor="room-name" className="fd-label">Room name</label>
        <input
          id="room-name"
          className="fd-input"
          style={{ height: 48, borderRadius: 10, fontSize: 16 }}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(null);
          }}
          placeholder="e.g. Data Structures — midterm"
          aria-invalid={titleError ? true : undefined}
          disabled={isBusy || Boolean(createdRoomId)}
          data-autofocus
        />
        {titleError ? <small className="fd-field-error">{titleError}</small> : null}
      </div>

      {createdRoomId ? null : (
        <div className="fd-field" style={{ gap: 8 }}>
          <div className="fd-support-row" style={{ gap: 12 }}>
            <span className="fd-label">Study material <span className="fd-optional">(optional)</span></span>
            <div role="tablist" aria-label="Material type" className="fd-segmented is-compact">
              {([
                ["pdf", "Upload PDF"],
                ["paste", "Paste text"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => setMode(id)}
                  disabled={isBusy}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "pdf" ? (
            <label
              className={cn("fd-dropzone", isDragging && "is-dragging", file && "has-file")}
              onDragEnter={handleDragEnter}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {file ? (
                <>
                  <span className="fd-file-badge" aria-hidden="true">PDF</span>
                  <span className="fd-dropzone-title">{file.name}</span>
                  <span className="fd-dropzone-hint">{formatFileSize(file.size)} · click or drop to replace</span>
                  {!isBusy ? (
                    <button
                      type="button"
                      className="fd-icon-btn is-plain fd-icon-btn-sm"
                      style={{ position: "absolute", top: 8, right: 8 }}
                      aria-label="Remove PDF"
                      onClick={(event) => {
                        event.preventDefault();
                        pickFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <Upload size={26} strokeWidth={1.8} aria-hidden="true" />
                  <span className="fd-dropzone-title">
                    {isDragging ? "Drop your PDF here" : <>Drop a PDF or <u>browse</u></>}
                  </span>
                  <span className="fd-dropzone-hint">Lecture slides, notes or a paper · selectable-text PDF, up to 10 MB and 100 pages</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                disabled={isBusy}
                onChange={(event) => pickFile(event.target.files?.[0] || null)}
              />
            </label>
          ) : (
            <>
              <label htmlFor="room-text" className="fd-sr-only">Pasted text</label>
              <textarea
                id="room-text"
                className="fd-textarea"
                rows={7}
                style={{ borderRadius: 10, padding: "12px 14px" }}
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder="Paste your notes or text…"
                disabled={isBusy}
              />
            </>
          )}
        </div>
      )}

      {error ? (
        <div className="fd-notice is-error" role="alert">
          <AlertCircle size={16} strokeWidth={1.8} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="fd-create-foot">
        {isBusy && status ? (
          <div className="fd-upload-progress" aria-live="polite" style={{ flex: "1 1 200px" }}>
            <span className="fd-busy" style={{ fontSize: 13 }}>
              <span className="fd-spinner" aria-hidden="true" />
              {status}
            </span>
            {progress !== null ? (
              <div className="fd-bar is-thin"><span style={{ width: `${progress}%` }} /></div>
            ) : null}
          </div>
        ) : (
          <span className="fd-hint-text">
            {createdRoomId ? "Open the room to add material and start explaining." : "You can add more material later."}
          </span>
        )}
        <div className="fd-page-actions">
          {onCancel && !isBusy ? (
            <button type="button" className="fd-btn fd-btn-ghost fd-btn-lg" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="fd-btn fd-btn-accent fd-btn-lg" disabled={isBusy}>
            {createdRoomId ? "Open room" : "Create room"}
            {isBusy ? <span className="fd-spinner" aria-hidden="true" /> : <ArrowRight size={16} className="fd-arrow" />}
          </button>
        </div>
      </div>
    </form>
  );
}

export function HowFeynduckWorks() {
  const steps = [
    ["Add your material", "Feynduck maps the concepts in it into a learning path."],
    ["Explain a concept", "Type or say it in your own words, as if teaching a friend."],
    ["Fix the missing link", "Get a clarity score, then quizzes and flashcards built from your gaps."],
  ];

  return (
    <aside aria-labelledby="how-h" className="fd-how">
      <h2 id="how-h" className="fd-section-title">How Feynduck works</h2>
      <ol className="fd-steps">
        {steps.map(([title, body], index) => (
          <li key={title}>
            <span className={cn("fd-step-num", index === 0 && "is-active")}>{index + 1}</span>
            <div>
              <span>{title}</span>
              <span>{body}</span>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
