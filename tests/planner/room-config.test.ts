import { ROOM_A, ROOM_B, ROOM_C, ROOM_D } from "../../shared/rooms";
import { ROOM_ENABLE_DEFAULTS, ROOM_FOCUS_CONFIGS, getEnabledRooms } from "../../src/planner/room-config";

describe("src/planner/room-config", () => {
  it("exposes room defaults and focus configs", () => {
    expect(ROOM_ENABLE_DEFAULTS).toEqual({
      roomBEnabled: true,
      roomCEnabled: false,
      roomDEnabled: false,
    });
    expect(ROOM_FOCUS_CONFIGS.map((config) => config.room)).toEqual([ROOM_A, ROOM_B, ROOM_C, ROOM_D]);
  });

  it("builds the enabled room set", () => {
    const enabled = getEnabledRooms({
      roomBEnabled: true,
      roomCEnabled: false,
      roomDEnabled: true,
    });

    expect(enabled.has(ROOM_A)).toBe(true);
    expect(enabled.has(ROOM_B)).toBe(true);
    expect(enabled.has(ROOM_C)).toBe(false);
    expect(enabled.has(ROOM_D)).toBe(true);
  });
});
