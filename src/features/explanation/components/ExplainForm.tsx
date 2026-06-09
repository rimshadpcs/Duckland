"use client";

import { useState } from "react";
import { Button, Textarea } from "@/components/ui";
import { GapResultPanel } from "@/features/gap-analysis";
import type { ExplanationRequest, ExplanationResult } from "../types";

const initialRequest: ExplanationRequest = {
  notes:
    "Oxygen is important in cellular respiration. NADH carries electrons to the electron transport chain, and ATP is produced.",
  explanation:
    "The Krebs cycle needs oxygen because oxygen helps respiration keep going and lets cells make ATP.",
};

export function ExplainForm() {
  const [request, setRequest] = useState<ExplanationRequest>(initialRequest);
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof ExplanationRequest, value: string) => {
    setRequest((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const payload = (await response.json()) as ExplanationResult | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Could not analyse this explanation.");
      }

      setResult(payload as ExplanationResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not analyse this explanation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="study-demo-layout">
      <section className="study-form-panel">
        <label>
          <span>Paste your notes</span>
          <Textarea
            value={request.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={8}
          />
        </label>

        <label>
          <span>Explain the concept in your own words</span>
          <Textarea
            value={request.explanation}
            onChange={(event) => updateField("explanation", event.target.value)}
            rows={8}
          />
        </label>

        <Button onClick={handleSubmit} type="button" disabled={isLoading}>
          {isLoading ? "Finding your gap..." : "Find my gap"}
        </Button>

        {error ? <p className="study-error">{error}</p> : null}
      </section>

      <GapResultPanel result={result} isLoading={isLoading} />
    </div>
  );
}
