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
          content: `Notes: ${request.notes}\n\nExplanation: ${request.explanation}`,
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
      result: JSON.parse(content) as ExplanationResult,
      mockMode: false,
    };
  } catch (error) {
    if (error instanceof EvaluationError) {
      throw error;
    }

    throw mapOpenAIError(error);
  }
}
