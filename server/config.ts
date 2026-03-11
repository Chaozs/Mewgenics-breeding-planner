import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(CURRENT_DIR, "..");
export const APP_CONFIG_PATH = path.resolve(ROOT_DIR, "config", "app-config.json");
export const STATIC_DIR = path.resolve(ROOT_DIR, "static");
export const REACT_BUILD_DIR = path.resolve(STATIC_DIR, "react-planner");
export const REACT_BUILD_INDEX = path.resolve(REACT_BUILD_DIR, "index.html");
export const CATS_CSV_PATH = path.resolve(ROOT_DIR, "cats.csv");

function loadAppPort() {
  try {
    const raw = fs.readFileSync(APP_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { port?: unknown };
    const port = Number(parsed.port);
    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  } catch {
    // Fall back to the built-in default if the config file is missing or invalid.
  }

  return 38147;
}

export const APP_PORT = loadAppPort();

export const PLANNER_PROMPT_TEMPLATE = fs.readFileSync(path.resolve(ROOT_DIR, "server", "prompts", "planner.txt"), "utf-8");
export const SCREENSHOT_PROMPT = fs.readFileSync(path.resolve(ROOT_DIR, "server", "prompts", "screenshot-parser.txt"), "utf-8");

export const DEFAULT_PRIORITY_ORDER = `body: any
head: +1health -> fearOnContact -> any
tail: backflip -> moreMovePerTurn
leg: tileImmunity -> +1dex -> any
arm: randomDebuff -> jumpMove -> any
eye: confusion -> +2move-1luck -> reflect -> any
eyebrow: +1range -> any
ear: burn -> any
mouth: bonusAttackChance -> leech -> bleed -> any
fur: +1int -> +2move-1luck -> any`;

export const DEFAULT_ROOM_A_FOCUS =
  "Inject rare/priority mutations into 7/7 cats, resulting in a 7/7 cat with high mutation density (few empty body-part slots) and prioritized mutations.";
export const DEFAULT_ROOM_B_FOCUS =
  "Incubator to preserve rare mutations and push those mutations onto cats with as close to 7/7 as possible, then inject into Room A.";
export const DEFAULT_ROOM_C_FOCUS =
  "Secondary incubator/preservation pool to hold niche mutation carriers, bridges, or backups that should not crowd final-injection lines.";
export const DEFAULT_ROOM_D_FOCUS =
  "Overflow or experimental room for low-priority projects, cleanup candidates, and temporary tests before promoting cats into higher-priority rooms.";
export const DEFAULT_ADDITIONAL_PROMPT_INSTRUCTIONS = "";
export const DEFAULT_SKILL_MAPPINGS = `10% chance to reflect projectiles => reflect
Your basic attack inflicts Leech => leech`;

export const ANALYSIS_DEFAULTS = {
  priorityOrder: DEFAULT_PRIORITY_ORDER,
  roomAFocus: DEFAULT_ROOM_A_FOCUS,
  roomBFocus: DEFAULT_ROOM_B_FOCUS,
  roomCFocus: DEFAULT_ROOM_C_FOCUS,
  roomDFocus: DEFAULT_ROOM_D_FOCUS,
  additionalPromptInstructions: DEFAULT_ADDITIONAL_PROMPT_INSTRUCTIONS,
  skillMappings: DEFAULT_SKILL_MAPPINGS,
} as const;

export const ANALYSIS_FIELD_ERRORS = {
  priorityOrder: "Priority order must be text.",
  roomAFocus: "Room A focus must be text.",
  roomBFocus: "Room B focus must be text.",
  roomCFocus: "Room C focus must be text.",
  roomDFocus: "Room D focus must be text.",
  additionalPromptInstructions: "Additional prompt instructions must be text.",
  skillMappings: "Skill mappings must be text.",
} as const;
