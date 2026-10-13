"use client";

import { ExplainForm } from "./ExplainForm";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { RoomConceptRow } from "@src/lib/repositories/study-path";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { Json } from "@src/types/database";

export function StudyDemoPage({
  authUser,
  initialRoom,
  initialSources = [],
  initialSessionState,
  initialConcept,
  initialRoomConcepts = [],
  requestedRoomId,
  initialRecallMode = false,
}: {
  authUser?: AuthenticatedUser;
  initialRoom?: StudyRoomRow | null;
  initialSources?: SourceRow[];
  initialSessionState?: Json | null;
  initialConcept?: RoomConceptRow | null;
  initialRoomConcepts?: RoomConceptRow[];
  requestedRoomId?: string | null;
  initialRecallMode?: boolean;
}) {
  return (
    <ExplainForm
      authUser={authUser}
      initialRoom={initialRoom}
      initialSources={initialSources}
      initialSessionState={initialSessionState}
      initialConcept={initialConcept}
      initialRoomConcepts={initialRoomConcepts}
      requestedRoomId={requestedRoomId}
      initialRecallMode={initialRecallMode}
    />
  );
}
