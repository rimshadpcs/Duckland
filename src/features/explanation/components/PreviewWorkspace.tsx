"use client";

import { useEffect, useState } from "react";
import { type WorkspaceTab, workspaceTabs } from "./LandingPageData";

export function PreviewWorkspace({
  activeTab,
  conceptCount,
  fileReady,
  flashVisible,
  gapItemsVisible,
  mapProgress,
  onTabClick,
}: {
  activeTab: WorkspaceTab;
  conceptCount: number;
  fileReady: boolean;
  flashVisible: boolean;
  gapItemsVisible: number;
  mapProgress: number;
  onTabClick: (tab: WorkspaceTab) => void;
}) {
  const [answerVisible, setAnswerVisible] = useState(false);
  const [markedDifficult, setMarkedDifficult] = useState(false);
  const concepts = ["Glycolysis", "Krebs Cycle", "Electron Transport Chain", "ATP Synthase"];
  const gaps = [
    <span key="causal"><strong>Missing causal link:</strong> NADH → ETC → NAD+ regeneration</span>,
    <span key="jargon"><strong>Jargon used as shortcut:</strong> “energy”</span>,
    <span key="analogy"><strong>Needs analogy:</strong> battery handoff / recycling carrier</span>,
    <span key="accuracy"><strong>Factual accuracy:</strong> mostly correct</span>,
    <span key="score"><strong>Clarity Score:</strong> 62</span>,
  ];

  useEffect(() => {
    if (activeTab === "cards") {
      setAnswerVisible(false);
      setMarkedDifficult(false);
    }
  }, [activeTab]);

  return (
    <>
      <div className="workspace-tabbar" role="tablist" aria-label="Study workspace">
        {workspaceTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="workspace-content">
        {activeTab === "notes" ? (
          <>
            <div className="upload-card">
              <strong>Add material</strong>
              {fileReady ? <span className="pop-chip">Cellular Respiration.pdf</span> : <em>Drop PDF here</em>}
              <small>Attach to: Biology Midterm</small>
            </div>
            <div className="workspace-card">
              <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
              <h4>Detected topics</h4>
              <div className="concept-pills">
                {concepts.slice(0, conceptCount).map((concept) => (
                  <span className="pop-chip" key={concept}>{concept}</span>
                ))}
              </div>
              <button type="button">Start explaining →</button>
            </div>
          </>
        ) : null}

        {activeTab === "gaps" ? (
          <div className="workspace-card">
            <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
            <h4>Gap Analysis</h4>
            <ul className="gap-list">
              {gaps.slice(0, gapItemsVisible).map((gap, index) => (
                <li className="fade-item" key={index}>{gap}</li>
              ))}
            </ul>
            <button type="button">Fix this gap →</button>
          </div>
        ) : null}

        {activeTab === "cards" ? (
          <div className="workspace-card flashcard-card">
            <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
            <h4>Flashcards</h4>
            <p>24 cards from weak spots</p>
            <div className={`flashcard revealed ${flashVisible ? "slide-in" : "pre-slide"}`}>
              <strong>What happens to NADH when oxygen is unavailable?</strong>
              <em className={answerVisible ? "" : "hidden-answer"}>
                {answerVisible ? "NADH cannot unload electrons, so NAD+ is not regenerated." : "Answer hidden"}
              </em>
            </div>
            <div className="card-actions">
              <button onClick={() => setAnswerVisible((value) => !value)} type="button">
                {answerVisible ? "Hide answer" : "Show answer"}
              </button>
              <button
                className={markedDifficult ? "selected" : ""}
                onClick={() => setMarkedDifficult((value) => !value)}
                type="button"
              >
                {markedDifficult ? "Marked difficult" : "Mark difficult"}
              </button>
              <button type="button">Review cards</button>
            </div>
          </div>
        ) : null}

        {activeTab === "map" ? (
          <div className="workspace-card">
            <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
            <h4>Clarity Map</h4>
            <div className="clarity-map" aria-label="Concept clarity map">
              <span className={mapProgress >= 1 ? "ready" : ""}>Glycolysis <b>●</b></span>
              <i />
              <span className={mapProgress >= 2 ? "ready" : ""}>Krebs Cycle <b>◐</b></span>
              <i className="weak" />
              <span className={mapProgress >= 3 ? "ready" : ""}>Electron Transport Chain <b>○</b></span>
              <i className="weak" />
              <span className={mapProgress >= 4 ? "ready" : ""}>Synthesis <b>○</b></span>
            </div>
            <div className="legend">
              <span>● Clear</span>
              <span>◐ Improving</span>
              <span>○ Gap detected</span>
              <span>Dashed = weak link</span>
            </div>
            <div className="mini-score">Clarity Score: <strong>86</strong></div>
            <button type="button">Review weak links →</button>
          </div>
        ) : null}
      </div>
    </>
  );
}
