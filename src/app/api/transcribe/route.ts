import { transcribeAudioRequest } from "@src/lib/ai/transcription";
import { guardUserAIRequest } from "@src/lib/api/guards";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const blocked = await guardUserAIRequest();
  if (blocked) return blocked;

  return transcribeAudioRequest(request, { maxBytes: MAX_AUDIO_BYTES });
}
