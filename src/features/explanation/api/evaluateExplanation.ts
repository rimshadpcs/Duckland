import type { ExplanationRequest, ExplanationResult } from "../types";
import { createMockExplanationResult } from "./mockResult";
import { getOpenAIClient, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";
import { gapEvaluationPrompt } from "../prompts/gapEvaluationPrompt";

export type EvaluationErrorCode =
  | "openai_not_configured"
  | "openai_invalid_key"
  | "openai_billing"
  | "openai_service_error"
  | "openai_invalid_response";

export class EvaluationError extends Error {
  code: EvaluationErrorCode;
  status: number;

  constructor(code: EvaluationErrorCode, message: string, status: number) {
    super(message);
    this.name = "EvaluationError";
    this.code = code;
    this.status = status;
  }
}

export type EvaluationResult = {
  result: ExplanationResult;
  mockMode: boolean;
  warning?: string;
};

function getOpenAIErrorDetails(error: unknown) {
  const candidate = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
  };

  return {
    status: candidate.status,
    code: candidate.code,
    type: candidate.type,
    message: candidate.message,
  };
}

function mapOpenAIError(error: unknown): EvaluationError {
  const details = getOpenAIErrorDetails(error);

  if (isLocalDevelopment()) {
    console.error("[OpenAI] evaluation failed", {
      status: details.status,
      code: details.code,
      type: details.type,
      message: details.message,
    });
  }

  if (details.status === 401) {
    return new EvaluationError(
      "openai_invalid_key",
      "OpenAI rejected the API key. Check OPENAI_API_KEY.",
      401,
    );
  }

  if (details.code === "insufficient_quota" || details.status === 402) {
    return new EvaluationError(
      "openai_billing",
      "OpenAI billing or credits are not available for this key.",
      402,
    );
  }

  if (details.status === 429) {
    return new EvaluationError(
      "openai_service_error",
      "OpenAI is rate limiting requests right now. Please try again shortly.",
      503,
    );
  }

  if (details.status && details.status >= 500) {
    return new EvaluationError(
      "openai_service_error",
      "OpenAI is temporarily unavailable. Please try again shortly.",
      503,
    );
  }

  return new EvaluationError(
    "openai_service_error",
    "Feynduck could not get a valid response from OpenAI.",
    502,
  );
}

function includesCardiacOutputFormula(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("cardiac output") &&
    lower.includes("heart rate") &&
    lower.includes("stroke volume") &&
    /(=|equals|multiplied|times|product|×|\bx\b)/i.test(text)
  );
}

function includesInsulinResistanceSource(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("insulin resistance") &&
    lower.includes("glut4") &&
    lower.includes("liver") &&
    lower.includes("glucose")
  );
}

function explainsGlut4Mechanism(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("glut4") &&
    (lower.includes("membrane") || lower.includes("cell surface")) &&
    (lower.includes("weaker") || lower.includes("reduced") || lower.includes("less") || lower.includes("fewer")) &&
    (lower.includes("glucose uptake") || lower.includes("glucose enters") || lower.includes("less glucose"))
  );
}

function explainsLiverMechanism(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("liver") &&
    lower.includes("glucose") &&
    (lower.includes("production") || lower.includes("release") || lower.includes("output") || lower.includes("suppress"))
  );
}

function explainsCompensation(text: string) {
  const lower = text.toLowerCase();

  return lower.includes("pancreas") || lower.includes("compensat") || lower.includes("more insulin") || lower.includes("hyperinsulin");
}

