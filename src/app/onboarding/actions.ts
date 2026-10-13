"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@src/lib/supabase/server";
import type { Database } from "@src/types/database";

export type OnboardingActionState =
  | { ok: true }
  | { ok: false; message: string };

export type OnboardingPayload = {
  displayName?: string | null;
  educationStage?: string | null;
  educationCountry?: string | null;
  yearOfStudy?: string | null;
  qualificationType?: string | null;
  subjects?: string[];
  subjectArea?: string | null;
  courseName?: string | null;
  institutionName?: string | null;
  institutionCountry?: string | null;
  studyGoals?: string[];
  onboardingStep?: number;
};

type ProfileUpsert = Database["public"]["Tables"]["profiles"]["Insert"];

const ACADEMIC_STAGES = new Set(["undergraduate", "postgraduate"]);
const OPTIONAL_COLUMNS = ["subjects", "study_goals"] as const;

function clean(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

async function getUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, userId: user?.id ?? null, email: user?.email ?? null };
}

// Columns added by later migrations are dropped and retried, so onboarding keeps
// working before the migration has been applied.
async function upsertProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  updates: ProfileUpsert,
) {
  let { error } = await supabase.from("profiles").upsert(updates, { onConflict: "id" });

  for (const column of OPTIONAL_COLUMNS) {
    if (!error || !(column in updates) || !error.message.toLowerCase().includes(column)) continue;
    delete updates[column];
    ({ error } = await supabase.from("profiles").upsert(updates, { onConflict: "id" }));
  }

  return error;
}

export async function saveOnboardingStep(payload: OnboardingPayload): Promise<OnboardingActionState> {
  const { supabase, userId, email } = await getUserId();

  if (!userId) {
    return { ok: false, message: "Your session expired. Please log in again." };
  }

  const updates: ProfileUpsert = {
    id: userId,
    email,
    display_name: clean(payload.displayName),
    onboarding_step: payload.onboardingStep ?? 1,
    updated_at: new Date().toISOString(),
  };

  if (payload.educationStage !== undefined) updates.education_stage = clean(payload.educationStage);
  if (payload.educationCountry !== undefined) updates.education_country = clean(payload.educationCountry);
  if (payload.yearOfStudy !== undefined) updates.year_of_study = clean(payload.yearOfStudy);
  if (payload.qualificationType !== undefined) updates.qualification_type = clean(payload.qualificationType);
  if (payload.subjectArea !== undefined) updates.subject_area = clean(payload.subjectArea);
  if (payload.courseName !== undefined) updates.course_name = clean(payload.courseName);
  if (payload.institutionName !== undefined) updates.institution_name = clean(payload.institutionName);
  if (payload.institutionCountry !== undefined) updates.institution_country = clean(payload.institutionCountry);
  if (payload.subjects?.length) updates.subjects = payload.subjects;
  if (payload.studyGoals !== undefined) updates.study_goals = payload.studyGoals;

  const error = await upsertProfile(supabase, updates);

  if (error) {
    return {
      ok: false,
      message:
        process.env.NODE_ENV === "development"
          ? `I could not save that yet: ${error.message}`
          : "I could not save that yet. Please try again.",
    };
  }

  return { ok: true };
}

export async function completeOnboarding(payload: OnboardingPayload): Promise<OnboardingActionState> {
  const { supabase, userId, email } = await getUserId();

  if (!userId) {
    return { ok: false, message: "Your session expired. Please log in again." };
  }

  const required = [clean(payload.displayName), clean(payload.educationStage), clean(payload.subjectArea)];

  if (ACADEMIC_STAGES.has(payload.educationStage || "")) {
    required.push(clean(payload.institutionName), clean(payload.yearOfStudy));
  }

  if (required.some((value) => !value)) {
    return { ok: false, message: "Please complete the required questions before continuing." };
  }

  const completedAt = new Date().toISOString();
  const updates: ProfileUpsert = {
    id: userId,
    email,
    display_name: clean(payload.displayName),
    education_stage: clean(payload.educationStage),
    education_country: clean(payload.educationCountry),
    year_of_study: clean(payload.yearOfStudy),
    qualification_type: clean(payload.qualificationType),
    subject_area: clean(payload.subjectArea),
    course_name: clean(payload.courseName),
    institution_name: clean(payload.institutionName),
    institution_country: clean(payload.institutionCountry),
    study_goals: payload.studyGoals ?? [],
    onboarding_completed: true,
    onboarding_completed_at: completedAt,
    onboarding_step: payload.onboardingStep ?? 7,
    updated_at: completedAt,
  };
  if (payload.subjects?.length) updates.subjects = payload.subjects;

  const error = await upsertProfile(supabase, updates);

  if (error) {
    return {
      ok: false,
      message:
        process.env.NODE_ENV === "development"
          ? `I could not finish onboarding: ${error.message}`
          : "I could not finish onboarding. Please try again.",
    };
  }

  redirect("/study");
}
