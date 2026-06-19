import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database, Json } from "@src/types/database";

export type StudyRoomSessionRow = Database["public"]["Tables"]["study_room_sessions"]["Row"];

function getErrorMessage(prefix: string, error: { message?: string } | null) {
  return `${prefix}${error?.message ? `: ${error.message}` : "."}`;
}

function isMissingSessionTableError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return (
    error?.code === "PGRST205" ||
    message.includes("study_room_sessions") &&
      (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table"))
  );
}

async function getAuthenticatedUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  return { supabase, userId: user.id };
}

export async function getStudyRoomSession(roomId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("study_room_sessions")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSessionTableError(error)) return null;
    throw new Error(getErrorMessage("Could not load room session", error));
  }
  return data;
}

export async function saveStudyRoomSession(roomId: string, state: Json) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("study_room_sessions")
    .upsert(
      {
        room_id: roomId,
        user_id: userId,
        state,
      },
      { onConflict: "room_id" },
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingSessionTableError(error)) return null;
    throw new Error(getErrorMessage("Could not save room session", error));
  }
  return data;
}

export async function deleteStudyRoomSession(roomId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const { error } = await supabase.from("study_room_sessions").delete().eq("room_id", roomId).eq("user_id", userId);

  if (error && !isMissingSessionTableError(error)) {
    throw new Error(getErrorMessage("Could not clear room session", error));
  }
}
