import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database } from "@src/types/database";

export type StudyRoomRow = Database["public"]["Tables"]["study_rooms"]["Row"];
export type StudyRoomWithSourceCount = StudyRoomRow & {
  source_count: number;
};

export type CreateStudyRoomInput = {
  title: string;
  description?: string | null;
};

function cleanTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

function getErrorMessage(prefix: string, error: { message?: string } | null) {
  return `${prefix}${error?.message ? `: ${error.message}` : "."}`;
}

function withSourceCount(room: StudyRoomRow, sourceCount = 0): StudyRoomWithSourceCount {
  return {
    ...room,
    source_count: sourceCount,
  };
}

export async function createStudyRoom(input: CreateStudyRoomInput) {
  const title = cleanTitle(input.title);
  if (!title) throw new Error("Room title is required.");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to create a room.");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("study_rooms")
    .insert({
      user_id: user.id,
      title,
      description: input.description?.trim() || null,
      status: "not_started",
      last_activity_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not create study room", error));
  return data;
}

export async function getStudyRooms() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to load rooms.");

  const { data, error } = await supabase
    .from("study_rooms")
    .select("*, sources(count)")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  if (error) {
    const fallback = await supabase
      .from("study_rooms")
      .select("*")
      .eq("user_id", user.id)
      .order("last_activity_at", { ascending: false });

    if (fallback.error) throw new Error(getErrorMessage("Could not load study rooms", fallback.error));
    return fallback.data.map((room) => withSourceCount(room, 0));
  }

  return data.map((room) => {
    const sources = room.sources as { count: number }[] | null | undefined;
    const { sources: _sources, ...studyRoom } = room;
    return withSourceCount(studyRoom as StudyRoomRow, sources?.[0]?.count ?? 0);
  });
}

export async function getStudyRoom(roomId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to load this room.");

  const { data, error } = await supabase
    .from("study_rooms")
    .select("*")
    .eq("id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(getErrorMessage("Could not load study room", error));
  return data;
}

export async function renameStudyRoom(roomId: string, title: string) {
  const clean = cleanTitle(title);
  if (!clean) throw new Error("Room title is required.");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to rename rooms.");

  const { data, error } = await supabase
    .from("study_rooms")
    .update({
      title: clean,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not rename study room", error));
  return data;
}

export async function deleteStudyRoom(roomId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to delete rooms.");

  const { error } = await supabase.from("study_rooms").delete().eq("id", roomId).eq("user_id", user.id);
  if (error) throw new Error(getErrorMessage("Could not delete study room", error));
}

export async function updateRoomSelectedConcept(roomId: string, concept: string | null) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to update rooms.");

  const { data, error } = await supabase
    .from("study_rooms")
    .update({
      selected_concept: concept?.trim() || null,
      status: concept?.trim() ? "in_progress" : "not_started",
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not update study room", error));
  return data;
}

export async function updateRoomSourceState({
  roomId,
  status = "in_progress",
  title,
}: {
  roomId: string;
  status?: "not_started" | "in_progress" | "clear";
  title?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to update rooms.");

  const update: Database["public"]["Tables"]["study_rooms"]["Update"] = {
    status,
    last_activity_at: new Date().toISOString(),
  };

  if (title) update.title = title;

  const { data, error } = await supabase
    .from("study_rooms")
    .update(update)
    .eq("id", roomId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(getErrorMessage("Could not update study room", error));
  return data;
}
