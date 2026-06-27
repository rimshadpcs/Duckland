"use server";

import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database } from "@src/types/database";

export type WaitlistActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

type WaitlistInsert = Database["public"]["Tables"]["waitlist_entries"]["Insert"];

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function joinWaitlist(
  _previousState: WaitlistActionState,
  formData: FormData,
): Promise<WaitlistActionState> {
  const email = clean(formData.get("email"))?.toLowerCase();

  if (!email || !isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email to join the waitlist." };
  }

  const entry: WaitlistInsert = {
    email,
    name: clean(formData.get("name")),
    school: clean(formData.get("school")),
    student_type: clean(formData.get("studentType")),
    study_focus: clean(formData.get("studyFocus")),
    source: clean(formData.get("source")) ?? "landing",
  };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("waitlist_entries").insert(entry);

  if (!error) {
    return { ok: true, message: "You're on the waitlist. The duck is saving your seat." };
  }

  if (error.code === "23505") {
    return { ok: true, message: "You're already on the waitlist. The duck remembered." };
  }

  return {
    ok: false,
    message:
      process.env.NODE_ENV === "development"
        ? `Could not join the waitlist: ${error.message}`
        : "Could not join the waitlist yet. Please try again.",
  };
}
