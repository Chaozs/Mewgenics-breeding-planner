import type { PlannerConfig, Room } from "../types";
import { ROOM_A, ROOM_B, ROOM_C, ROOM_D } from "../../shared/rooms";

export const ROOM_ENABLE_DEFAULTS = {
  roomBEnabled: true,
  roomCEnabled: false,
  roomDEnabled: false,
} as const;

export const ROOM_FOCUS_CONFIGS = [
  {
    room: ROOM_A,
    focusKey: "roomAFocus" as const,
    enabledKey: null,
    label: "Room A focus",
    rows: 4,
    help: "Describe what Room A should optimize for in recommendations.",
  },
  {
    room: ROOM_B,
    focusKey: "roomBFocus" as const,
    enabledKey: "roomBEnabled" as const,
    label: "Room B focus",
    rows: 4,
    help: "Describe what Room B should optimize for in recommendations.",
  },
  {
    room: ROOM_C,
    focusKey: "roomCFocus" as const,
    enabledKey: "roomCEnabled" as const,
    label: "Room C focus",
    rows: 4,
    help: "Describe what Room C should optimize for in recommendations.",
  },
  {
    room: ROOM_D,
    focusKey: "roomDFocus" as const,
    enabledKey: "roomDEnabled" as const,
    label: "Room D focus",
    rows: 4,
    help: "Describe what Room D should optimize for in recommendations.",
  },
] as const;

export function getEnabledRooms(plannerConfig: Pick<PlannerConfig, "roomBEnabled" | "roomCEnabled" | "roomDEnabled">) {
  const enabled = new Set<Room>([ROOM_A]);
  if (plannerConfig.roomBEnabled) {
    enabled.add(ROOM_B);
  }
  if (plannerConfig.roomCEnabled) {
    enabled.add(ROOM_C);
  }
  if (plannerConfig.roomDEnabled) {
    enabled.add(ROOM_D);
  }
  return enabled;
}
