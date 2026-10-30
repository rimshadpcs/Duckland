"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lightbulb,
  Link2,
  Loader2,
  Mic,
  Type,
  Upload,
  X,
} from "lucide-react";
import { Duck } from "./Duck";

type DashboardPreviewProps = {
  activeStep?: number;
  compact?: boolean;
};

const statusLabels = [
  "Add your material",
  "Ready to explain",
  "Skipped step found",
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
    "lp-app-panel",
    `is-${panel}`,
    isActive ? "is-active" : "",
    shouldMute ? "is-muted" : "",
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
  }: {
    placeholder: string;
    micLabel?: string;
    disabled?: boolean;
    helper?: string;
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
          "fd-composer",
          disabled ? "is-disabled" : "",
          isVoiceActive && !disabled ? "is-recording" : "",
          isReadyToEdit && !disabled ? "is-ready" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
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
        <div className="fd-composer-foot">
          {isVoiceActive ? (
            <div aria-live="polite">
              <span className={`fd-rec ${voiceStatus === "transcribing" ? "is-muted" : ""}`}>
                <span />
                {voiceStatusLabel} · {formatRecordingTime(recordingSeconds)}
              </span>
              <span className="lp-wave" aria-hidden="true">
                {waveformBars.slice(0, 14).map((level, index) => (
                  <span key={index} style={{ transform: `scaleY(${0.2 + level * 0.8})` }} />
                ))}
              </span>
            </div>
          ) : (
            <span className="fd-hint-text">{helperText}</span>
          )}
          <div>
            {isVoiceActive ? (
              <>
                <button
                  className="fd-icon-btn fd-icon-btn-sm"
                  type="button"
                  aria-label="Cancel voice explanation"
                  disabled={isBusy}
                  onClick={cancelRecording}
                >
                  <X size={14} />
                </button>
                <button
                  className="fd-btn fd-btn-dark fd-btn-sm"
                  type="button"
                  aria-label="Use this voice explanation"
                  disabled={!isRecording || isBusy}
                  onClick={confirmRecording}
                >
                  {isBusy ? <Loader2 className="lp-spin" size={14} /> : <Check size={14} />}
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  className="fd-icon-btn fd-icon-btn-sm"
                  type="button"
                  aria-label={micLabel}
                  disabled={disabled || isBusy}
                  onClick={startRecording}
                >
                  {isBusy ? <Loader2 className="lp-spin" size={14} /> : <Mic size={14} />}
                </button>
                <button
                  className="fd-btn fd-btn-accent fd-btn-sm"
                  type="button"
                  aria-label="Send explanation"
                  disabled={disabled || isDemoEvaluating || !voiceDraft.trim()}
                  onClick={evaluateDemoAnswer}
                >
                  {isDemoEvaluating ? <Loader2 className="lp-spin" size={14} /> : isReadyToEdit ? "Check" : <ArrowUp size={14} />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderClarity = (score: number | null, label = "Clarity") => (
    <div className="lp-clarity">
      <span>{label}</span>
      <div className="fd-score">
        <div className={`fd-bar is-thin ${score !== null && score >= 80 ? "is-success" : "is-amber"}`}>
          <span style={{ width: `${score ?? 0}%` }} />
        </div>
        <span className="fd-score-num">{score ?? "--"}</span>
      </div>
    </div>
  );

  const renderInsight = (label: string, text: string, tone: "" | "is-gap" | "is-question" = "", pending = false) => (
    <div className={["lp-insight", tone, pending ? "is-pending" : ""].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );

  const renderInsightsPanel = () => {
    if (hasVoiceDemo) {
      const isPending = voiceStatus === "recording" || voiceStatus === "transcribing" || isDemoEvaluating;

      return (
        <>
          {renderInsight(
            "Skipped step",
            demoEvaluation?.missingLink ||
              (voiceStatus === "recording"
                ? "Record your explanation, then Feynduck will look for the step you skipped."
                : voiceStatus === "ready_to_edit"
                  ? "Review the transcript, edit it if needed, then send it to Feynduck."
                  : "Looking for how NADH, the electron transport chain, and NAD+ regeneration connect."),
            "is-gap",
            isPending,
          )}
          {renderInsight(
            "What's unclear",
            demoEvaluation?.summary || "Feynduck is checking whether your explanation connects oxygen to why the Krebs cycle stops.",
            "",
            isPending,
          )}
          {renderInsight(
            "Follow-up question",
            demoEvaluation?.followUpQuestion || "One targeted question will appear here after analysis.",
            "is-question",
            isPending,
          )}
          {renderClarity(demoEvaluation?.clarityScore ?? null, demoEvaluation?.scoreLabel || "Clarity")}
        </>
      );
    }

    if (activeStep === 0) {
      return (
        <>
          {renderInsight("Skipped step", "Waiting for study material.")}
          {renderInsight("Why it matters", "Add your materials so Feynduck has context.")}
          {renderInsight("Follow-up question", "Feynduck will ask one targeted question after your explanation.", "is-question")}
          {renderClarity(null)}
        </>
      );
    }

    if (activeStep === 1) {
      return (
        <>
          {renderInsight("Skipped step", "Waiting for your explanation.", "", true)}
          {renderInsight("Why it matters", "Feynduck will identify the step you skipped.", "", true)}
          {renderInsight("Follow-up question", "Appears after your explanation is analysed.", "", true)}
          {renderClarity(null)}
        </>
      );
    }

    if (activeStep === 4) {
      return (
        <>
          {renderInsight("Skipped step", "You connected eosinophils to inflammation, but not yet to the mediators they release.", "is-gap")}
          {renderInsight("Why it matters", "This explains how eosinophils actively worsen airway inflammation.")}
          {renderInsight("Follow-up question", "What do activated eosinophils release that can damage airway tissue?", "is-question")}
          {renderClarity(86)}
        </>
      );
    }

    if (activeStep === 5) {
      return (
        <>
          {renderInsight("Skipped step", "Eosinophils release granule proteins and inflammatory mediators.", "is-gap")}
          {renderInsight("Try again", "Practise the link between mediator release, tissue damage, and airway reactivity.")}
          {renderInsight("Follow-up question", "Why are eosinophils more than just a marker of allergy?", "is-question")}
          {renderClarity(86)}
        </>
      );
    }

    return (
      <>
        {renderInsight("Skipped step", "You said eosinophils are involved in allergy, but did not explain what they release.", "is-gap")}
        {renderInsight("Why it matters", "The release step shows how eosinophils actively drive airway inflammation.")}
        {renderInsight("Follow-up question", "What do activated eosinophils release that can damage or irritate airway tissue?", "is-question")}
        {renderClarity(68)}
      </>
    );
  };

  const duckMessage = (content: ReactNode) => (
    <div className="lp-msg is-duck">
      <Duck />
      {typeof content === "string" ? <p>{content}</p> : content}
    </div>
  );

  const studentMessage = (text: string, active = false) => (
    <div className={`lp-msg is-student ${active ? "is-active" : ""}`}>
      <span>You</span>
      <p>{text}</p>
    </div>
  );

  const tryThis = (question: string) => (
    <div className="fd-ask">
      <Lightbulb size={15} strokeWidth={1.8} />
      <div>
        <span>Try this</span>
        <span>{question}</span>
      </div>
    </div>
  );

  const renderVoiceDemoConversation = () => (
    <div className="lp-chat">
      <div className="lp-chat-scroll" aria-live="polite">
        {duckMessage(demoQuestion)}
        {voiceStatus === "recording" ? (
          <span className="fd-pill is-danger">Recording... speak your explanation, then confirm.</span>
        ) : null}
        {voiceStatus === "ready_to_edit" && voiceDraft.trim() ? (
          <span className="fd-pill is-amber">Transcript ready. You can edit it or add another sentence.</span>
        ) : null}
        {demoTranscript ? studentMessage(demoTranscript, true) : null}
        {voiceStatus === "transcribing" || isDemoEvaluating
          ? duckMessage(voiceStatus === "transcribing" ? "Turning your voice into text..." : "Looking for the step you skipped...")
          : null}
        {demoEvaluation
          ? duckMessage(
              <div className="lp-msg-stack">
                <p>{demoEvaluation.summary}</p>
                {tryThis(demoEvaluation.followUpQuestion)}
              </div>,
            )
          : null}
        {voiceError ? <span className="fd-pill is-danger">{voiceError}</span> : null}
      </div>
      {renderComposer({
        placeholder: "Explain why the Krebs cycle needs oxygen...",
        micLabel: "Explain out loud",
        helper: voiceError || "Use your voice to try the Krebs cycle demo.",
      })}
    </div>
  );

  const renderConversation = () => {
    if (hasVoiceDemo) return renderVoiceDemoConversation();

    if (activeStep === 0) {
      return (
        <div className="lp-chat">
          <div className="lp-empty">
            <span className="fd-empty-tile">
              <FileText size={20} strokeWidth={1.8} />
            </span>
            <h3>Add material to begin</h3>
            <p>Once your source is ready, Feynduck will ask you to explain the concept in your own words.</p>
          </div>
          {renderComposer({
            placeholder: "Add your materials first...",
            disabled: true,
            helper: "Type or explain by voice after adding material.",
          })}
        </div>
      );
    }

    if (activeStep === 1) {
      return (
        <div className="lp-chat">
          <div className="lp-chat-scroll">
            {duckMessage("What are you trying to understand from this material?")}
            <div className="lp-focus">
              <div>
                <span>Selected focus</span>
                <strong>Role of eosinophils</strong>
                <p>How eosinophils drive allergic airway inflammation</p>
              </div>
              <button className="fd-btn fd-btn-secondary fd-btn-sm" type="button">Change</button>
            </div>
            {duckMessage("Got it. Explain the role of eosinophils in your own words. Don't worry about getting it perfect.")}
            {studentMessage(
              "Eosinophils are white blood cells involved in allergies and infections. They release chemicals that affect inflammation and are often mentioned in asthma.",
            )}
          </div>
          {renderComposer({ placeholder: "Explain what you understand..." })}
        </div>
      );
    }

    if (activeStep === 3) {
      return (
        <div className="lp-chat">
          <div className="lp-chat-scroll">
            {duckMessage("Explain the role of eosinophils in your own words.")}
            {studentMessage(
              "Eosinophils are immune cells involved in allergic inflammation and parasite defence. In the airway, they can collect during allergic inflammation and irritate the airway.",
            )}
            {duckMessage(
              <div className="lp-msg-stack">
                <p>You&apos;re close — you named the inflammation, but skipped what eosinophils release.</p>
                {tryThis("What do activated eosinophils release that can damage airway tissue?")}
              </div>,
            )}
            <div className="lp-divider">Use the feedback to rebuild the answer</div>
            {studentMessage(
              "Eosinophils are granulocytic white blood cells that release toxic granule proteins and inflammatory mediators. These substances can damage airway tissue, increase swelling, and make the airway more reactive.",
              true,
            )}
          </div>
          {renderComposer({
            placeholder: "Re-explain Role of eosinophils...",
            micLabel: "Re-explain by voice",
            helper: "Use Feynduck's question to rebuild your explanation.",
          })}
        </div>
      );
    }

    if (activeStep === 4) {
      return (
        <div className="lp-chat">
          <div className="lp-chat-scroll">
            {studentMessage(
              "Eosinophils defend against parasites and drive allergic airway inflammation by releasing granule proteins and inflammatory mediators that damage tissue and increase airway reactivity.",
            )}
            {duckMessage("Exactly — you connected eosinophils to how they worsen airway inflammation.")}
            <span className="fd-pill is-success">Clarity improved: 60 → 85</span>
          </div>
          {renderComposer({ placeholder: "Start another explanation...", micLabel: "Explain by voice" })}
        </div>
      );
    }

    if (activeStep === 5) {
      return (
        <div className="lp-chat">
          <div className="lp-chat-scroll">
            {duckMessage("You skipped the link between eosinophil activation and mediator release.")}
            <span className="fd-pill">This gap was used to build focused study tools.</span>
          </div>
          {renderComposer({ placeholder: "Ask Feynduck about this gap...", micLabel: "Ask by voice" })}
        </div>
      );
    }

    return (
      <div className="lp-chat">
        <div className="lp-chat-scroll">
          {duckMessage("Explain the role of eosinophils in your own words.")}
          {studentMessage(
            "Eosinophils are white blood cells that help the immune system. They are involved in allergies and sometimes infections.",
          )}
          {showFeedback
            ? duckMessage(
                "You're close — you named the association, but skipped what eosinophils release. What do eosinophils release that can irritate airway tissue?",
              )
            : null}
        </div>
        {renderComposer({ placeholder: "Explain what you understand..." })}
      </div>
    );
  };

  const sourceActions = (
    <div className="lp-app-actions">
      <button className="fd-btn fd-btn-secondary fd-btn-sm" type="button">
        <Upload size={13} />
        Upload files
      </button>
      <button className="fd-btn fd-btn-secondary fd-btn-sm" type="button">
        <Type size={13} />
        Paste text
      </button>
      <button className="fd-btn fd-btn-secondary fd-btn-sm" type="button">
        <Link2 size={13} />
        Add link
      </button>
    </div>
  );

  const renderSources = () => {
    if (hasVoiceDemo) {
      return (
        <div className="lp-notes">
          <span className="fd-eyebrow">Source notes</span>
          <p>Oxygen is not directly consumed in the Krebs cycle.</p>
          <p>NADH delivers electrons to the electron transport chain, where oxygen acts as the final electron acceptor.</p>
          <p>Without oxygen, NADH cannot unload electrons, so NAD+ is not regenerated and the Krebs cycle cannot continue.</p>
        </div>
      );
    }

    if (activeStep === 0) {
      return (
        <>
          <div className="lp-app-intro">
            <h3>Add your materials</h3>
            <p>Bring in what you&apos;re studying so Feynduck can base its feedback on the right context.</p>
          </div>
          <div className="lp-drop">
            <Upload size={20} strokeWidth={1.8} />
            <strong>Drop files here</strong>
            <small>PDF, PPTX, DOCX, or notes</small>
          </div>
          {sourceActions}
          <p className="lp-app-helper">Add one or multiple sources to this study room.</p>
        </>
      );
    }

    return (
      <>
        <div className="lp-file">
          <span className="fd-file-badge is-sm">PDF</span>
          <div>
            <strong>Asthma Inflammation Lecture.pdf</strong>
            <small>12 pages · Ready</small>
          </div>
        </div>
        <div className="lp-file">
          <span className="fd-file-badge is-sm">TXT</span>
          <div>
            <strong>Medicine Finals Notes</strong>
            <small>Pasted text</small>
          </div>
        </div>
        {sourceActions}
        <p className="lp-app-helper">Material is loaded and ready.</p>
      </>
    );
  };

  const renderQuizPanel = () => (
    <>
      <span className="lp-tool-kicker">Question 1 of 3</span>
      <div className="lp-quiz">
        <p>What makes eosinophils active drivers of allergic airway inflammation?</p>
        <ol>
          <li>They only mark that allergy is present</li>
          <li className="is-selected">They release mediators that irritate airway tissue</li>
          <li>They stop all immune inflammation</li>
          <li>They directly carry oxygen into the airway</li>
        </ol>
      </div>
      <div className="lp-tool-nav" aria-label="Quiz question navigation">
        <button className="fd-icon-btn fd-icon-btn-sm is-plain" type="button" aria-label="Previous question">
          <ChevronLeft size={14} />
        </button>
        <span>1 / 3</span>
        <button className="fd-icon-btn fd-icon-btn-sm is-plain" type="button" aria-label="Next question">
          <ChevronRight size={14} />
        </button>
      </div>
    </>
  );

  const renderFlashcardsPanel = () => (
    <>
      <span className="lp-tool-kicker">Card 1 of 5</span>
      <div className="lp-card-face">
        <span>Front</span>
        <p>What do activated eosinophils release?</p>
      </div>
      <div className="lp-card-face is-back">
        <span>Back</span>
        <p>Granule proteins and inflammatory mediators</p>
      </div>
      <div className="lp-tool-nav" aria-label="Flashcard navigation">
        <button className="fd-icon-btn fd-icon-btn-sm is-plain" type="button" aria-label="Previous flashcard">
          <ChevronLeft size={14} />
        </button>
        <span>1 / 5</span>
        <button className="fd-icon-btn fd-icon-btn-sm is-plain" type="button" aria-label="Next flashcard">
          <ChevronRight size={14} />
        </button>
      </div>
    </>
  );

  const headerStatus =
    voiceStatus === "recording"
      ? "Recording"
      : voiceStatus === "transcribing"
        ? "Transcribing"
        : isDemoEvaluating
          ? "Analysing"
          : voiceStatus === "ready_to_edit"
            ? "Transcript ready"
            : demoEvaluation
              ? "Skipped step found"
              : status;
  const statusTone =
    voiceStatus === "recording"
      ? "is-danger"
      : headerStatus === "Skipped step found" || headerStatus === "Re-explain the gap"
        ? "is-amber"
        : headerStatus === "Clarity tracked" || headerStatus === "Built from your gap"
          ? "is-success"
          : "";

  return (
    <div className={`lp-app ${compact ? "is-compact" : ""} ${hasVoiceDemo ? "has-voice" : ""}`}>
      <div className="lp-app-header">
        <div>
          <img src="/feynduckhead.png" alt="" width={22} height={22} />
          <nav className="fd-crumbs" aria-label="Mock breadcrumb">
            <span>{hasVoiceDemo ? "Biology" : "Asthma"}</span>
            <span aria-hidden="true">/</span>
            <b>{hasVoiceDemo ? "Krebs cycle" : "Role of eosinophils"}</b>
          </nav>
        </div>
        <span className={`fd-pill ${statusTone}`}>{headerStatus}</span>
      </div>

      <div className="lp-app-body">
        <aside className={panelClass("source", activeStep)}>
          <div className="lp-app-panel-head">Your materials</div>
          <div className="lp-app-panel-body">{renderSources()}</div>
        </aside>

        <section className={panelClass("conversation", activeStep)}>
          <div className="lp-app-panel-head">Conversation</div>
          {renderConversation()}
        </section>

        <aside className={panelClass("insights", activeStep)}>
          <div className="lp-app-panel-head">Support</div>
          <div className="fd-segmented is-compact" role="tablist" aria-label="Study panel tabs">
            {studyToolTabs.map((tab) => (
              <button
                aria-selected={activeToolTab === tab.id}
                key={tab.id}
                onClick={() => setActiveToolTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="lp-app-panel-body">
            {activeToolTab === "insights" ? renderInsightsPanel() : null}
            {activeToolTab === "quiz" ? renderQuizPanel() : null}
            {activeToolTab === "flashcards" ? renderFlashcardsPanel() : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
