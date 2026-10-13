import OpenAI from "openai";

// Only voice transcription still uses OpenAI; every text feature runs on Claude (src/lib/ai/claude.ts).
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
