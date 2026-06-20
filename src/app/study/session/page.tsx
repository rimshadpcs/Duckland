import { StudyDemoPage } from "@src/features/explanation";
import { AuthRedirect } from "@src/features/auth/components/AuthRedirect";
import { getAuthenticatedUser } from "@src/lib/auth";
import { getRoomSource } from "@src/lib/repositories/sources";
import { getStudyRoomSession } from "@src/lib/repositories/study-room-sessions";
import { getStudyRoom, type StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { StudyRoomSessionRow } from "@src/lib/repositories/study-room-sessions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ roomId?: string | string[] }>;
}) {
  const user = await getAuthenticatedUser();
  const params = await searchParams;
  const roomIdParam = Array.isArray(params?.roomId) ? params?.roomId[0] : params?.roomId;
  const roomId = roomIdParam?.trim() || null;

  if (!user) {
    return <AuthRedirect to="/login?next=%2Fstudy%2Fsession" />;
  }

  if (!user.profile?.onboarding_completed) {
    return <AuthRedirect to="/onboarding?next=%2Fstudy%2Fsession" />;
  }

  let room: StudyRoomRow | null = null;
  let source: SourceRow | null = null;
  let session: StudyRoomSessionRow | null = null;

  try {
    room = roomId ? await getStudyRoom(roomId) : null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Study] could not load room", error);
    }
  }

  try {
    source = room ? await getRoomSource(room.id) : null;
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

  return (
    <StudyDemoPage
      authUser={user}
      initialRoom={room}
      initialSource={source}
      initialSessionState={session?.state || null}
      requestedRoomId={roomId}
    />
  );
}
