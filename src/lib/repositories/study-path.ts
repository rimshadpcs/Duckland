import { createSupabaseServerClient } from "@src/lib/supabase/server";
import { buildTodayStudyPlan, getNextRecallDate, type StudyPlanItem } from "@src/lib/study/recommendations";
import type { Database } from "@src/types/database";

export type StudyUnitRow = Database["public"]["Tables"]["study_units"]["Row"];
export type RoomConceptRow = Database["public"]["Tables"]["room_concepts"]["Row"];
export type ConceptStatus = RoomConceptRow["status"];

export type GeneratedStudyPath = {
  units: Array<{
    title: string;
    description?: string;
    concepts: Array<{
      title: string;
      description?: string;
      prerequisites?: string[];
    }>;
  }>;
};

export type StudyUnitWithConcepts = StudyUnitRow & {
  concepts: RoomConceptRow[];
};

export type TodayStudyPlanItem = StudyPlanItem;

function normalizeConceptTitle(title: string) {
  return title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function getErrorMessage(prefix: string, error: { message?: string } | null) {
  return `${prefix}${error?.message ? `: ${error.message}` : "."}`;
}

function isMissingStudyPathTableError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return (
    error?.code === "PGRST205" ||
    (message.includes("study_units") || message.includes("room_concepts")) &&
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

export async function getRoomLearningPath(roomId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data: units, error: unitsError } = await supabase
    .from("study_units")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (unitsError) {
    if (isMissingStudyPathTableError(unitsError)) return { units: [], concepts: [], missingSchema: true };
    throw new Error(getErrorMessage("Could not load learning path", unitsError));
  }

  const { data: concepts, error: conceptsError } = await supabase
    .from("room_concepts")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (conceptsError) {
    if (isMissingStudyPathTableError(conceptsError)) return { units: [], concepts: [], missingSchema: true };
    throw new Error(getErrorMessage("Could not load room concepts", conceptsError));
  }

  const conceptsByUnitId = new Map<string, RoomConceptRow[]>();
  const orphanConcepts: RoomConceptRow[] = [];

  for (const concept of concepts || []) {
    if (!concept.unit_id) {
      orphanConcepts.push(concept);
      continue;
    }

    const current = conceptsByUnitId.get(concept.unit_id) || [];
    current.push(concept);
    conceptsByUnitId.set(concept.unit_id, current);
  }

  const unitsWithConcepts: StudyUnitWithConcepts[] = (units || []).map((unit) => ({
    ...unit,
    concepts: conceptsByUnitId.get(unit.id) || [],
  }));

  if (orphanConcepts.length) {
    unitsWithConcepts.push({
      id: "custom-concepts",
      room_id: roomId,
      user_id: userId,
      title: "Custom concepts",
      description: "Concepts you added manually.",
      sort_order: Number.MAX_SAFE_INTEGER,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      concepts: orphanConcepts,
    });
  }

  return { units: unitsWithConcepts, concepts: concepts || [], missingSchema: false };
}

export async function getTodayStudyPlan(
  rooms: Array<{ id: string; title: string }>,
): Promise<TodayStudyPlanItem[]> {
  if (!rooms.length) return [];

  const { supabase, userId } = await getAuthenticatedUserId();
  const roomTitles = new Map(rooms.map((room) => [room.id, room.title]));
  const { data, error } = await supabase
    .from("room_concepts")
    .select("*")
    .eq("user_id", userId)
    .in("room_id", rooms.map((room) => room.id));

  if (error) {
    if (isMissingStudyPathTableError(error)) return [];
    throw new Error(getErrorMessage("Could not build today’s study plan", error));
  }

  return buildTodayStudyPlan((data || []).map((concept) => ({
    id: concept.id,
    roomId: concept.room_id,
    roomTitle: roomTitles.get(concept.room_id) || "Study room",
    title: concept.title,
    status: concept.status,
    sortOrder: concept.sort_order,
    mainUnresolvedGap: concept.main_unresolved_gap,
    mainGap: concept.main_gap,
    nextReviewAt: concept.next_review_at,
    lastActivityAt: concept.last_activity_at,
  })));
}

export async function getRoomConcept(roomId: string, conceptId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("room_concepts")
    .select("*")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingStudyPathTableError(error)) return null;
    throw new Error(getErrorMessage("Could not load room concept", error));
  }

  return data;
}