function normaliseEvaluationResult(
  result: ExplanationResult,
  request: ExplanationRequest,
): ExplanationResult {
  if (result.status === "ok") {
    result = { ...result, status: "gap_found" };
  }

  const isInsulinResistance =
    request.selectedConcept?.toLowerCase().includes("insulin resistance") &&
    includesInsulinResistanceSource(request.notes);
  const latestExplainsGlut4 = explainsGlut4Mechanism(request.explanation);
  const latestExplainsLiver = explainsLiverMechanism(request.explanation);
  const latestExplainsCompensation = explainsCompensation(request.explanation);

  if (result.status === "clear") {
    if (isInsulinResistance && latestExplainsGlut4 && !latestExplainsLiver) {
      return {
        ...result,
        status: "gap_found",
        clarityScore: 82,
        gapSummary:
          "You explained the GLUT4 mechanism, but did not explain that insulin resistance also prevents insulin from suppressing liver glucose production.",
        mainGap:
          "You explained the GLUT4 mechanism, but did not connect insulin resistance to continued liver glucose production.",
        socraticQuestion:
          "What happens to glucose production by the liver when insulin signalling is weaker?",
        resolvedGaps: Array.from(new Set([
          ...(result.resolvedGaps || []),
          "weaker insulin signalling -> fewer GLUT4 transporters move to the membrane -> reduced glucose uptake",
        ])),
      };
    }

    if (isInsulinResistance && latestExplainsGlut4 && latestExplainsLiver && !latestExplainsCompensation) {
      return {
        ...result,
        status: "gap_found",
        clarityScore: 86,
        gapSummary:
          "You explained the cell and liver mechanisms, but did not explain the pancreatic compensation that follows.",
        mainGap:
          "You did not connect insulin resistance to compensatory insulin production by the pancreas.",
        socraticQuestion:
          "How does the pancreas respond when cells and the liver respond less strongly to insulin?",
        resolvedGaps: Array.from(new Set([
          ...(result.resolvedGaps || []),
          "weaker insulin signalling -> fewer GLUT4 transporters move to the membrane -> reduced glucose uptake",
          "continued liver glucose production",
        ])),
      };
    }

    if (isInsulinResistance && latestExplainsGlut4 && latestExplainsLiver && latestExplainsCompensation) {
      return {
        ...result,
        clarityScore: typeof result.clarityScore === "number" ? Math.max(result.clarityScore, 92) : 92,
        gapSummary: null,
        mainGap: null,
        socraticQuestion: null,
        resolvedGaps: Array.from(new Set([
          ...(result.resolvedGaps || []),
          "weaker insulin signalling -> fewer GLUT4 transporters move to the membrane -> reduced glucose uptake",
          "continued liver glucose production",
        ])),
        chatMessage:
          "You've now explained the central mechanism clearly: weaker insulin signalling reduces GLUT4 movement and glucose uptake, while the liver continues releasing glucose. You also connected pancreatic compensation.",
      };
    }

    return {
      ...result,
      clarityScore: typeof result.clarityScore === "number" ? Math.max(result.clarityScore, 90) : 92,
      gapSummary: null,
      mainGap: null,
      socraticQuestion: null,
      gapType: "missing_mechanism",
      chatMessage:
        result.chatMessage ||
        "You've now explained the central mechanism clearly. That explanation is clear.",
    };
  }

  if (result.status !== "gap_found" || typeof result.clarityScore !== "number") {
    return result;
  }

  if (isInsulinResistance && latestExplainsGlut4 && latestExplainsLiver && latestExplainsCompensation) {
    return {
      ...result,
      status: "clear",
      clarityScore: Math.max(result.clarityScore, 92),
      gapSummary: null,
      mainGap: null,
      socraticQuestion: null,
      resolvedGaps: Array.from(new Set([
        ...(result.resolvedGaps || []),
        "weaker insulin signalling -> fewer GLUT4 transporters move to the membrane -> reduced glucose uptake",
      ])),
      chatMessage:
        "You've now explained the central mechanism clearly: weaker insulin signalling reduces GLUT4 movement and glucose uptake, while the liver continues releasing glucose. You also connected pancreatic compensation.",
    };
  }

  const proposedGap = `${result.mainGap || ""} ${result.gapSummary || ""} ${result.socraticQuestion || ""}`;
  if (isInsulinResistance && latestExplainsGlut4 && /glut4/i.test(proposedGap) && !latestExplainsLiver) {
    return {
      ...result,
      clarityScore: Math.min(Math.max(result.clarityScore, 72), 84),
      gapSummary:
        "You explained the GLUT4 mechanism, but did not explain that insulin resistance also prevents insulin from suppressing liver glucose production.",
      mainGap:
        "You explained the GLUT4 mechanism, but did not connect insulin resistance to continued liver glucose production.",
      socraticQuestion:
        "What happens to glucose production by the liver when insulin signalling is weaker?",
      resolvedGaps: Array.from(new Set([
        ...(result.resolvedGaps || []),
        "weaker insulin signalling -> fewer GLUT4 transporters move to the membrane -> reduced glucose uptake",
      ])),
    };
  }

  const notesHaveCentralFormula = includesCardiacOutputFormula(request.notes);
  const explanationHasCentralFormula = includesCardiacOutputFormula(request.explanation);

  if (!notesHaveCentralFormula || explanationHasCentralFormula || result.clarityScore < 75) {
    return result;
  }

  return {
    ...result,
    clarityScore: 68,
    gapType: "missing_mechanism",
    gapSummary:
      "You identified the compensation, but you did not connect cardiac output to the formula: heart rate × stroke volume.",
    whyItMatters:
      "Without the formula, the explanation reaches the right outcome but skips the mechanism that shows why heart rate can compensate when stroke volume falls.",
    socraticQuestion:
      "If stroke volume falls, what must happen to heart rate for cardiac output to remain stable?",
    suggestedReExplanationPrompt:
      "Try explaining cardiac output using the relationship between heart rate and stroke volume.",
    chatMessage:
      "You identified the compensation, but skipped the formula linking heart rate and stroke volume to cardiac output. If stroke volume falls, what must happen to heart rate for cardiac output to remain stable?",
  };
}

export async function evaluateExplanation(
  request: ExplanationRequest,
  options: { allowMock: boolean },
): Promise<EvaluationResult> {
  const model = process.env.OPENAI_EVALUATOR_MODEL || "gpt-5.4-mini";
  logOpenAIConfig(model);

  const openai = getOpenAIClient();

  if (!openai) {
    if (options.allowMock) {
      return {
        result: createMockExplanationResult(request),
        mockMode: true,
        warning: "Using mock feedback because OpenAI is not configured.",
      };
    }

    throw new EvaluationError(
      "openai_not_configured",
      "OpenAI is not configured. Add a valid OPENAI_API_KEY.",
      500,
    );
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: gapEvaluationPrompt,
        },
        {
          role: "user",
          content: [
            `Selected concept: ${request.selectedConcept || "Not specified"}`,
            `Notes: ${request.notes}`,
            request.previousExplanations?.length
              ? `Previous explanation attempts:\n${request.previousExplanations.join("\n\n")}`
              : "",
            request.previousMainGaps?.length
              ? `Previous main gaps:\n${request.previousMainGaps.join("\n")}`
              : "",
            request.previousSocraticQuestions?.length
              ? `Previous Socratic questions:\n${request.previousSocraticQuestions.join("\n")}`
              : "",
            request.resolvedGaps?.length
              ? `Already resolved gaps:\n${request.resolvedGaps.join("\n")}`
              : "",
            `Explanation: ${request.explanation}`,
          ].filter(Boolean).join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new EvaluationError(
        "openai_invalid_response",
        "OpenAI returned an empty evaluator response.",
        502,
      );
    }

    return {
      result: normaliseEvaluationResult(JSON.parse(content) as ExplanationResult, request),
      mockMode: false,
    };
  } catch (error) {
    if (error instanceof EvaluationError) {
      throw error;
    }

    throw mapOpenAIError(error);
  }
}
