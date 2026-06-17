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
  onboardingStep?: number;
};

type ProfileUpsert = Database["public"]["Tables"]["profiles"]["Insert"];

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

  let { error } = await supabase.from("profiles").upsert(updates, { onConflict: "id" });

  if (error && "subjects" in updates && error.message.toLowerCase().includes("subjects")) {
    delete updates.subjects;
    const retry = await supabase.from("profiles").upsert(updates, { onConflict: "id" });
    error = retry.error;
  }

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

  const required = [
    clean(payload.displayName),
    clean(payload.educationStage),
  ];

  const stage = payload.educationStage;
  const subjects = payload.subjects || [];

  if (stage === "secondary_school" || stage === "college") {
    required.push(clean(payload.educationCountry), clean(payload.yearOfStudy));
    if (!subjects.length && !clean(payload.courseName)) required.push(null);
  }

  if (stage === "teacher") {
    required.push(clean(payload.educationCountry));
    if (!subjects.length && !clean(payload.courseName)) required.push(null);
  }

  if (stage === "undergraduate") {
    required.push(clean(payload.institutionName), clean(payload.yearOfStudy), clean(payload.courseName));
  }

  if (stage === "postgraduate") {
    required.push(clean(payload.institutionName), clean(payload.qualificationType), clean(payload.courseName));
  }

  if (stage === "professional") {
    required.push(clean(payload.courseName), clean(payload.yearOfStudy));
  }

  if (stage === "other") {
    required.push(clean(payload.courseName));
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
      onboarding_completed: true,
      onboarding_completed_at: completedAt,
      onboarding_step: payload.onboardingStep ?? 6,
      updated_at: completedAt,
    };
  if (subjects.length) updates.subjects = subjects;

  let { error } = await supabase.from("profiles").upsert(updates, { onConflict: "id" });

  if (error && "subjects" in updates && error.message.toLowerCase().includes("subjects")) {
    delete updates.subjects;
    const retry = await supabase.from("profiles").upsert(updates, { onConflict: "id" });
    error = retry.error;
  }

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
