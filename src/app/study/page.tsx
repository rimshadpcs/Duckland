import { StudyRoomsDashboard } from "@src/features/explanation";
import { requireOnboardedUser } from "@src/lib/auth";
import { getStudyRooms, type StudyRoomRow } from "@src/lib/repositories/study-rooms";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireOnboardedUser("/study");
  let rooms: StudyRoomRow[] = [];
  let loadError: string | null = null;

  try {
    rooms = await getStudyRooms();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "We couldn't load your study rooms.";
  }

  return <StudyRoomsDashboard authUser={user} initialRooms={rooms} loadError={loadError} />;
}
