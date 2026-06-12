import OpenAI from "openai";

let openai: OpenAI | null = null;

export type OpenAIKeyStatus =
  | { state: "valid"; hasKey: true; isPlaceholder: false }
  | { state: "missing"; hasKey: false; isPlaceholder: false }
  | { state: "placeholder"; hasKey: true; isPlaceholder: true }
  | { state: "malformed"; hasKey: true; isPlaceholder: false };

export function getOpenAIKeyStatus(): OpenAIKeyStatus {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return { state: "missing", hasKey: false, isPlaceholder: false };
  }

  if (apiKey === "your_key_here") {
    return { state: "placeholder", hasKey: true, isPlaceholder: true };
  }

  if (!apiKey.startsWith("sk-")) {
    return { state: "malformed", hasKey: true, isPlaceholder: false };
  }

  return { state: "valid", hasKey: true, isPlaceholder: false };
}

export function isLocalDevelopment() {
  return process.env.NODE_ENV !== "production";
}

export function logOpenAIConfig(model: string) {
  if (!isLocalDevelopment()) return;

  const keyStatus = getOpenAIKeyStatus();
  console.info("[OpenAI] config", {
    hasKey: keyStatus.hasKey,
    isPlaceholder: keyStatus.isPlaceholder,
    keyState: keyStatus.state,
    model,
  });
}

export function getOpenAIClient(): OpenAI | null {
  if (typeof window !== "undefined") {
    throw new Error("OpenAI client can only be initialised on the server.");
  }

  if (openai) return openai;

  const keyStatus = getOpenAIKeyStatus();

  if (keyStatus.state !== "valid") {
    return null;
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openai;
}
