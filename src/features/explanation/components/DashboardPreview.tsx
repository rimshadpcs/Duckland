"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileText, Link2, Loader2, Mic, Type, Upload, X } from "lucide-react";
import { Duck } from "./Duck";

type DashboardPreviewProps = {
  activeStep?: number;
  compact?: boolean;
};

const statusLabels = [
  "Add your material",
  "Ready to explain",
  "Missing link found",
  "Re-explain the gap",
  "Clarity tracked",
  "Built from your gap",
];

const panelClass = (panel: "source" | "conversation" | "insights", activeStep: number) => {
  const activePanelByStep = ["source", "conversation", "insights", "conversation", "insights", "insights"];
  const isActive = activePanelByStep[activeStep] === panel;
  const shouldMute =
    (activeStep === 0 && panel !== "source") ||
    (activeStep === 1 && panel === "insights") ||
    (activeStep === 2 && panel === "source") ||
    (activeStep === 3 && panel !== "conversation") ||
    (activeStep === 4 && panel !== "insights") ||
    (activeStep === 5 && panel !== "insights");

  return [
    "landing-preview-panel",
    panel,
    isActive ? "is-active" : "",
    shouldMute ? "is-muted" : "",
    (activeStep === 0 || activeStep === 1) && panel === "insights" ? "is-quiet" : "",
  ]
    .filter(Boolean)
    .join(" ");
};

type StudyToolTab = "insights" | "quiz" | "flashcards";
type VoiceDemoStatus = "idle" | "recording" | "transcribing" | "ready_to_edit" | "error";

type DemoEvaluation = {
  clarityScore: number;
  scoreLabel: string;
  summary: string;
  missingLink: string;
  followUpQuestion: string;
  hint: string;
};

const demoTopic = "Krebs cycle and oxygen";
const demoQuestion = "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.";
const waveformBarCount = 34;

const studyToolTabs: { id: StudyToolTab; label: string }[] = [
  { id: "insights", label: "Feedback" },
  { id: "quiz", label: "Quiz" },
  { id: "flashcards", label: "Flashcards" },
];

function formatRecordingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString();
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function appendTranscript(existingText: string, transcript: string) {
  const existing = existingText.trim();
  const next = transcript.trim();
  if (!existing) return next;
  if (!next) return existing;
  return `${existing}\n\n${next}`;
}

