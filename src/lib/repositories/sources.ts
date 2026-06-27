import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database } from "@src/types/database";

export type SourceRow = Database["public"]["Tables"]["sources"]["Row"];

export type SourceInput = {
  title?: string | null;
  content: string;
  metadata?: Database["public"]["Tables"]["sources"]["Insert"]["metadata"];
};

export type PdfSourceInput = SourceInput & {
  originalFileName: string;
  storagePath: string;
  pageCount: number;
  extractedTextLength: number;
};

function getErrorMessage(prefix: string, error: { message?: string } | null) {
  return `${prefix}${error?.message ? `: ${error.message}` : "."}`;
}

async function getAuthenticatedUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  return { supabase, userId: user.id };
}

export async function getRoomSource(roomId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(getErrorMessage("Could not load source material", error));
  return data;
}

export async function saveRoomSource(roomId: string, input: SourceInput) {
  const content = input.content.trim();
  if (content.length < 10) throw new Error("Source material must be at least 10 characters.");

  const { supabase, userId } = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("sources")
    .upsert(
      {
        room_id: roomId,
        user_id: userId,
        source_type: "pasted_text",
        title: input.title?.trim() || "Pasted source material",
        content,
        metadata: input.metadata || {},
        original_file_name: null,
        storage_path: null,
        page_count: null,
        extracted_text_length: content.length,
        extraction_status: null,
      },
      { onConflict: "room_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not save source material", error));
  return data;
}

export async function saveRoomPdfSource(roomId: string, input: PdfSourceInput) {
  const content = input.content.trim();
  if (content.length < 300) throw new Error("Extracted PDF text must be at least 300 characters.");

  const { supabase, userId } = await getAuthenticatedUserId();
  const { data: existingSource } = await supabase
    .from("sources")
    .select("storage_path, source_type")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const title = input.title?.trim() || input.originalFileName;
  const { data, error } = await supabase
    .from("sources")
    .upsert(
      {
        room_id: roomId,
        user_id: userId,
        source_type: "pdf",
        title,
        content,
        metadata: input.metadata || {},
        original_file_name: input.originalFileName,
        storage_path: input.storagePath,
        page_count: input.pageCount,
        extracted_text_length: input.extractedTextLength,
        extraction_status: "complete",
      },
      { onConflict: "room_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not save PDF source material", error));

  const oldStoragePath = existingSource?.source_type === "pdf" ? existingSource.storage_path : null;
  if (oldStoragePath && oldStoragePath !== input.storagePath) {
    const { error: cleanupError } = await supabase.storage.from("study-files").remove([oldStoragePath]);
    if (cleanupError && process.env.NODE_ENV === "development") {
      console.warn("[Study] could not remove replaced PDF", cleanupError);
    }
  }

  return data;
}

export async function updateRoomSource(sourceId: string, input: SourceInput) {
  const content = input.content.trim();
  if (content.length < 10) throw new Error("Source material must be at least 10 characters.");

  const { supabase, userId } = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("sources")
    .update({
      title: input.title?.trim() || "Pasted source material",
      content,
      metadata: input.metadata || {},
    })
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not update source material", error));
  return data;
}

export async function deleteRoomSource(sourceId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const { error } = await supabase.from("sources").delete().eq("id", sourceId).eq("user_id", userId);

  if (error) throw new Error(getErrorMessage("Could not delete source material", error));
}
