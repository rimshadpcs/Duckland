"use client";

import { useEffect, useRef, useState } from "react";

// Recording, transcription and grading for the public Krebs cycle voice demo on the landing page.
// The demo API routes are rate-limited per IP and always grade this one question.

export type VoiceDemoStatus = "idle" | "recording" | "transcribing" | "ready_to_edit" | "error";

export type DemoEvaluation = {
  clarityScore: number;
  scoreLabel: string;
  summary: string;
  missingLink: string;
  followUpQuestion: string;
  hint: string;
};

export const demoTopic = "Krebs cycle and oxygen";
export const demoQuestion = "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.";
export const waveformBarCount = 34;

export function formatRecordingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString();
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function appendTranscript(existingText: string, transcript: string) {
  const existing = existingText.trim();
  const next = transcript.trim();
  if (!existing) return next;
  if (!next) return existing;
  return `${existing}\n\n${next}`;
}

export function useVoiceDemo({ onEvaluated }: { onEvaluated?: () => void } = {}) {
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
      onEvaluated?.();
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

  const resetDemo = () => {
    if (mediaRecorderRef.current?.state === "recording") stopRecording(false);
    setVoiceStatus("idle");
    setVoiceError(null);
    setDemoTranscript(null);
    setDemoEvaluation(null);
    setVoiceDraft("");
  };

  return {
    voiceStatus,
    voiceError,
    voiceDraft,
    setVoiceDraft,
    recordingSeconds,
    waveformBars,
    demoTranscript,
    demoEvaluation,
    isDemoEvaluating,
    startRecording,
    confirmRecording,
    cancelRecording,
    evaluateDemoAnswer,
    resetDemo,
  };
}
