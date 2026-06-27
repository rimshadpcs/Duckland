import type { ExplanationRequest, ExplanationResult } from "../types";
import { createMockExplanationResult } from "./mockResult";
import { getOpenAIClient, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";
import { gapEvaluationPrompt } from "../prompts/gapEvaluationPrompt";
import { evaluateInsulinResistanceCoverage, isInsulinResistanceSource } from "./insulinCoverage.mjs";
import { evaluateNextTokenPredictionCoverage } from "./nextTokenCoverage.mjs";

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

const topicStopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "about",
  "composition",
  "concept",
  "process",
  "system",
  "structure",
  "function",
  "mechanism",
]);

function normaliseTopicToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getMeaningfulTopicTokens(value?: string) {
  if (!value) return [];

  return value
    .split(/[^a-z0-9]+/i)
    .map(normaliseTopicToken)
    .filter((token) => token.length >= 4 && !topicStopWords.has(token));
}

function textContainsTopicToken(text: string, token: string) {
  if (!token) return false;

  const lower = text.toLowerCase();
  const singular = token.endsWith("s") ? token.slice(0, -1) : token;
  const plural = token.endsWith("s") ? token : `${token}s`;

  return lower.includes(singular) || lower.includes(plural);
}

function isLikelySameSelectedTopic(request: ExplanationRequest) {
  const selectedTokens = getMeaningfulTopicTokens(request.selectedConcept);
  if (!selectedTokens.length) return false;

  const explanationHits = selectedTokens.filter((token) => textContainsTopicToken(request.explanation, token)).length;
  const notesHits = selectedTokens.filter((token) => textContainsTopicToken(request.notes, token)).length;

  if (explanationHits > 0 && notesHits > 0) return true;

  const selectedConcept = request.selectedConcept?.toLowerCase() || "";
  const explanation = request.explanation.toLowerCase();

  if (
    selectedConcept.includes("airway") &&
    explanation.includes("airway") &&
    /(upper|lower|trachea|bronchi|bronchiole|alveoli|larynx|pharynx|cartilage|mucus|cilia|smooth muscle)/i.test(request.explanation)
  ) {
    return true;
  }

  return false;
}

function correctFalseTopicMismatch(
  result: ExplanationResult,
  request: ExplanationRequest,
): ExplanationResult {
  const selectedConcept = request.selectedConcept || "the selected concept";

  return {
    ...result,
    status: "gap_found",
    clarityScore: typeof result.clarityScore === "number" ? result.clarityScore : 70,
    gapType: result.gapType === "topic_mismatch" ? "missing_mechanism" : result.gapType,
    gapSummary:
      result.gapSummary && result.gapSummary.toLowerCase() !== "topic mismatch"
        ? result.gapSummary
        : `Your explanation is about ${selectedConcept}, but it needs a clearer source-grounded link between the parts you named and the mechanism the source expects.`,
    mainGap:
      result.mainGap && result.mainGap.toLowerCase() !== "topic mismatch"
        ? result.mainGap
        : `You stayed on ${selectedConcept}, but did not fully connect the named parts to the source-level mechanism.`,
    scoreReason:
      result.scoreReason ||
      "The explanation discusses the selected concept, so it should be scored for clarity rather than treated as off-topic.",
    whyItMatters:
      result.whyItMatters && !/match the selected concept/i.test(result.whyItMatters)
        ? result.whyItMatters
        : "This matters because an on-topic explanation should be judged by the missing reasoning link, not rejected as a different topic.",
    socraticQuestion:
      result.socraticQuestion && !/selected concept/i.test(result.socraticQuestion)
        ? result.socraticQuestion
        : `How do the parts you named work together to explain ${selectedConcept}?`,
    suggestedReExplanationPrompt:
      result.suggestedReExplanationPrompt ||
      `Try explaining ${selectedConcept} by linking each important part to its role in the source.`,
    chatMessage:
      `This is not a topic mismatch: your answer is about ${selectedConcept}. The next step is to connect the parts you named into the source-grounded mechanism.`,
  };
}

