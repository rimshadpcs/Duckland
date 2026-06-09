type OpenAIClient = {
  apiKey: string;
};

export function getOpenAIClient(): OpenAIClient | null {
  if (typeof window !== "undefined") {
    throw new Error("OpenAI can only be initialised on the server.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}