export async function createCustomRoomConcept(roomId: string, title: string) {
  const cleanTitle = title.trim().replace(/\s+/g, " ");
  if (cleanTitle.length < 2) throw new Error("Concept title is required.");

  const { supabase, userId } = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("room_concepts")
    .insert({
      room_id: roomId,
      user_id: userId,
      title: cleanTitle,
      description: "Added by you.",
      status: "not_started",
      sort_order: 999,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingStudyPathTableError(error)) return null;
    throw new Error(getErrorMessage("Could not add concept", error));
  }

  return data;
}

export async function startRoomConcept(roomId: string, conceptId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("room_concepts")
    .update({
      status: "explaining",
      started_at: now,
      last_activity_at: now,
    })
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .in("status", ["not_started", "needs_recall", "due_for_review"])
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingStudyPathTableError(error)) return null;
    throw new Error(getErrorMessage("Could not start concept", error));
  }

  return data;
}

export async function updateRoomConceptProgress(
  roomId: string,
  conceptId: string,
  input: {
    clarityScore?: number | null;
    mainGap?: string | null;
    status?: ConceptStatus | null;
    isReviewAttempt?: boolean;
    lastSocraticQuestion?: string | null;
    lastWrongAssumption?: string | null;
    lastMissingRelationship?: string | null;
    lastImprovedExplanation?: string | null;
  },
) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const now = new Date().toISOString();
  const score = typeof input.clarityScore === "number" ? Math.max(0, Math.min(100, Math.round(input.clarityScore))) : null;
  const status = input.status || (score == null ? "explaining" : score >= 90 ? "clear" : score >= 60 ? "improving" : "gap_found");

  const { data: existingConcept, error: loadError } = await supabase
    .from("room_concepts")
    .select("best_clarity_score, latest_clarity_score, review_count, main_gap, main_unresolved_gap, last_missing_relationship")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) {
    if (isMissingStudyPathTableError(loadError)) return null;
    throw new Error(getErrorMessage("Could not load concept progress", loadError));
  }

  const previousBest = Math.max(
    existingConcept?.best_clarity_score ?? 0,
    existingConcept?.latest_clarity_score ?? 0,
  );
  const nextBest = score == null ? previousBest || null : Math.max(previousBest, score);
  const previousReviewCount = existingConcept?.review_count ?? 0;
  const nextReviewCount = input.isReviewAttempt ? previousReviewCount + 1 : previousReviewCount;
  const shouldScheduleRecall = status === "clear";
  const weakLink = input.mainGap || existingConcept?.main_unresolved_gap || existingConcept?.main_gap || null;

  const update: Database["public"]["Tables"]["room_concepts"]["Update"] = {
    status,
    latest_clarity_score: score,
    best_clarity_score: nextBest,
    main_gap: status === "clear" ? null : input.mainGap || null,
    main_unresolved_gap: status === "clear" ? null : input.mainGap || existingConcept?.main_unresolved_gap || null,
    last_socratic_question: input.lastSocraticQuestion || null,
    last_wrong_assumption: input.lastWrongAssumption || null,
    last_missing_relationship: input.lastMissingRelationship || weakLink || existingConcept?.last_missing_relationship || null,
    last_improved_explanation: input.lastImprovedExplanation || null,
    last_activity_at: now,
    next_review_at: shouldScheduleRecall ? getNextRecallDate(nextReviewCount, new Date(now)).toISOString() : null,
    recall_status: shouldScheduleRecall ? "scheduled" : "not_scheduled",
  };

  if (status === "clear") {
    update.completed_at = now;
  } else if (!input.isReviewAttempt) {
    update.completed_at = null;
  }

  if (input.isReviewAttempt) {
    update.latest_review_score = score;
    update.last_reviewed_at = now;
    update.review_count = nextReviewCount;
  }

  const { data, error } = await supabase
    .from("room_concepts")
    .update(update)
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    if (isMissingStudyPathTableError(error)) return null;
    throw new Error(getErrorMessage("Could not update concept progress", error));
  }

  return data;
}