export function DashboardPreview({ activeStep = 0, compact = false }: DashboardPreviewProps) {
  const [activeToolTab, setActiveToolTab] = useState<StudyToolTab>(activeStep === 5 ? "quiz" : "insights");
  const [voiceStatus, setVoiceStatus] = useState<VoiceDemoStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [demoTranscript, setDemoTranscript] = useState<string | null>(null);
  const [demoEvaluation, setDemoEvaluation] = useState<DemoEvaluation | null>(null);
  const [isDemoEvaluating, setIsDemoEvaluating] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(() => Array.from({ length: waveformBarCount }, () => 0.18));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const shouldSubmitRecordingRef = useRef(false);
  const isSubmittingVoiceRef = useRef(false);
  const status = statusLabels[activeStep] ?? statusLabels[0];
  const showFeedback = activeStep >= 2;
  const hasVoiceDemo = Boolean(demoTranscript || demoEvaluation || voiceStatus !== "idle");

  useEffect(() => {
    setActiveToolTab(activeStep === 5 ? "quiz" : "insights");
  }, [activeStep]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
      cleanupRecording();
    };
  }, []);

  const cleanupRecording = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    setRecordingSeconds(0);
    setWaveformBars(Array.from({ length: waveformBarCount }, () => 0.18));
  };

  const startLocalAudioMeter = (stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bucketSize = Math.max(1, Math.floor(data.length / waveformBarCount));
      const nextBars = Array.from({ length: waveformBarCount }, (_, index) => {
        const start = index * bucketSize;
        const bucket = data.slice(start, start + bucketSize);
        const average = bucket.reduce((sum, value) => sum + value, 0) / Math.max(1, bucket.length);
        return Math.max(0.14, Math.min(1, average / 150));
      });
      setWaveformBars(nextBars);
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
    recordingStartedAtRef.current = Date.now();
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
    }, 250);
  };

  const submitVoiceRecording = async (audioBlob: Blob) => {
    if (isSubmittingVoiceRef.current) return;
    isSubmittingVoiceRef.current = true;
    setVoiceError(null);

    try {
      if (audioBlob.size < 512) {
        throw new Error("Recording was empty. Try speaking for a little longer.");
      }

      setVoiceStatus("transcribing");
      const formData = new FormData();
      formData.append("audio", audioBlob, "feynduck-demo.webm");
      const transcribeResponse = await fetch("/api/demo-transcribe", {
        method: "POST",
        body: formData,
      });
      const transcribePayload = (await transcribeResponse.json()) as { transcript?: string; error?: string };

      if (!transcribeResponse.ok || !transcribePayload.transcript) {
        throw new Error(transcribePayload.error || "Feynduck could not transcribe that recording.");
      }

      const transcript = transcribePayload.transcript.trim();
      setVoiceDraft((current) => appendTranscript(current, transcript));
      setVoiceStatus("ready_to_edit");
    } catch (error) {
      setVoiceStatus("error");
      setVoiceError(error instanceof Error ? error.message : "Voice explanation failed. Try again.");
    } finally {
      isSubmittingVoiceRef.current = false;
    }
  };

  const evaluateDemoAnswer = async () => {
    const transcript = voiceDraft.trim();
    if (!transcript || isDemoEvaluating) return;

    try {
      setIsDemoEvaluating(true);
      setVoiceError(null);
      setDemoTranscript(transcript);
      const evaluateResponse = await fetch("/api/demo-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          topic: demoTopic,
          question: demoQuestion,
        }),
      });
      const evaluationPayload = (await evaluateResponse.json()) as Partial<DemoEvaluation> & { error?: string };

      if (!evaluateResponse.ok || typeof evaluationPayload.clarityScore !== "number") {
        throw new Error(evaluationPayload.error || "Feynduck could not evaluate that explanation.");
      }

      setDemoEvaluation({
        clarityScore: evaluationPayload.clarityScore,
        scoreLabel: evaluationPayload.scoreLabel || "Getting there",
        summary: evaluationPayload.summary || "Feynduck found the main gap in your explanation.",
        missingLink: evaluationPayload.missingLink || "The missing link is how oxygen keeps NAD+ regeneration going.",
        followUpQuestion: evaluationPayload.followUpQuestion || "What happens to NADH when oxygen is unavailable?",
        hint: evaluationPayload.hint || "Think about where NADH normally delivers its electrons.",
      });
      setActiveToolTab("insights");
      setVoiceStatus("idle");
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Voice evaluation failed. Try again.");
    } finally {
      setIsDemoEvaluating(false);
    }
  };

  const stopRecording = (shouldSubmit: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    shouldSubmitRecordingRef.current = shouldSubmit;
    recorder.stop();
  };

  const cancelRecording = () => {
    if (voiceStatus === "recording") {
      stopRecording(false);
      return;
    }

    cleanupRecording();
    setVoiceStatus("idle");
  };

  const confirmRecording = () => {
    if (voiceStatus !== "recording") return;
    stopRecording(true);
    setVoiceStatus("transcribing");
  };

  const startRecording = async () => {
    if (voiceStatus === "recording") {
      return;
    }

    if (voiceStatus === "transcribing" || isDemoEvaluating) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("error");
      setVoiceError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setVoiceStatus("recording");
      setVoiceError(null);
      setDemoTranscript(null);
      setDemoEvaluation(null);
      audioChunksRef.current = [];
      shouldSubmitRecordingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      startLocalAudioMeter(stream);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        cleanupRecording();
        setVoiceStatus("error");
        setVoiceError("Recording failed. Try again.");
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        const shouldSubmit = shouldSubmitRecordingRef.current;
        cleanupRecording();
        if (shouldSubmit) {
          void submitVoiceRecording(blob);
        } else {
          setVoiceStatus("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (error) {
      cleanupRecording();
      setVoiceStatus("error");
      const isDenied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setVoiceError(isDenied ? "Microphone permission was denied." : "Could not start the microphone.");
    }
  };

  const renderComposer = ({
    placeholder,
    micLabel = "Explain by voice",
    disabled = false,
    helper,
    secondary = false,
  }: {
    placeholder: string;
    micLabel?: string;
    disabled?: boolean;
    helper?: string;
    secondary?: boolean;
  }) => {
    const isBusy = voiceStatus === "transcribing" || isDemoEvaluating;
    const isRecording = voiceStatus === "recording";
    const isReadyToEdit = voiceStatus === "ready_to_edit" && Boolean(voiceDraft.trim());
    const isVoiceActive = isRecording || voiceStatus === "transcribing";
    const voiceStatusLabel = voiceStatus === "transcribing" ? "Transcribing" : "Listening";
    const helperText = voiceError ||
      (isReadyToEdit
        ? "Transcript ready. Edit it, add another voice note, or check it."
        : helper);

    return (
    <div
      className={[
        "landing-composer",
        "is-multiline",
        disabled ? "is-disabled" : "is-active voice-enabled",
        isVoiceActive && !disabled ? "is-recording" : "",
        isReadyToEdit && !disabled ? "is-ready-to-check" : "",
        secondary ? "is-secondary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        className="landing-mic-button"
        type="button"
        aria-label={isRecording ? "Stop recording" : micLabel}
        aria-pressed={isRecording}
        disabled={disabled || isVoiceActive}
        onClick={startRecording}
      >
        {isBusy ? <Loader2 className="icon-spin" size={16} /> : <Mic size={16} />}
      </button>
      <div className="landing-composer-copy">
        <textarea
          key={isVoiceActive ? "voice" : "idle"}
          aria-label={placeholder}
          disabled={disabled || isVoiceActive || isDemoEvaluating}
          value={voiceDraft}
          onChange={(event) => setVoiceDraft(event.target.value)}
          placeholder={
            isRecording && !disabled
              ? "Listening..."
              : voiceStatus === "transcribing" && !disabled
                ? "Transcribing your explanation..."
                : isDemoEvaluating && !disabled
                  ? "Feynduck is checking the missing link..."
                  : placeholder
          }
          rows={2}
        />
        {isVoiceActive ? (
          <div className="voice-inline-status" aria-live="polite">
            <span className="voice-inline-dot" />
            <small>{voiceStatusLabel} · {formatRecordingTime(recordingSeconds)}</small>
          </div>
        ) : helperText ? <small>{helperText}</small> : null}
        {isVoiceActive ? (
          <div className="voice-inline-waveform" aria-hidden="true">
            {waveformBars.slice(0, 18).map((level, index) => (
              <span key={index} style={{ transform: `scaleY(${0.28 + level})` }} />
            ))}
          </div>
        ) : null}
      </div>
      {isVoiceActive ? (
        <div className="voice-inline-actions">
          <button type="button" aria-label="Cancel voice explanation" disabled={isBusy} onClick={cancelRecording}>
            <X size={14} />
          </button>
          <button type="button" aria-label="Use this voice explanation" disabled={!isRecording || isBusy} onClick={confirmRecording}>
            {isBusy ? <Loader2 className="icon-spin" size={14} /> : <Check size={15} />}
          </button>
        </div>
      ) : (
        <button
          className={isReadyToEdit ? "landing-check-button" : ""}
          type="button"
          aria-label="Send explanation"
          disabled={disabled || isDemoEvaluating || !voiceDraft.trim()}
          onClick={evaluateDemoAnswer}
        >
          {isDemoEvaluating ? <Loader2 className="icon-spin" size={14} /> : isReadyToEdit ? "Check" : "↑"}
        </button>
      )}
    </div>
    );
  };

  const renderInsightsPanel = () => {
    if (hasVoiceDemo) {
      const isPending = voiceStatus === "recording" || voiceStatus === "transcribing" || isDemoEvaluating;

      return (
        <>
          <div className={`landing-insight-card missing-link ${isPending ? "pending" : ""}`}>
            <span>Missing link</span>
            <p>
              {demoEvaluation?.missingLink ||
                (voiceStatus === "recording"
                  ? "Record your explanation, then Feynduck will look for the missing causal link."
                  : voiceStatus === "ready_to_edit"
                    ? "Review the transcript, edit it if needed, then send it to Feynduck."
                  : "Looking for the NADH, electron transport chain, and NAD+ regeneration link.")}
            </p>
          </div>
          <div className={`landing-insight-card why ${isPending ? "pending" : ""}`}>
            <span>What&apos;s unclear</span>
            <p>{demoEvaluation?.summary || "Feynduck is checking whether your explanation connects oxygen to why the Krebs cycle stops."}</p>
          </div>
          <div className={`landing-insight-card socratic ${isPending ? "pending" : ""}`}>
            <span>Socratic follow-up</span>
            <p>{demoEvaluation?.followUpQuestion || "One targeted question will appear here after analysis."}</p>
          </div>
          <div className={`landing-score-card compact ${demoEvaluation ? "is-active" : "pending"}`}>
            <span>{demoEvaluation?.scoreLabel || "Clarity"}</span>
            <strong>{demoEvaluation?.clarityScore ?? "--"}</strong>
          </div>
        </>
      );
    }

    if (activeStep === 0) {
      return (
        <>
          <div className="landing-insight-card">
            <span>Missing link</span>
            <p>Waiting for study material.</p>
          </div>
          <div className="landing-insight-card">
            <span>Why it matters</span>
            <p>Add source material so Feynduck has context.</p>
          </div>
          <div className="landing-insight-card socratic">
            <span>Socratic follow-up</span>
            <p>Feynduck will ask one targeted question after your explanation.</p>
          </div>
          <div className="landing-score-card compact">
            <span>Clarity</span>
            <strong>--</strong>
          </div>
        </>
      );
    }

    if (activeStep === 1) {
      return (
        <>
          <div className="landing-insight-card pending">
            <span>Missing link</span>
            <p>Waiting for your explanation.</p>
          </div>
          <div className="landing-insight-card pending">
            <span>Why it matters</span>
            <p>Feynduck will identify the missing reasoning step.</p>
          </div>
          <div className="landing-insight-card pending">
            <span>Socratic follow-up</span>
            <p>Appears after your explanation is analysed.</p>
          </div>
          <div className="landing-score-card compact pending">
            <span>Clarity</span>
            <strong>— —</strong>
          </div>
        </>
      );
    }

    if (activeStep === 4) {
      return (
        <>
          <div className="landing-insight-card missing-link">
            <span>Missing link</span>
            <p>You connected eosinophils to inflammation, but not yet to the mediators they release.</p>
          </div>
          <div className="landing-insight-card why">
            <span>Why it matters</span>
            <p>The mechanism explains why eosinophils actively worsen airway inflammation.</p>
          </div>
          <div className="landing-insight-card socratic">
            <span>Socratic follow-up</span>
            <p>What do activated eosinophils release that can damage airway tissue?</p>
          </div>
          <div className="landing-score-card compact is-active">
            <span>Clarity</span>
            <strong>86</strong>
          </div>
        </>
      );
    }

    if (activeStep === 5) {
      return (
        <>
          <div className="landing-insight-card missing-link">
            <span>Missing link</span>
            <p>Eosinophils release granule proteins and inflammatory mediators.</p>
          </div>
          <div className="landing-insight-card retry">
            <span>Try again</span>
            <p>Practise the link between mediator release, tissue damage, and airway reactivity.</p>
          </div>
          <div className="landing-insight-card socratic">
            <span>Socratic follow-up</span>
            <p>Why are eosinophils more than just a marker of allergy?</p>
          </div>
          <div className="landing-score-card compact">
            <span>Clarity</span>
            <strong>86</strong>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="landing-insight-card missing-link">
          <span>Missing link</span>
          <p>You said eosinophils are involved in allergy, but did not explain what they release.</p>
        </div>
        <div className="landing-insight-card why">
          <span>Why it matters</span>
          <p>The release step shows how eosinophils actively drive airway inflammation.</p>
        </div>
        <div className="landing-insight-card socratic">
          <span>Socratic follow-up</span>
          <p>What do activated eosinophils release that can damage or irritate airway tissue?</p>
        </div>
        <div className="landing-score-card compact">
          <span>Clarity</span>
          <strong>68</strong>
        </div>
      </>
    );
  };

  const renderVoiceDemoConversation = () => (
    <div className="landing-chat-panel voice-demo-chat">
      <div className="landing-chat-scroll" aria-live="polite">
        <div className="landing-message duck-message">
          <Duck />
          <p>{demoQuestion}</p>
        </div>
        {voiceStatus === "recording" ? (
          <div className="landing-context-chip is-recording">Recording... speak your explanation, then confirm.</div>
        ) : null}
        {voiceStatus === "ready_to_edit" && voiceDraft.trim() ? (
          <div className="landing-context-chip is-ready">Transcript ready. You can edit it or add another sentence.</div>
        ) : null}
        {demoTranscript ? (
          <div className="landing-message student-message is-active">
            <span>You</span>
            <p>{demoTranscript}</p>
          </div>
        ) : null}
        {voiceStatus === "transcribing" || isDemoEvaluating ? (
          <div className="landing-message duck-message">
            <Duck />
            <p>{voiceStatus === "transcribing" ? "Turning your voice into text..." : "Looking for the missing link..."}</p>
          </div>
        ) : null}
        {demoEvaluation ? (
          <div className="landing-message duck-message">
            <Duck />
            <div className="landing-message-stack">
              <p>{demoEvaluation.summary}</p>
              <div className="landing-try-card">
                <span>Try this</span>
                <p>{demoEvaluation.followUpQuestion}</p>
              </div>
            </div>
          </div>
        ) : null}
        {voiceError ? <div className="landing-context-chip is-error">{voiceError}</div> : null}
      </div>
      {renderComposer({
        placeholder: "Explain why the Krebs cycle needs oxygen...",
        micLabel: "Explain out loud",
        helper: voiceError || "Use your voice to try the Krebs cycle demo.",
      })}
    </div>
  );

  const renderQuizPanel = () => (
    <div className="landing-tool-panel">
      <div className="landing-tool-kicker">Question 1 of 3</div>
      <div className="landing-quiz-card">
        <p>What makes eosinophils active drivers of allergic airway inflammation?</p>
        <ol type="A">
          <li>They only mark that allergy is present</li>
          <li className="selected">They release mediators that irritate airway tissue</li>
          <li>They stop all immune inflammation</li>
          <li>They directly carry oxygen into the airway</li>
        </ol>
        <div className="landing-tool-nav" aria-label="Quiz question navigation">
          <button type="button" aria-label="Previous question">←</button>
          <span>1 / 3</span>
          <button type="button" aria-label="Next question">→</button>
        </div>
      </div>
    </div>
  );

  const renderFlashcardsPanel = () => (
    <div className="landing-tool-panel">
      <div className="landing-tool-kicker">Card 1 of 5</div>
      <div className="landing-flashcard">
        <span>Front</span>
        <p>What do activated eosinophils release?</p>
        <small>Flip card</small>
      </div>
      <div className="landing-flashcard answer">
        <span>Back</span>
        <p>Granule proteins and inflammatory mediators</p>
      </div>
      <div className="landing-tool-nav" aria-label="Flashcard navigation">
        <button type="button" aria-label="Previous flashcard">←</button>
        <span>1 / 5</span>
        <button type="button" aria-label="Next flashcard">→</button>
      </div>
    </div>
  );

  return (
    <div className={`landing-dashboard-preview ${compact ? "compact" : ""}`}>
      <div className="landing-dashboard-window">
        <div className="landing-dashboard-topbar">
          <div className="landing-dashboard-brand">
            <Duck />
            <strong>Feynduck</strong>
          </div>
          <div className="landing-dashboard-room breadcrumb">
            <span>{hasVoiceDemo ? "Biology" : "Asthma"}</span>
            <b>{hasVoiceDemo ? "Krebs cycle" : "Role of eosinophils"}</b>
          </div>
          <div className="landing-dashboard-status">
            {voiceStatus === "recording"
              ? "Recording"
              : voiceStatus === "transcribing"
                ? "Transcribing"
                : isDemoEvaluating
                  ? "Analysing"
                  : voiceStatus === "ready_to_edit"
                    ? "Transcript ready"
                    : demoEvaluation ? "Missing link found" : status}
          </div>
        </div>

        <div className="landing-dashboard-body">
          <aside className={panelClass("source", activeStep)}>
            <div className="landing-panel-title">Source material</div>
            {hasVoiceDemo ? (
              <div className="landing-source-card">
                <span>Source notes</span>
                <p>Oxygen is not directly consumed in the Krebs cycle.</p>
                <p>NADH delivers electrons to the electron transport chain, where oxygen acts as the final electron acceptor.</p>
                <p>Without oxygen, NADH cannot unload electrons, so NAD+ is not regenerated and the Krebs cycle cannot continue.</p>
              </div>
            ) : activeStep === 0 ? (
              <div className="landing-source-import">
                <div className="landing-source-import-copy">
                  <h3>Add source material</h3>
                  <p>Bring in what you&apos;re studying so Feynduck can ground its feedback in the right context.</p>
                </div>

                <div className="landing-drop-zone">
                  <Upload size={22} />
                  <strong>Drop files here</strong>
                  <small>PDF, PPTX, DOCX, or notes</small>
                </div>

                <div className="landing-source-actions">
                  <button type="button">
                    <Upload size={14} />
                    Upload files
                  </button>
                  <button type="button">
                    <Type size={14} />
                    Paste text
                  </button>
                  <button type="button">
                    <Link2 size={14} />
                    Add link
                  </button>
                </div>

                <p className="landing-source-helper">Add one or multiple sources to this study room.</p>
              </div>
            ) : activeStep > 0 ? (
              <div className="landing-attached-sources">
                <div className="landing-attached-source-card">
                  <span className="landing-file-icon">
                    <FileText size={18} />
                  </span>
                  <div>
                  <strong>Asthma Inflammation Lecture.pdf</strong>
                  <small>PDF · 12 pages</small>
                  </div>
                  <em>Ready</em>
                </div>
                <div className="landing-attached-source-card secondary">
                  <span className="landing-file-icon">
                    <Type size={18} />
                  </span>
                  <div>
                    <strong>Medicine Finals Notes</strong>
                    <small>Pasted text</small>
                  </div>
                </div>
                <div className="landing-source-actions">
                  <button type="button">
                    <Upload size={14} />
                    Upload files
                  </button>
                  <button type="button">
                    <Type size={14} />
                    Paste text
                  </button>
                  <button type="button">
                    <Link2 size={14} />
                    Add link
                  </button>
                </div>
                <p className="landing-source-helper">Material is loaded and ready.</p>
              </div>
            ) : (
              <div className="landing-source-card">
                <span>Source notes</span>
                <p>
                  Eosinophils are granulocytic white blood cells involved in allergic airway inflammation.
                </p>
                <p>
                  When activated, they release granule proteins and inflammatory mediators.
                </p>
                <p>
                  These substances can irritate airway tissue, increase swelling, and worsen airway reactivity.
                </p>
              </div>
            )}
          </aside>

          <section className={panelClass("conversation", activeStep)}>
            <div className="landing-panel-title">Conversation</div>
            {hasVoiceDemo ? (
              renderVoiceDemoConversation()
            ) : activeStep === 0 ? (
              <>
                <div className="landing-empty-state">
                  <FileText size={22} />
                  <h3>Add material to begin</h3>
                  <p>Once your source is ready, Feynduck will ask you to explain the concept in your own words.</p>
                </div>
                {renderComposer({
                  placeholder: "Add source material first...",
                  disabled: true,
                  helper: "Type or explain by voice after adding material.",
                })}
              </>
            ) : activeStep === 1 ? (
              <div className="landing-chat-panel goal-selection-chat">
                <div className="landing-chat-scroll">
                  <div className="landing-message duck-message">
                    <Duck />
                  <p>What are you trying to understand from this material?</p>
                  </div>
                  <div className="landing-selected-focus">
                    <div>
                      <span>Selected focus</span>
                      <strong>Role of eosinophils</strong>
                      <p>How eosinophils drive allergic airway inflammation</p>
                    </div>
                    <button type="button">Change</button>
                  </div>
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>Got it. Explain the role of eosinophils in your own words. Don&apos;t worry about getting it perfect.</p>
                  </div>
                  <div className="landing-message student-message">
                    <span>You</span>
                    <p>
                      Eosinophils are white blood cells involved in allergies and infections. They release
                      chemicals that affect inflammation and are often mentioned in asthma.
                    </p>
                  </div>
                </div>
                {renderComposer({ placeholder: "Explain what you understand..." })}
              </div>
            ) : activeStep === 3 ? (
              <div className="landing-chat-panel reexplain-chat">
                <div className="landing-chat-scroll">
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>Explain the role of eosinophils in your own words.</p>
                  </div>
                  <div className="landing-message student-message">
                    <span>You</span>
                    <p>
                      Eosinophils are immune cells involved in allergic inflammation and parasite defence.
                      In the airway, they can collect during allergic inflammation and irritate the airway.
                    </p>
                  </div>
                  <div className="landing-message duck-message">
                    <Duck />
                    <div className="landing-message-stack">
                      <p>You&apos;re close — you named the inflammation, but skipped the release mechanism.</p>
                      <div className="landing-try-card">
                        <span>Try this</span>
                        <p>What do activated eosinophils release that can damage airway tissue?</p>
                      </div>
                    </div>
                  </div>
                  <div className="landing-next-step">
                    <span />
                    <p>Use the feedback to rebuild the answer</p>
                    <span />
                  </div>
                  <div className="landing-message student-message is-active">
                    <span>You</span>
                    <p>
                      Eosinophils are granulocytic white blood cells that release toxic granule proteins
                      and inflammatory mediators. These substances can damage airway tissue, increase
                      swelling, and make the airway more reactive.
                    </p>
                  </div>
                </div>
                {renderComposer({
                  placeholder: "Re-explain Role of eosinophils...",
                  micLabel: "Re-explain by voice",
                  helper: "Use Feynduck's question to rebuild your explanation.",
                })}
              </div>
            ) : activeStep === 4 ? (
              <div className="landing-chat-panel clarity-chat">
                <div className="landing-chat-scroll">
                  <div className="landing-message student-message">
                    <span>You</span>
                    <p>
                      Eosinophils defend against parasites and drive allergic airway inflammation by
                      releasing granule proteins and inflammatory mediators that damage tissue and
                      increase airway reactivity.
                    </p>
                  </div>
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>Exactly — you connected eosinophils to the mechanism that worsens airway inflammation.</p>
                  </div>
                  <div className="landing-context-chip">Clarity improved: 60 → 85</div>
                </div>
                {renderComposer({
                  placeholder: "Start another explanation...",
                  micLabel: "Explain by voice",
                })}
              </div>
            ) : activeStep === 5 ? (
              <div className="landing-chat-panel gap-tools-chat">
                <div className="landing-chat-scroll">
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>You skipped the link between eosinophil activation and mediator release.</p>
                  </div>
                  <div className="landing-context-chip">This gap was used to build focused study tools.</div>
                </div>
                {renderComposer({
                  placeholder: "Ask Feynduck about this gap...",
                  micLabel: "Ask by voice",
                  secondary: true,
                })}
              </div>
            ) : (
              <div className="landing-chat-panel">
                <div className="landing-chat-scroll">
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>Explain the role of eosinophils in your own words.</p>
                  </div>
                  <div className={`landing-message student-message ${activeStep === 1 ? "is-active" : ""}`}>
                    <span>You</span>
                    <p>
                      Eosinophils are white blood cells that help the immune system. They are involved
                      in allergies and sometimes infections.
                    </p>
                  </div>
                  {showFeedback ? (
                    <div className="landing-message duck-message">
                      <Duck />
                      <p>
                        You&apos;re close — you named the association, but skipped the mechanism.
                        What do eosinophils release that can irritate airway tissue?
                      </p>
                    </div>
                  ) : null}
                </div>
                {renderComposer({ placeholder: "Explain what you understand..." })}
              </div>
            )}
          </section>

          <aside className={panelClass("insights", activeStep)}>
            <div className="landing-panel-title">Support</div>
            <div className="landing-study-tools">
              <div className="landing-tool-tabs" role="tablist" aria-label="Study panel tabs">
                {studyToolTabs.map((tab) => (
                  <button
                    aria-selected={activeToolTab === tab.id}
                    className={activeToolTab === tab.id ? "active" : ""}
                    key={tab.id}
                    onClick={() => setActiveToolTab(tab.id)}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeToolTab === "insights" ? <div className="landing-tool-panel">{renderInsightsPanel()}</div> : null}
              {activeToolTab === "quiz" ? renderQuizPanel() : null}
              {activeToolTab === "flashcards" ? renderFlashcardsPanel() : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
