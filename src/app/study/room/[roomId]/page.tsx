import { AuthRedirect } from "@src/features/auth/components/AuthRedirect";
import { RoomOverview } from "@src/features/explanation";
import { getAuthenticatedUser } from "@src/lib/auth";
import { getRoomSources } from "@src/lib/repositories/sources";
import { getRoomLearningPath, type RoomConceptRow, type StudyUnitWithConcepts } from "@src/lib/repositories/study-path";
import { getStudyRoom } from "@src/lib/repositories/study-rooms";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const user = await getAuthenticatedUser();
  const { roomId } = await params;

  if (!user) {
    return <AuthRedirect to={`/login?next=%2Fstudy%2Froom%2F${encodeURIComponent(roomId)}`} />;
  }

  if (!user.profile?.onboarding_completed) {
    return <AuthRedirect to={`/onboarding?next=%2Fstudy%2Froom%2F${encodeURIComponent(roomId)}`} />;
  }

  const room = await getStudyRoom(roomId);

  if (!room) {
    return <AuthRedirect to="/study" />;
  }

  let source = null;
  let units: StudyUnitWithConcepts[] = [];
  let concepts: RoomConceptRow[] = [];
  let loadError: string | null = null;

  try {
    const sources = await getRoomSources(room.id);
    source = sources.find((item) => item.is_active) || sources[0] || null;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load source material.";
  }

  try {
    const path = await getRoomLearningPath(room.id);
    units = path.units;
    concepts = path.concepts;
    if (path.missingSchema) {
      loadError = "Learning path storage is not ready yet. Apply the latest Supabase migration.";
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load learning path.";
  }

  return (
    <RoomOverview
      authUser={user}
      room={room}
      source={source}
      units={units}
      concepts={concepts}
      loadError={loadError}
    />
  );
}
