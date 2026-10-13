"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@src/lib/auth";
import { createSupabaseAdminClient } from "@src/lib/supabase/admin";
import { isWaitlistAdminEmail } from "@src/lib/waitlist-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function updateWaitlistDateAction(formData: FormData) {
  const user = await requireAuthenticatedUser("/admin/waitlist");

  if (!isWaitlistAdminEmail(user.email)) {
    throw new Error("You do not have permission to edit waitlist entries.");
  }

  const entryId = formData.get("entryId");
  const joinedDate = formData.get("joinedDate");

  if (typeof entryId !== "string" || !uuidPattern.test(entryId)) {
    throw new Error("Invalid waitlist entry.");
  }

  if (typeof joinedDate !== "string" || !datePattern.test(joinedDate)) {
    throw new Error("Choose a valid joined date.");
  }

  const date = new Date(`${joinedDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== joinedDate) {
    throw new Error("Choose a valid joined date.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("waitlist_entries")
    .update({ created_at: joinedDate })
    .eq("id", entryId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not update joined date: ${error.message}`);
  }

  if (!data) {
    throw new Error("Waitlist entry not found.");
  }

  revalidatePath("/admin/waitlist");
}