export async function saveGeneratedStudyPath(
  roomId: string,
  path: GeneratedStudyPath,
  options: { mergeExisting?: boolean } = {},
) {
  const { supabase, userId } = await getAuthenticatedUserId();
  const existing = await getRoomLearningPath(roomId);

  if (existing.concepts.length > 0 && !options.mergeExisting) {
    return existing;
  }

  if (existing.concepts.length > 0 && options.mergeExisting) {
    const existingConceptKeys = new Set(existing.concepts.map((concept) => normalizeConceptTitle(concept.title)));
    const existingUnitKeys = new Map(existing.units.map((unit) => [normalizeConceptTitle(unit.title), unit]));
    const savedConcepts: RoomConceptRow[] = [...existing.concepts];

    for (let unitIndex = 0; unitIndex < path.units.length; unitIndex += 1) {
      const unit = path.units[unitIndex];
      const unitKey = normalizeConceptTitle(unit.title);
      let savedUnit = existingUnitKeys.get(unitKey);

      const missingConcepts = unit.concepts.filter((concept) => {
        const conceptKey = normalizeConceptTitle(concept.title);
        if (!conceptKey || existingConceptKeys.has(conceptKey)) return false;
        existingConceptKeys.add(conceptKey);
        return true;
      });

      if (!missingConcepts.length) continue;

      if (!savedUnit) {
        const { data: createdUnit, error: unitError } = await supabase
          .from("study_units")
          .insert({
            room_id: roomId,
            user_id: userId,
            title: unit.title,
            description: unit.description || null,
            sort_order: existing.units.length + unitIndex,
          })
          .select("*")
          .single();

        if (unitError) {
          if (isMissingStudyPathTableError(unitError)) return { units: [], concepts: [], missingSchema: true };
          throw new Error(getErrorMessage("Could not save study unit", unitError));
        }

        savedUnit = { ...createdUnit, concepts: [] };
        existing.units.push(savedUnit);
        existingUnitKeys.set(unitKey, savedUnit);
      }

      const conceptRows = missingConcepts.map((concept, conceptIndex) => ({
        room_id: roomId,
        unit_id: savedUnit.id,
        user_id: userId,
        title: concept.title,
        description: concept.description || null,
        sort_order: savedUnit.concepts.length + conceptIndex,
        status: "not_started" as const,
        prerequisite_concept_ids: [],
      }));

      const { data: unitConcepts, error: conceptError } = await supabase
        .from("room_concepts")
        .insert(conceptRows)
        .select("*");

      if (conceptError) {
        if (isMissingStudyPathTableError(conceptError)) return { units: [], concepts: [], missingSchema: true };
        throw new Error(getErrorMessage("Could not save room concepts", conceptError));
      }

      savedUnit.concepts.push(...(unitConcepts || []));
      savedConcepts.push(...(unitConcepts || []));
    }

    return { units: existing.units, concepts: savedConcepts, missingSchema: false };
  }

  const savedUnits: StudyUnitWithConcepts[] = [];
  const savedConcepts: RoomConceptRow[] = [];

  for (let unitIndex = 0; unitIndex < path.units.length; unitIndex += 1) {
    const unit = path.units[unitIndex];
    const { data: savedUnit, error: unitError } = await supabase
      .from("study_units")
      .insert({
        room_id: roomId,
        user_id: userId,
        title: unit.title,
        description: unit.description || null,
        sort_order: unitIndex,
      })
      .select("*")
      .single();

    if (unitError) {
      if (isMissingStudyPathTableError(unitError)) return { units: [], concepts: [], missingSchema: true };
      throw new Error(getErrorMessage("Could not save study unit", unitError));
    }

    const conceptRows = unit.concepts.map((concept: GeneratedStudyPath["units"][number]["concepts"][number], conceptIndex: number) => ({
      room_id: roomId,
      unit_id: savedUnit.id,
      user_id: userId,
      title: concept.title,
      description: concept.description || null,
      sort_order: conceptIndex,
      status: "not_started" as const,
      prerequisite_concept_ids: [],
    }));

    const { data: unitConcepts, error: conceptError } = await supabase
      .from("room_concepts")
      .insert(conceptRows)
      .select("*");

    if (conceptError) {
      if (isMissingStudyPathTableError(conceptError)) return { units: [], concepts: [], missingSchema: true };
      throw new Error(getErrorMessage("Could not save room concepts", conceptError));
    }

    savedUnits.push({ ...savedUnit, concepts: unitConcepts || [] });
    savedConcepts.push(...(unitConcepts || []));
  }

  return { units: savedUnits, concepts: savedConcepts, missingSchema: false };
}
