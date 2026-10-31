"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Keyboard, Lightbulb, Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";
import { HandCircle } from "./HandMarks";
import { demoQuestion, formatRecordingTime, useVoiceDemo } from "./useVoiceDemo";

const MAX_ANSWER_CHARS = 4_000;

// The real public demo: speak (or type) an answer to one Krebs cycle question and get
// Feynduck's actual Clarity Score, missing step and follow-up question back.
export function TryItSection() {
  const demo = useVoiceDemo();
  const [isTyping, setIsTyping] = useState(false);
  const {
    voiceStatus,
    voiceError,
    voiceDraft,
    setVoiceDraft,
    recordingSeconds,
    waveformBars,
    demoEvaluation,
    isDemoEvaluating,
  } = demo;

  const isRecording = voiceStatus === "recording";
  const isTranscribing = voiceStatus === "transcribing";
  const hasDraft = Boolean(voiceDraft.trim());
  const showComposer = (isTyping || voiceStatus === "ready_to_edit" || hasDraft) && !demoEvaluation;
  const showStart = !isRecording && !isTranscribing && !showComposer && !demoEvaluation && !isDemoEvaluating;

  const startSpeaking = () => {
    setIsTyping(false);
    void demo.startRecording();
  };

  const checkAnswer = () => {
    trackEvent("hero_sandbox_checked", { mode: isTyping ? "typed" : "voice" });
    void demo.evaluateDemoAnswer();
  };

  const tryAgain = () => {
    setIsTyping(false);
    demo.resetDemo();
  };

  return (
    <section className="sk-try" id="try">
      <div className="lp-wrap">
        <div className="sk-try-head lp-reveal">
          <h2>Explain it out loud. The duck finds the gap.</h2>
          <p>A real question and real feedback. Talk for 20 to 40 seconds, or type if you&apos;d rather.</p>
        </div>

        <div className="sk-try-stage lp-reveal">
          <div className="sk-duck" role="img" aria-label="Feynduck, a yellow rubber duck wearing glasses" />

          <div className="lp-sandbox sk-demo">
            <div className="lp-sandbox-head">
              <div>
                <img src="/feynduckhead.png" alt="" width={22} height={22} />
                Live demo
              </div>
              <span className="fd-kicker">Biology · Krebs cycle</span>
            </div>

            <div className="lp-sandbox-body">
              <div className="fd-ask">
                <Lightbulb size={16} strokeWidth={1.8} />
                <div>
                  <span>Explain this</span>
                  <span>{demoQuestion}</span>
                </div>
              </div>

              {showStart ? (
                <div className="sk-demo-start">
                  <button className="sk-mic" type="button" onClick={startSpeaking}>
                    <Mic size={26} strokeWidth={2} />
                    <span>Explain out loud</span>
                  </button>
                  <button className="sk-type-link" type="button" onClick={() => setIsTyping(true)}>
                    <Keyboard size={16} strokeWidth={1.8} />
                    Type it instead
                  </button>
                  <span className="sk-note is-mic" aria-hidden="true">← tap and just talk</span>
                </div>
              ) : null}

              {isRecording || isTranscribing ? (
                <div className="sk-demo-live" aria-live="polite">
                  <span className={`fd-rec ${isTranscribing ? "is-muted" : ""}`}>
                    <span />
                    {isTranscribing ? "Turning your voice into text" : "Listening"} · {formatRecordingTime(recordingSeconds)}
                  </span>
                  <span className="sk-wave" aria-hidden="true">
                    {waveformBars.map((level, index) => (
                      <span key={index} style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />
                    ))}
                  </span>
                  <div className="sk-demo-actions">
                    {isTranscribing ? (
                      <Loader2 className="lp-spin" size={20} aria-label="Transcribing" />
                    ) : (
                      <>
                        <button className="sk-btn is-small" type="button" onClick={demo.confirmRecording}>
                          <Square size={14} strokeWidth={2.4} fill="currentColor" />
                          I&apos;m done
                        </button>
                        <button className="sk-type-link" type="button" onClick={demo.cancelRecording}>
                          <X size={16} strokeWidth={1.8} />
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {showComposer ? (
                <div className="fd-composer sk-demo-composer">
                  <span className="fd-composer-label">
                    {voiceStatus === "ready_to_edit" ? "What Feynduck heard (fix anything it got wrong)" : "Your explanation"}
                  </span>
                  <textarea
                    aria-label="Your explanation"
                    value={voiceDraft}
                    maxLength={MAX_ANSWER_CHARS}
                    disabled={isDemoEvaluating}
                    onChange={(event) => setVoiceDraft(event.target.value)}
                    placeholder="Oxygen matters for the Krebs cycle because…"
                    rows={4}
                  />
                  <div className="fd-composer-foot">
                    <button className="sk-type-link" type="button" onClick={startSpeaking} disabled={isDemoEvaluating}>
                      <Mic size={16} strokeWidth={1.8} />
                      {voiceStatus === "ready_to_edit" ? "Add more out loud" : "Speak instead"}
                    </button>
                    <button
                      className="sk-btn is-small"
                      type="button"
                      onClick={checkAnswer}
                      disabled={!hasDraft || isDemoEvaluating}
                    >
                      {isDemoEvaluating ? <Loader2 className="lp-spin" size={16} /> : null}
                      {isDemoEvaluating ? "Finding the gap" : "Check my explanation"}
                    </button>
                  </div>
                </div>
              ) : null}

              {voiceError ? (
                <p className="sk-demo-error" role="alert">
                  {voiceError} You can type your explanation instead.
                </p>
              ) : null}

              {demoEvaluation ? (
                <div className="lp-sandbox-result is-visible" aria-live="polite">
                  <div className="sk-score">
                    <strong>{demoEvaluation.clarityScore}</strong>
                    <span>/100 · {demoEvaluation.scoreLabel}</span>
                  </div>
                  <div className="lp-result-row is-gap">
                    <HandCircle />
                    <AlertTriangle size={16} strokeWidth={1.8} />
                    <div>
                      <strong>The step you skipped</strong>
                      <p>{demoEvaluation.missingLink}</p>
                    </div>
                    <span className="sk-note is-gap" aria-hidden="true">← your gap</span>
                  </div>
                  <div className="lp-result-row is-next">
                    <CheckCircle2 size={16} strokeWidth={1.8} />
                    <div>
                      <strong>The duck asks</strong>
                      <p>{demoEvaluation.followUpQuestion}</p>
                    </div>
                    <span className="sk-note is-next" aria-hidden="true">← answer this next</span>
                  </div>
                  <button className="sk-type-link sk-again" type="button" onClick={tryAgain}>
                    <RotateCcw size={16} strokeWidth={1.8} />
                    Try another explanation
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <p className="sk-live-note lp-reveal">
          <span className="sk-pill">Coming soon</span>
          <a href="#live">Live mode: talk it through hands-free, and the duck asks back out loud.</a>
        </p>
      </div>
    </section>
  );
}
