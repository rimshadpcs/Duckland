import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@src/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: "Could not sign out. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
