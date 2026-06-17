import { StudyDemoPage } from "@src/features/explanation";
import { requireOnboardedUser } from "@src/lib/auth";
import { getRoomSource } from "@src/lib/repositories/sources";
import { getStudyRoom } from "@src/lib/repositories/study-rooms";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ roomId?: string | string[] }>;
}) {
  const user = await requireOnboardedUser("/study/session");
  const params = await searchParams;
  const roomIdParam = Array.isArray(params?.roomId) ? params?.roomId[0] : params?.roomId;
  const roomId = roomIdParam?.trim() || null;
  const room = roomId ? await getStudyRoom(roomId) : null;
  const source = room ? await getRoomSource(room.id) : null;

  return <StudyDemoPage authUser={user} initialRoom={room} initialSource={source} requestedRoomId={roomId} />;
}
