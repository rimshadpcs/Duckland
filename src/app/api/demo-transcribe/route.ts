import { NextResponse } from "next/server";
import { toFile } from "openai";
import { getOpenAIClient, getOpenAIKeyStatus, logOpenAIConfig } from "@src/lib/openai";

const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Audio upload must use multipart form data." }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  if (audio.size < 512) {
    return NextResponse.json({ error: "Recording was empty. Try speaking for a little longer." }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Recording is too large. Try a shorter explanation." }, { status: 400 });
  }

  const keyStatus = getOpenAIKeyStatus();
  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json({ error: "OpenAI API key is invalid." }, { status: 401 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "OpenAI is not configured for transcription." }, { status: 503 });
  }

  logOpenAIConfig(TRANSCRIPTION_MODEL);

  try {
    const arrayBuffer = await audio.arrayBuffer();
    const upload = await toFile(new Uint8Array(arrayBuffer), audio.name || "feynduck-demo.webm", {
      type: audio.type || "audio/webm",
    });
    const transcription = await openai.audio.transcriptions.create({
      file: upload,
      model: TRANSCRIPTION_MODEL,
    });
    const transcript = transcription.text?.trim() || "";

    if (transcript.length < 2) {
      return NextResponse.json({ error: "We could not hear enough speech. Try recording again." }, { status: 422 });
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OpenAI] demo transcription failed", error);
    }

    return NextResponse.json({ error: "Feynduck could not transcribe that recording." }, { status: 502 });
  }
}
