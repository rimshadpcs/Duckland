import Anthropic from "@anthropic-ai/sdk";

export type AIEffort = "low" | "medium" | "high";

export type AIErrorCode =
  | "ai_not_configured"
  | "ai_invalid_key"
  | "ai_billing"
  | "ai_unavailable"
  | "ai_invalid_response"
  | "ai_refused";

export class AIServiceError extends Error {
  code: AIErrorCode;
  status: number;

  constructor(code: AIErrorCode, message: string, status: number) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.status = status;
  }
}

export type AIKeyStatus = "valid" | "missing" | "placeholder" | "malformed";

export function getAIKeyStatus(): AIKeyStatus {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) return "missing";
  if (apiKey === "your_key_here") return "placeholder";
  if (!apiKey.startsWith("sk-ant-")) return "malformed";
  return "valid";
}

export function isLocalDevelopment() {
  return process.env.NODE_ENV !== "production";
}

// Grading explanations needs the most judgment, so it gets the stronger model.
export function getEvaluatorModel() {
  return process.env.ANTHROPIC_EVALUATOR_MODEL?.trim() || "claude-sonnet-5-5";
}

// Learning paths, follow-ups, quizzes and flashcards.
export function getStudyToolsModel() {
  return process.env.ANTHROPIC_STUDY_TOOLS_MODEL?.trim() || "claude-haiku-5-5";
}

// Models that accept server-side refusal fallbacks. Haiku has none, and rejects a fallback list.
const SERVER_FALLBACK_MODELS = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
]);

let client: Anthropic | null = null;

function getClaudeClient() {
  if (typeof window !== "undefined") {
    throw new Error("The Claude client can only be initialised on the server.");
  }

  const keyStatus = getAIKeyStatus();
  if (keyStatus === "missing") {
    throw new AIServiceError(
      "ai_not_configured",
      "Feynduck's AI isn't configured yet. Set ANTHROPIC_API_KEY on the server.",
      503,
    );
  }
  if (keyStatus !== "valid") {
    throw new AIServiceError("ai_invalid_key", "The ANTHROPIC_API_KEY on the server isn't valid.", 503);
  }

  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
  return client;
}

function toAIServiceError(error: unknown, route: string) {
  if (error instanceof AIServiceError) return error;

  console.error(
    `[AI] ${route} request failed`,
    error instanceof Anthropic.APIError ? { status: error.status, message: error.message } : error,
  );

  if (error instanceof Anthropic.APIConnectionError) {
    return new AIServiceError("ai_unavailable", "Feynduck couldn't reach its AI service. Please try again.", 503);
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AIServiceError("ai_invalid_key", "The AI service rejected the server's API key.", 503);
  }
  if (error instanceof Anthropic.APIError && error.status === 402) {
    return new AIServiceError("ai_billing", "The AI service's billing or credits need attention.", 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIServiceError("ai_unavailable", "Feynduck is busy right now. Please try again shortly.", 503);
  }
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
    return new AIServiceError("ai_unavailable", "Feynduck's AI service is temporarily unavailable. Please try again shortly.", 503);
  }

  return new AIServiceError("ai_invalid_response", "Feynduck couldn't get a valid answer. Please try again.", 502);
}

type GenerateJsonOptions = {
  /** Short label for logs, e.g. "quiz". */
  route: string;
  model: string;
  effort: AIEffort;
  system: string;
  /** The student's material. Sent before the prompt and cached, so repeat calls on it cost far less. */
  context?: string;
  prompt: string;
  /** JSON schema the reply must match. Every object needs `additionalProperties: false`. */
  schema: Record<string, unknown>;
  maxTokens?: number;
};

export async function generateJson({
  route,
  model,
  effort,
  system,
  context,
  prompt,
  schema,
  maxTokens = 16_000,
}: GenerateJsonOptions): Promise<unknown> {
  const claude = getClaudeClient();
  const content: Anthropic.Beta.BetaTextBlockParam[] = [];
  if (context) content.push({ type: "text", text: context, cache_control: { type: "ephemeral" } });
  content.push({ type: "text", text: prompt });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await claude.beta.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: { type: "json_schema", schema } },
      ...(SERVER_FALLBACK_MODELS.has(model)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });
  } catch (error) {
    throw toAIServiceError(error, route);
  }

  const { usage } = response;
  console.info("[AI] usage", {
    route,
    model: response.model,
    inputTokens: usage.input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens,
    outputTokens: usage.output_tokens,
  });

  if (response.stop_reason === "refusal") {
    throw new AIServiceError(
      "ai_refused",
      "Feynduck couldn't process this material. Try a different section of your notes.",
      422,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIServiceError("ai_invalid_response", "Feynduck's answer was cut short. Please try again.", 502);
  }

  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AIServiceError("ai_invalid_response", "Feynduck couldn't read the AI's answer. Please try again.", 502);
  }
}

// Small builders for structured-output schemas.
export const jsonString = { type: "string" } as const;
export const jsonInteger = { type: "integer" } as const;
export const jsonNullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
export const jsonStringArray = { type: "array", items: { type: "string" } } as const;

export function jsonEnum(values: readonly string[]) {
  return { type: "string", enum: values };
}

export function jsonObject(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export function jsonArray(items: Record<string, unknown>) {
  return { type: "array", items };
}
