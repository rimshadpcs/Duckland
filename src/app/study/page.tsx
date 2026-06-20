import { StudyRoomsDashboard } from "@src/features/explanation";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@src/lib/auth";
import { getStudyRooms, type StudyRoomWithSourceCount } from "@src/lib/repositories/study-rooms";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getAuthenticatedUser();
  let rooms: StudyRoomWithSourceCount[] = [];
  let loadError: string | null = null;

  if (!user) {
    redirect("/login?next=%2Fstudy");
  }

  if (!user.profile?.onboarding_completed) {
    redirect("/onboarding?next=%2Fstudy");
  }

  try {
    rooms = await getStudyRooms();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "We couldn't load your study rooms.";
  }

  return <StudyRoomsDashboard authUser={user} initialRooms={rooms} loadError={loadError} />;
}
