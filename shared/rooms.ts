export const ROOM_A = "Room A";
export const ROOM_B = "Room B";
export const ROOM_C = "Room C";
export const ROOM_D = "Room D";
export const DEFAULT_ROOM = ROOM_A;
export const ROOM_ORDER = [ROOM_A, ROOM_B, ROOM_C, ROOM_D] as const;

export const ROOM_ALIASES = new Map<string, string>([
  ["A", ROOM_A],
  ["B", ROOM_B],
  ["C", ROOM_C],
  ["D", ROOM_D],
  ["ROOM A", ROOM_A],
  ["ROOM B", ROOM_B],
  ["ROOM C", ROOM_C],
  ["ROOM D", ROOM_D],
  ["A:", ROOM_A],
  ["B:", ROOM_B],
  ["C:", ROOM_C],
  ["D:", ROOM_D],
  ["ROOM A:", ROOM_A],
  ["ROOM B:", ROOM_B],
  ["ROOM C:", ROOM_C],
  ["ROOM D:", ROOM_D],
]);

export function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isRoomMarker(line: string) {
  return ROOM_ALIASES.has(normalizeLabel(line));
}

export function toRoomLabel(line: string) {
  const normalized = normalizeLabel(line);
  return ROOM_ALIASES.get(normalized) ?? line.trim() ?? DEFAULT_ROOM;
}
