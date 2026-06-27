import { StudyDemoPage } from "@src/features/explanation";
import { AuthRedirect } from "@src/features/auth/components/AuthRedirect";
import { getAuthenticatedUser } from "@src/lib/auth";
import { getRoomSources } from "@src/lib/repositories/sources";
import { getRoomConcept, getRoomLearningPath, type RoomConceptRow } from "@src/lib/repositories/study-path";
import { getStudyRoomSession } from "@src/lib/repositories/study-room-sessions";
import { getStudyRoom, type StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { StudyRoomSessionRow } from "@src/lib/repositories/study-room-sessions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ roomId?: string | string[]; conceptId?: string | string[] }>;
}) {
  const user = await getAuthenticatedUser();
  const params = await searchParams;
  const roomIdParam = Array.isArray(params?.roomId) ? params?.roomId[0] : params?.roomId;
  const conceptIdParam = Array.isArray(params?.conceptId) ? params?.conceptId[0] : params?.conceptId;
  const roomId = roomIdParam?.trim() || null;
  const conceptId = conceptIdParam?.trim() || null;

  if (!user) {
    return <AuthRedirect to="/login?next=%2Fstudy%2Fsession" />;
  }

  if (!user.profile?.onboarding_completed) {
    return <AuthRedirect to="/onboarding?next=%2Fstudy%2Fsession" />;
  }

  let room: StudyRoomRow | null = null;
  let sources: SourceRow[] = [];
  let session: StudyRoomSessionRow | null = null;
  let concept: RoomConceptRow | null = null;
  let roomConcepts: RoomConceptRow[] = [];

  try {
    room = roomId ? await getStudyRoom(roomId) : null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Study] could not load room", error);
    }
  }

  try {
    sources = room ? await getRoomSources(room.id) : [];
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Study] could not load room source", error);
    }
  }

  try {
    session = room ? await getStudyRoomSession(room.id) : null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Study] could not load room session", error);
    }
  }

  try {
    if (room) {
      const path = await getRoomLearningPath(room.id);
      roomConcepts = path.concepts;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Study] could not load room concepts", error);
    }
  }

  try {
    concept = room && conceptId ? await getRoomConcept(room.id, conceptId) : null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Study] could not load selected concept", error);
    }
  }

  return (
    <StudyDemoPage
      authUser={user}
      initialRoom={room}
      initialSources={sources}
      initialSessionState={session?.state || null}
      initialConcept={concept}
      initialRoomConcepts={roomConcepts}
      requestedRoomId={roomId}
    />
  );
}
