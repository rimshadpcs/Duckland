"use client";

import { useEffect, useState } from "react";
import { FileText, Link2, Mic, Type, Upload } from "lucide-react";
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

const studyToolTabs: { id: StudyToolTab; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "quiz", label: "Quiz" },
  { id: "flashcards", label: "Flashcards" },
];

export function DashboardPreview({ activeStep = 0, compact = false }: DashboardPreviewProps) {
  const [activeToolTab, setActiveToolTab] = useState<StudyToolTab>(activeStep === 5 ? "quiz" : "insights");
  const status = statusLabels[activeStep] ?? statusLabels[0];
  const showFeedback = activeStep >= 2;

  useEffect(() => {
    setActiveToolTab(activeStep === 5 ? "quiz" : "insights");
  }, [activeStep]);

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
  }) => (
    <div
      className={[
        "landing-composer",
        "is-multiline",
        disabled ? "is-disabled" : "is-active voice-enabled",
        secondary ? "is-secondary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button className="landing-mic-button" type="button" aria-label={micLabel} disabled={disabled}>
        <Mic size={16} />
      </button>
      <div className="landing-composer-copy">
        <textarea aria-label={placeholder} disabled={disabled} placeholder={placeholder} rows={2} />
        {helper ? <small>{helper}</small> : null}
      </div>
      <button type="button" aria-label="Send explanation" disabled={disabled}>
        ↑
      </button>
    </div>
  );

  const renderInsightsPanel = () => {
    if (activeStep === 0) {
      return (
        <>
          <div className="landing-insight-card">
            <span>Main gap</span>
            <p>Waiting for study material.</p>
          </div>
          <div className="landing-insight-card">
            <span>What to fix</span>
            <p>Add source material so Feynduck has context.</p>
          </div>
          <div className="landing-insight-card amber">
            <span>Socratic question</span>
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
            <span>Main gap</span>
            <p>Waiting for your explanation.</p>
          </div>
          <div className="landing-insight-card pending">
            <span>What to fix</span>
            <p>Feynduck will identify the missing reasoning step.</p>
          </div>
          <div className="landing-insight-card pending">
            <span>Socratic question</span>
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
          <div className="landing-insight-card">
            <span>Main gap</span>
            <p>The formula link is now clearer.</p>
          </div>
          <div className="landing-insight-card">
            <span>What to fix</span>
            <p>Frank-Starling law still needs another explanation loop.</p>
          </div>
          <div className="landing-insight-card amber">
            <span>Socratic question</span>
            <p>How does preload affect stroke volume?</p>
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
          <div className="landing-insight-card main-gap">
            <span>Main gap</span>
            <p>Cardiac output = heart rate × stroke volume</p>
          </div>
          <div className="landing-insight-card">
            <span>What to fix</span>
            <p>Practise explaining how the formula changes when stroke volume falls.</p>
          </div>
          <div className="landing-insight-card amber">
            <span>Socratic question</span>
            <p>If heart rate cannot rise, what happens to cardiac output?</p>
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
        <div className="landing-insight-card main-gap">
          <span>Main gap</span>
          <p>You did not connect cardiac output to the formula: heart rate × stroke volume.</p>
        </div>
        <div className="landing-insight-card">
          <span>What to fix</span>
          <p>Explain how increasing heart rate can compensate when stroke volume falls.</p>
        </div>
        <div className="landing-insight-card amber">
          <span>Socratic question</span>
          <p>If stroke volume decreases, what must happen to heart rate to keep cardiac output stable?</p>
        </div>
        <div className="landing-score-card compact">
          <span>Clarity</span>
          <strong>68</strong>
        </div>
      </>
    );
  };

  const renderQuizPanel = () => (
    <div className="landing-tool-panel">
      <div className="landing-tool-kicker">Question 1 of 3</div>
      <div className="landing-quiz-card">
        <p>If stroke volume decreases while heart rate stays unchanged, what happens to cardiac output?</p>
        <ol type="A">
          <li>It increases</li>
          <li className="selected">It decreases</li>
          <li>It stays unchanged</li>
          <li>It becomes unrelated to heart rate</li>
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
        <p>What determines cardiac output?</p>
        <small>Flip card</small>
      </div>
      <div className="landing-flashcard answer">
        <span>Back</span>
        <p>Heart rate × stroke volume</p>
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
          <div className="landing-dashboard-room">
            <span>Medicine Finals</span>
            <b>Cardiac output</b>
          </div>
          <div className="landing-dashboard-status">{status}</div>
        </div>

        <div className="landing-dashboard-body">
          <aside className={panelClass("source", activeStep)}>
            <div className="landing-panel-title">Source material</div>
            {activeStep === 0 ? (
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
                    <strong>Cardiac Output Lecture.pdf</strong>
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
                  Cardiac output is the amount of blood the heart pumps per minute.
                </p>
                <p>
                  It equals heart rate multiplied by stroke volume.
                </p>
                <p>
                  If stroke volume falls, the body may compensate by increasing heart rate to
                  maintain cardiac output.
                </p>
              </div>
            )}
          </aside>

          <section className={panelClass("conversation", activeStep)}>
            <div className="landing-panel-title">Conversation</div>
            {activeStep === 0 ? (
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
                      <strong>Cardiac output</strong>
                      <p>How heart rate compensates when stroke volume decreases</p>
                    </div>
                    <button type="button">Change</button>
                  </div>
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>Got it. Explain cardiac output in your own words. Don&apos;t worry about getting it perfect.</p>
                  </div>
                  <div className="landing-message student-message">
                    <span>You</span>
                    <p>
                      Cardiac output is the amount of blood the heart pumps each minute. It depends on heart
                      rate and stroke volume. If stroke volume falls, the heart may beat faster to help
                      maintain the same output.
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
                    <p>Explain cardiac output in your own words.</p>
                  </div>
                  <div className="landing-message student-message">
                    <span>You</span>
                    <p>
                      Cardiac output is how much blood the heart pumps. If stroke volume goes down,
                      the heart beats faster to make up for it.
                    </p>
                  </div>
                  <div className="landing-message duck-message">
                    <Duck />
                    <div className="landing-message-stack">
                      <p>You&apos;re close — you named the compensation, but skipped the mechanism.</p>
                      <div className="landing-try-card">
                        <span>Try this</span>
                        <p>If stroke volume decreases, what must happen to heart rate to keep cardiac output stable?</p>
                      </div>
                    </div>
                  </div>
                  <div className="landing-message student-message is-active">
                    <span>You</span>
                    <p>
                      Cardiac output depends on both stroke volume and heart rate. If stroke volume falls,
                      the heart must increase its rate so that it can still pump roughly the same total amount
                      of blood each minute.
                    </p>
                  </div>
                </div>
                {renderComposer({
                  placeholder: "Re-explain the concept in your own words...",
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
                      Cardiac output equals heart rate multiplied by stroke volume. If stroke volume falls,
                      increasing heart rate can help maintain cardiac output.
                    </p>
                  </div>
                  <div className="landing-message duck-message">
                    <Duck />
                    <p>Exactly — you connected the compensation to the formula clearly.</p>
                  </div>
                  <div className="landing-context-chip">Clarity improved: 68 → 86</div>
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
                    <p>You skipped the link between cardiac output, heart rate, and stroke volume.</p>
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
                    <p>Explain cardiac output in your own words.</p>
                  </div>
                  <div className={`landing-message student-message ${activeStep === 1 ? "is-active" : ""}`}>
                    <span>You</span>
                    <p>
                      Cardiac output is how much blood the heart pumps. If stroke volume goes down,
                      the heart beats faster to make up for it.
                    </p>
                  </div>
                  {showFeedback ? (
                    <div className="landing-message duck-message">
                      <Duck />
                      <p>
                        You&apos;re close — you named the compensation, but skipped the mechanism.
                        How does increasing heart rate help maintain cardiac output when stroke volume falls?
                      </p>
                    </div>
                  ) : null}
                </div>
                {renderComposer({ placeholder: "Explain what you understand..." })}
              </div>
            )}
          </section>

          <aside className={panelClass("insights", activeStep)}>
            <div className="landing-panel-title">Study panel</div>
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
