import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database } from "@src/types/database";

export type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
export type SourceType = "pdf" | "pasted_text";

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

export type CombinedRoomSource = {
  content: string;
  sourceCount: number;
  totalCharacters: number;
  sources: Array<{
    id: string;
    title: string;
    sourceType: SourceType;
  }>;
};

function getErrorMessage(prefix: string, error: { message?: string } | null) {
  return `${prefix}${error?.message ? `: ${error.message}` : "."}`;
}

function getSourceTitle(source: Pick<SourceRow, "title" | "original_file_name" | "source_type">) {
  return source.title?.trim() || source.original_file_name?.trim() || (source.source_type === "pdf" ? "PDF source" : "Pasted notes");
}

async function getAuthenticatedUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  return { supabase, userId: user.id };
}

async function getNextSortOrder(roomId: string, userId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("sources")
    .select("sort_order")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) throw new Error(getErrorMessage("Could not prepare source order", error));
  return ((data?.[0]?.sort_order as number | undefined) ?? -1) + 1;
}

export async function getRoomSources(roomId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(getErrorMessage("Could not load source material", error));
  return data || [];
}

export async function getActiveRoomSources(roomId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(getErrorMessage("Could not load active source material", error));
  return data || [];
}

export async function getRoomSource(roomId: string) {
  const sources = await getRoomSources(roomId);
  return sources.find((source) => source.is_active) || sources[0] || null;
}

export async function createTextSource(roomId: string, input: SourceInput) {
  const content = input.content.trim();
  if (content.length < 10) throw new Error("Source material must be at least 10 characters.");

  const { supabase, userId } = await getAuthenticatedUserId();
  const sortOrder = await getNextSortOrder(roomId, userId, supabase);
  const { data, error } = await supabase
    .from("sources")
    .insert({
      room_id: roomId,
      user_id: userId,
      source_type: "pasted_text",
      title: input.title?.trim() || "Pasted notes",
      content,
      metadata: input.metadata || {},
      original_file_name: null,
      storage_path: null,
      page_count: null,
      extracted_text_length: content.length,
      extraction_status: null,
      sort_order: sortOrder,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not save source material", error));
  return data;
}

export async function createPdfSource(roomId: string, input: PdfSourceInput) {
  const content = input.content.trim();
  if (content.length < 300) throw new Error("Extracted PDF text must be at least 300 characters.");

  const { supabase, userId } = await getAuthenticatedUserId();
  const sortOrder = await getNextSortOrder(roomId, userId, supabase);
  const title = input.title?.trim() || input.originalFileName;
  const { data, error } = await supabase
    .from("sources")
    .insert({
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
      sort_order: sortOrder,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not save PDF source material", error));
  return data;
}

export async function updateSource(sourceId: string, input: Partial<SourceInput>) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const update: Database["public"]["Tables"]["sources"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.title === "string") update.title = input.title.trim() || "Untitled source";
  if (typeof input.content === "string") {
    const content = input.content.trim();
    if (content.length < 10) throw new Error("Source material must be at least 10 characters.");
    update.content = content;
    update.extracted_text_length = content.length;
  }
  if (input.metadata) update.metadata = input.metadata;

  const { data, error } = await supabase
    .from("sources")
    .update(update)
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not update source material", error));
  return data;
}

export async function deleteSource(sourceId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const { data: source, error: loadError } = await supabase
    .from("sources")
    .select("storage_path, source_type")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) throw new Error(getErrorMessage("Could not load source material", loadError));

  const { error } = await supabase.from("sources").delete().eq("id", sourceId).eq("user_id", userId);
  if (error) throw new Error(getErrorMessage("Could not delete source material", error));

  if (source?.source_type === "pdf" && source.storage_path) {
    const { error: cleanupError } = await supabase.storage.from("study-files").remove([source.storage_path]);
    if (cleanupError && process.env.NODE_ENV === "development") {
      console.warn("[Study] could not remove deleted PDF", cleanupError);
    }
  }
}

export async function toggleSourceActive(sourceId: string, isActive: boolean) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("sources")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not update source material", error));
  return data;
}

export async function reorderSources(roomId: string, sourceIds: string[]) {
  const { supabase, userId } = await getAuthenticatedUserId();

  for (let index = 0; index < sourceIds.length; index += 1) {
    const { error } = await supabase
      .from("sources")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", sourceIds[index])
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (error) throw new Error(getErrorMessage("Could not reorder source material", error));
  }
}

export async function getCombinedRoomSourceContent(roomId: string): Promise<CombinedRoomSource> {
  const sources = await getActiveRoomSources(roomId);
  const sections = sources.map((source) => {
    const title = getSourceTitle(source);
    return `===== Source: ${title} =====\n${source.content.trim()}`;
  });
  const content = sections.join("\n\n");

  return {
    content,
    sourceCount: sources.length,
    totalCharacters: sources.reduce((total, source) => total + source.content.trim().length, 0),
    sources: sources.map((source) => ({
      id: source.id,
      title: getSourceTitle(source),
      sourceType: source.source_type === "pdf" ? "pdf" : "pasted_text",
    })),
  };
}

export const saveRoomSource = createTextSource;
export const saveRoomPdfSource = createPdfSource;
export const updateRoomSource = updateSource;
export const deleteRoomSource = deleteSource;