function applyInsulinResistanceCoverage(
  result: ExplanationResult,
  request: ExplanationRequest,
): ExplanationResult | null {
  if (!isInsulinResistanceSource(request.notes, request.selectedConcept)) {
    return null;
  }

  const coverage = evaluateInsulinResistanceCoverage(request.notes, request.explanation);
  const isClear = coverage.status === "clear";
  const status: ExplanationResult["status"] = isClear ? "clear" : "gap_found";
  const mainGap = coverage.mainGap;
  const socraticQuestion = coverage.socraticQuestion;

  return {
    ...result,
    status,
    clarityScore: coverage.clarityScore,
    gapType: "missing_mechanism",
    gapSummary: mainGap,
    mainGap,
    whyItMatters: isClear
      ? "Your latest explanation covers the central source-grounded mechanisms for the selected concept."
      : "This matters because Feynduck scores the latest explanation by the source-level mechanism, not by earlier attempts or keyword overlap.",
    socraticQuestion,
    suggestedReExplanationPrompt: isClear
      ? "You can now try explaining the concept again from memory, keeping the full causal chain intact."
      : "Try rebuilding the explanation around the missing source-level step.",
    chatMessage: isClear
      ? "This explanation is clear: your latest answer covers the central insulin-resistance mechanism from the source."
      : `${mainGap} ${socraticQuestion || ""}`.trim(),
    scoreReason: coverage.scoreReason,
    coveredClaims: coverage.coveredClaims,
    missingClaims: coverage.missingClaims,
    resolvedGaps: Array.from(new Set([
      ...(result.resolvedGaps || []),
      ...coverage.resolvedGaps,
    ])),
  };
}

function applyNextTokenPredictionCoverage(
  result: ExplanationResult,
  request: ExplanationRequest,
): ExplanationResult | null {
  const coverage = evaluateNextTokenPredictionCoverage(request.notes, request.explanation, request.selectedConcept);
  if (!coverage) return null;

  if (coverage.status === "topic_mismatch") {
    return {
      ...result,
      status: "topic_mismatch",
      clarityScore: null,
      gapType: "topic_mismatch",
      gapSummary: coverage.mainGap,
      mainGap: coverage.mainGap,
      whyItMatters: "Feynduck needs your explanation to match the selected concept before it can score clarity honestly.",
      socraticQuestion: coverage.socraticQuestion,
      suggestedReExplanationPrompt: "Try explaining how an LLM predicts the next token from the existing token sequence.",
      chatMessage: coverage.mainGap || "This explanation is about a different topic.",
      scoreReason: coverage.scoreReason,
      coveredClaims: coverage.coveredClaims,
      missingClaims: coverage.missingClaims,
      coreClaims: coverage.coreClaims,
    };
  }

  const isClear = coverage.status === "clear" && coverage.missingClaims.length === 0;

  return {
    ...result,
    status: (isClear ? "clear" : coverage.status) as ExplanationResult["status"],
    clarityScore: coverage.clarityScore,
    gapType: "incomplete_sequence",
    gapSummary: coverage.mainGap,
    mainGap: coverage.mainGap,
    whyItMatters: isClear
      ? "You included the complete core mechanism from the material."
      : "This matters because next-token prediction is a repeated token-by-token process, not just a broad idea that models guess words.",
    socraticQuestion: coverage.socraticQuestion,
    suggestedReExplanationPrompt: isClear
      ? "You can now try explaining the concept again from memory, keeping the token-by-token sequence intact."
      : "Try explaining tokens, context, next-token prediction, and how repeating that step builds a full response.",
    chatMessage: isClear
      ? "You can explain this clearly. You included the complete core mechanism from the material."
      : "You have the main idea. One important mechanism is still missing.",
    scoreReason: coverage.scoreReason,
    coveredClaims: coverage.coveredClaims,
    missingClaims: coverage.missingClaims,
    coreClaims: coverage.coreClaims,
  };
}

