import { DEFAULT_ROOM, ROOM_A, ROOM_C, isRoomMarker, normalizeLabel, toRoomLabel } from "../../shared/rooms";

describe("shared/rooms", () => {
  it("normalizes room labels and aliases", () => {
    expect(normalizeLabel("  room   c: ")).toBe("ROOM C:");
    expect(isRoomMarker("c")).toBe(true);
    expect(isRoomMarker("Room A:")).toBe(true);
    expect(toRoomLabel("c")).toBe(ROOM_C);
    expect(toRoomLabel("Room A:")).toBe(ROOM_A);
  });

  it("falls back to trimmed input for unknown rooms", () => {
    expect(toRoomLabel("Custom Room")).toBe("Custom Room");
    expect(toRoomLabel("")).toBe("");
    expect(DEFAULT_ROOM).toBe(ROOM_A);
  });
});
