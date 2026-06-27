"use server";

import { revalidatePath } from "next/cache";
import {
  createStudyRoom,
  deleteStudyRoom,
  renameStudyRoom,
  updateRoomSelectedConcept,
  updateRoomSourceState,
} from "@src/lib/repositories/study-rooms";
import { deleteStudyRoomSession, saveStudyRoomSession } from "@src/lib/repositories/study-room-sessions";
import {
  createCustomRoomConcept,
  startRoomConcept,
  updateRoomConceptProgress,
  type ConceptStatus,
} from "@src/lib/repositories/study-path";
import {
  createPdfSource,
  createTextSource,
  deleteSource,
  toggleSourceActive,
  updateSource,
} from "@src/lib/repositories/sources";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { Json } from "@src/types/database";

export type StudyActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function getMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function deriveSourceTitle(content: string) {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return "Pasted source material";
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function shouldAutoRename(title: string) {
  return /^(untitled room|new study room)$/i.test(title.trim());
}

export async function createStudyRoomAction(input: {
  title: string;
  description?: string | null;
}): Promise<StudyActionResult<{ id: string }>> {
  try {
    const room = await createStudyRoom(input);
    revalidatePath("/study");
    return { ok: true, data: { id: room.id } };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not create study room.") };
  }
}

export async function renameStudyRoomAction(roomId: string, title: string): Promise<StudyActionResult> {
  try {
    await renameStudyRoom(roomId, title);
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    revalidatePath("/study/session");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not rename study room.") };
  }
}

export async function deleteStudyRoomAction(roomId: string): Promise<StudyActionResult> {
  try {
    await deleteStudyRoom(roomId);
    revalidatePath("/study");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not delete study room.") };
  }
}

export async function updateRoomSelectedConceptAction(roomId: string, concept: string | null): Promise<StudyActionResult> {
  try {
    await updateRoomSelectedConcept(roomId, concept);
    revalidatePath("/study");
    revalidatePath("/study/session");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not update selected concept.") };
  }
}

export async function saveRoomSourceAction(input: {
  roomId: string;
  roomTitle: string;
  title?: string | null;
  content: string;
}): Promise<StudyActionResult<{ sourceId: string; title: string; roomTitle?: string; source: SourceRow }>> {
  try {
    const sourceTitle = input.title?.trim() || deriveSourceTitle(input.content);
    const source = await createTextSource(input.roomId, {
      title: sourceTitle,
      content: input.content,
    });

    const nextRoomTitle = shouldAutoRename(input.roomTitle) ? sourceTitle : undefined;
    await updateRoomSourceState({
      roomId: input.roomId,
      status: "in_progress",
      title: nextRoomTitle,
    });

    revalidatePath("/study");
    revalidatePath("/study/session");
    return {
      ok: true,
      data: {
        sourceId: source.id,
        title: source.title || sourceTitle,
        roomTitle: nextRoomTitle,
        source,
      },
    };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not save source material.") };
  }
}

export async function saveRoomPdfSourceAction(input: {
  roomId: string;
  roomTitle: string;
  title?: string | null;
  content: string;
  originalFileName: string;
  storagePath: string;
  pageCount: number;
  extractedTextLength: number;
}): Promise<StudyActionResult<{
  sourceId: string;
  title: string;
  roomTitle?: string;
  storagePath: string;
  originalFileName: string;
  pageCount: number;
  extractedTextLength: number;
  source: SourceRow;
}>> {
  try {
    const sourceTitle = input.title?.trim() || input.originalFileName;
    const source = await createPdfSource(input.roomId, {
      title: sourceTitle,
      content: input.content,
      originalFileName: input.originalFileName,
      storagePath: input.storagePath,
      pageCount: input.pageCount,
      extractedTextLength: input.extractedTextLength,
    });

    const nextRoomTitle = shouldAutoRename(input.roomTitle) ? sourceTitle : undefined;
    await updateRoomSourceState({
      roomId: input.roomId,
      status: "in_progress",
      title: nextRoomTitle,
    });

    revalidatePath("/study");
    revalidatePath(`/study/room/${input.roomId}`);
    revalidatePath("/study/session");
    return {
      ok: true,
      data: {
        sourceId: source.id,
        title: source.title || sourceTitle,
        roomTitle: nextRoomTitle,
        storagePath: source.storage_path || input.storagePath,
        originalFileName: source.original_file_name || input.originalFileName,
        pageCount: source.page_count || input.pageCount,
        extractedTextLength: source.extracted_text_length || input.extractedTextLength,
        source,
      },
    };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not save PDF source material.") };
  }
}

export async function renameRoomSourceAction(
  sourceId: string,
  title: string,
  roomId: string,
): Promise<StudyActionResult<{ title: string }>> {
  try {
    const source = await updateSource(sourceId, { title });
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    revalidatePath("/study/session");
    return { ok: true, data: { title: source.title || "Untitled source" } };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not rename source material.") };
  }
}

export async function toggleRoomSourceActiveAction(
  sourceId: string,
  roomId: string,
  isActive: boolean,
): Promise<StudyActionResult<{ isActive: boolean }>> {
  try {
    const source = await toggleSourceActive(sourceId, isActive);
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    revalidatePath("/study/session");
    return { ok: true, data: { isActive: source.is_active } };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not update source material.") };
  }
}

export async function deleteRoomSourceAction(
  sourceId: string,
  roomId: string,
): Promise<StudyActionResult> {
  try {
    await deleteSource(sourceId);
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    revalidatePath("/study/session");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not delete source material.") };
  }
}

export async function saveRoomSessionStateAction(roomId: string, state: Json): Promise<StudyActionResult> {
  try {
    await saveStudyRoomSession(roomId, state);
    revalidatePath(`/study/room/${roomId}`);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not save room session.") };
  }
}

export async function clearRoomSessionStateAction(roomId: string): Promise<StudyActionResult> {
  try {
    await deleteStudyRoomSession(roomId);
    revalidatePath(`/study/room/${roomId}`);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not clear room session.") };
  }
}

export async function createCustomRoomConceptAction(
  roomId: string,
  title: string,
): Promise<StudyActionResult<{ id: string; title: string } | null>> {
  try {
    const concept = await createCustomRoomConcept(roomId, title);
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    revalidatePath("/study/session");
    return { ok: true, data: concept ? { id: concept.id, title: concept.title } : null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not add concept.") };
  }
}

export async function startRoomConceptAction(roomId: string, conceptId: string): Promise<StudyActionResult> {
  try {
    await startRoomConcept(roomId, conceptId);
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not start concept.") };
  }
}

export async function updateRoomConceptProgressAction(
  roomId: string,
  conceptId: string,
  input: {
    clarityScore?: number | null;
    mainGap?: string | null;
    status?: ConceptStatus | null;
  },
): Promise<StudyActionResult> {
  try {
    await updateRoomConceptProgress(roomId, conceptId, input);
    revalidatePath("/study");
    revalidatePath(`/study/room/${roomId}`);
    revalidatePath("/study/session");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: getMessage(error, "Could not update concept progress.") };
  }
}
