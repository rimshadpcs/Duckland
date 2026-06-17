import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database } from "@src/types/database";

export type SourceRow = Database["public"]["Tables"]["sources"]["Row"];

export type SourceInput = {
  title?: string | null;
  content: string;
  metadata?: Database["public"]["Tables"]["sources"]["Insert"]["metadata"];
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
      },
      { onConflict: "room_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not save source material", error));
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
