"use client";

import { Badge } from "@src/components/ui";
import { Lightbulb, AlertCircle } from "lucide-react";
import type { GapAnalysisResult } from "../types";

type GapResultPanelProps = {
  result: GapAnalysisResult | null;
  isLoading?: boolean;
  width?: number;
  isDragging?: boolean;
  hasNotes?: boolean;
  hasSelectedConcept?: boolean;
};

export function GapResultPanel({ result, isLoading = false, width, isDragging = false, hasNotes = true, hasSelectedConcept = true }: GapResultPanelProps) {
  const panelStyle = {
    width: width ? `${width}px` : undefined,
    transition: isDragging ? "none" : undefined,
  };

  if (!result && !isLoading) {
    return (
      <aside className="dashboard-panel right-panel" style={panelStyle}>
        <div className="panel-header">
          <h3 style={{ fontFamily: 'inherit', fontWeight: 700 }}>Session insights</h3>
        </div>
        <div className="panel-content">
          <div className="empty-insights">
            <Lightbulb size={48} strokeWidth={1.5} />
            {!hasNotes ? (
              <>
                <h4>Waiting for study material</h4>
                <p>Add notes on the left, then explain the concept to get feedback.</p>
              </>
            ) : !hasSelectedConcept ? (
              <>
                <h4>Choose a concept to begin</h4>
                <p>Pick the concept Feynduck should evaluate before you explain.</p>
              </>
            ) : (
              <>
                <h4>Waiting for your explanation</h4>
                <p>Send your explanation to generate a clarity score, main gap, and Socratic question.</p>
              </>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="dashboard-panel right-panel" style={panelStyle}>
      <div className="panel-header">
        <h3 style={{ fontFamily: 'inherit', fontWeight: 700 }}>Session insights</h3>
      </div>
      <div className="panel-content">
        <div className="insights-card">
          <div className="score-section">
            <span className="score-label">Clarity Score</span>
            <span className="score-value">{result?.status === "topic_mismatch" ? "—" : (result ? result.clarityScore : "--")}</span>
          </div>

          <div className={`insight-card strong ${isLoading ? "loading-pulse" : ""}`} style={{ borderColor: result?.status === "topic_mismatch" ? '#eab308' : undefined }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: result?.status === "topic_mismatch" ? '#eab308' : 'var(--amber-dark)', margin: '0 0 8px' }}>
              {result?.status === "topic_mismatch" ? "Topic mismatch" : "Main Gap"}
            </h4>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>
              {isLoading ? "Analyzing reasoning..." : result?.gapSummary}
            </p>
          </div>

          <div className={`insight-card highlight ${isLoading ? "loading-pulse" : ""}`}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#8a5a0a', margin: '0 0 8px' }}>
              <AlertCircle size={14} /> Socratic Question
            </h4>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#6f4a05', lineHeight: 1.5 }}>
              {isLoading ? "..." : result?.socraticQuestion}
            </p>
          </div>

          {result?.status !== "topic_mismatch" && (
            <div className={`insight-card ${isLoading ? "loading-pulse" : ""}`}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 8px' }}>
                Why it matters
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.5 }}>
                {isLoading ? "..." : result?.whyItMatters}
              </p>
            </div>
          )}

          <div className={`insight-card ${isLoading ? "loading-pulse" : ""}`}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 8px' }}>
              Try again
            </h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.5 }}>
              {isLoading ? "..." : result?.suggestedReExplanationPrompt}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
