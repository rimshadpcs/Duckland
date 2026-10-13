import { transcribeAudioRequest } from "@src/lib/ai/transcription";
import { guardDemoAIRequest } from "@src/lib/api/guards";

// Public landing-page demo: rate-limited per IP and capped well below the in-app limit.
const MAX_DEMO_AUDIO_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const blocked = await guardDemoAIRequest(request);
  if (blocked) return blocked;

  return transcribeAudioRequest(request, { maxBytes: MAX_DEMO_AUDIO_BYTES });
}