function applyCoreClaimScoreGuard(result: ExplanationResult): ExplanationResult {
  if (result.status === "topic_mismatch") return result;

  const missingClaims = Array.isArray(result.missingClaims) ? result.missingClaims.filter(Boolean) : [];
  if (!missingClaims.length) {
    if (result.status === "clear" && typeof result.clarityScore === "number" && result.clarityScore >= 100) {
      return {
        ...result,
        chatMessage: "You can explain this clearly. You included the complete core mechanism from the material.",
      };
    }

    return result;
  }

  const currentScore = typeof result.clarityScore === "number" ? result.clarityScore : 70;
  const nextScore = missingClaims.length >= 2 ? Math.min(currentScore, 74) : Math.min(currentScore, 85);

  return {
    ...result,
    status: nextScore >= 60 ? "improving" : "gap_found",
    clarityScore: nextScore,
    gapType: result.gapType === "topic_mismatch" ? "missing_mechanism" : result.gapType,
    gapSummary: result.gapSummary || result.mainGap || `You have the main idea, but this source-grounded claim is still missing: ${missingClaims[0]}`,
    mainGap: result.mainGap || result.gapSummary || `Explain this missing source-grounded claim: ${missingClaims[0]}`,
    whyItMatters:
      result.whyItMatters ||
      "This matters because a shallow summary can sound right while still skipping the mechanism the source expects.",
    socraticQuestion:
      result.socraticQuestion ||
      "What exact source-grounded step connects your current explanation to the full mechanism?",
    suggestedReExplanationPrompt:
      result.suggestedReExplanationPrompt ||
      "Try again by adding the missing source-grounded mechanism.",
    chatMessage: "You have the main idea. One important mechanism is still missing.",
  };
}

function normaliseEvaluationResult(
  result: ExplanationResult,
  request: ExplanationRequest,
): ExplanationResult {
  if (result.status === "ok") {
    result = { ...result, status: "gap_found" };
  }

  if (result.status === "topic_mismatch") {
    return isLikelySameSelectedTopic(request) ? correctFalseTopicMismatch(result, request) : result;
  }

  const insulinCoverageResult = applyInsulinResistanceCoverage(result, request);
  if (insulinCoverageResult) {
    return applyCoreClaimScoreGuard(insulinCoverageResult);
  }

  const nextTokenCoverageResult = applyNextTokenPredictionCoverage(result, request);
  if (nextTokenCoverageResult) {
    return applyCoreClaimScoreGuard(nextTokenCoverageResult);
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

    return applyCoreClaimScoreGuard({
      ...result,
      clarityScore: typeof result.clarityScore === "number" ? Math.max(result.clarityScore, 90) : 92,
      gapSummary: null,
      mainGap: null,
      socraticQuestion: null,
      gapType: "missing_mechanism",
      chatMessage:
        result.chatMessage ||
        "You've now explained the central mechanism clearly. That explanation is clear.",
    });
  }

  if (result.status !== "gap_found" || typeof result.clarityScore !== "number") {
    return applyCoreClaimScoreGuard(result);
  }

  if (isInsulinResistance && latestExplainsGlut4 && latestExplainsLiver && latestExplainsCompensation) {
      return applyCoreClaimScoreGuard({
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
      });
  }

  const proposedGap = `${result.mainGap || ""} ${result.gapSummary || ""} ${result.socraticQuestion || ""}`;
  if (isInsulinResistance && latestExplainsGlut4 && /glut4/i.test(proposedGap) && !latestExplainsLiver) {
      return applyCoreClaimScoreGuard({
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
      });
  }

  const notesHaveCentralFormula = includesCardiacOutputFormula(request.notes);
  const explanationHasCentralFormula = includesCardiacOutputFormula(request.explanation);

  if (!notesHaveCentralFormula || explanationHasCentralFormula || result.clarityScore < 75) {
    return applyCoreClaimScoreGuard(result);
  }

  return applyCoreClaimScoreGuard({
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
  });
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
