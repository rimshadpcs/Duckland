import { NextResponse } from "next/server";
import { toFile } from "openai";
import { jsonError } from "@src/lib/api/guards";
import { getOpenAIClient, getOpenAIKeyStatus } from "@src/lib/openai";

// Claude has no speech-to-text, so recordings are transcribed with OpenAI.
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** Reads the `audio` file from a multipart request and returns `{ transcript }`. */
export async function transcribeAudioRequest(request: Request, { maxBytes }: { maxBytes: number }) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError("Audio upload must use multipart form data.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return jsonError("Audio file is required.", 400);
  }

  if (audio.size < 512) {
    return jsonError("Recording was empty. Try speaking for a little longer.", 400);
  }

  if (audio.size > maxBytes) {
    return jsonError("Recording is too large. Try a shorter explanation.", 413);
  }

  const keyStatus = getOpenAIKeyStatus();
  const openai = getOpenAIClient();
  if (!openai) {
    return jsonError(
      keyStatus.state === "missing"
        ? "Voice transcription isn't configured. Set OPENAI_API_KEY on the server."
        : "The OPENAI_API_KEY on the server isn't valid.",
      503,
    );
  }

  try {
    const upload = await toFile(new Uint8Array(await audio.arrayBuffer()), audio.name || "feynduck.webm", {
      type: audio.type || "audio/webm",
    });
    const transcription = await openai.audio.transcriptions.create({
      file: upload,
      model: TRANSCRIPTION_MODEL,
    });
    const transcript = transcription.text?.trim() || "";

    if (transcript.length < 2) {
      return jsonError("We could not hear enough speech. Try recording again.", 422);
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("[Transcription] failed", error);
    return jsonError("Feynduck could not transcribe that recording.", 502);
  }
}
