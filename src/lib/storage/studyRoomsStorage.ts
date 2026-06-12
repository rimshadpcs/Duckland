import type { StudyRoom } from "@src/features/explanation";

const STUDY_ROOMS_KEY = "feynduck-study-rooms";

function warnStorage(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[studyRoomsStorage] ${message}`, error);
  }
}

function isStudyRoom(value: unknown): value is StudyRoom {
  if (!value || typeof value !== "object") return false;

  const room = value as Partial<StudyRoom>;

  return (
    typeof room.id === "string" &&
    typeof room.title === "string" &&
    typeof room.subject === "string" &&
    typeof room.notes === "string" &&
    typeof room.createdAt === "number"
  );
}

export function getStudyRooms(): StudyRoom[] {
  try {
    const raw = window.localStorage.getItem(STUDY_ROOMS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      warnStorage("Expected an array of study rooms.");
      return [];
    }

    return parsed.filter(isStudyRoom);
  } catch (error) {
    warnStorage("Could not parse study rooms from localStorage.", error);
    return [];
  }
}

export function saveStudyRooms(rooms: StudyRoom[]) {
  window.localStorage.setItem(STUDY_ROOMS_KEY, JSON.stringify(rooms));
}

export function getStudyRoomById(id: string) {
  return getStudyRooms().find((room) => room.id === id) ?? null;
}

export function upsertStudyRoom(room: StudyRoom) {
  const rooms = getStudyRooms();
  const existingIndex = rooms.findIndex((current) => current.id === room.id);

  if (existingIndex === -1) {
    saveStudyRooms([room, ...rooms]);
    return;
  }

  const updatedRooms = [...rooms];
  updatedRooms[existingIndex] = room;
  saveStudyRooms(updatedRooms);
}

export function updateStudyRoom(id: string, updates: Partial<StudyRoom>) {
  const rooms = getStudyRooms();
  const updatedRooms = rooms.map((room) =>
    room.id === id ? { ...room, ...updates } : room,
  );

  saveStudyRooms(updatedRooms);
  return updatedRooms.find((room) => room.id === id) ?? null;
}
