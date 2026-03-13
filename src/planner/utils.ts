import {
  ALLOWED_BREED_WITH,
  ALLOWED_GENDERS,
  ALLOWED_STAT_VALUES,
  EXPECTED_COLUMNS,
  MUTATION_COLUMN_BODY_PARTS,
  getDefaultBreedWithForGender,
  getExpectedBodyPartForColumn,
  isHeaderRow,
  normalizeBreedWithForGender,
  normalizeEntryColumns,
  normalizeMutationValue,
  normalizeStatValueForLogic,
  normalizeStoredStatValue,
  parseSkillMappings,
  parseSkillMappingsTextToRows,
  serializeSkillMappings,
  validateAndNormalizeCatsData,
  validateMutationValue,
} from "../../shared/planner-core";
import {
  DEFAULT_ROOM,
  ROOM_A,
  ROOM_B,
  ROOM_C,
  ROOM_D,
  ROOM_ORDER,
  isRoomMarker,
  normalizeLabel,
  toRoomLabel,
} from "../../shared/rooms";
import { COLUMN_KEYS, COLUMN_LABELS, getDefaultValueForColumn, isStatColumn, normalizeColumnInputValue } from "./schema";
import type { Entry, ManualDraft, PlannerConfig, RecommendationAction, Room, SkillMappingRow, StructuredAnalysis } from "../types";

export {
  ALLOWED_BREED_WITH,
  ALLOWED_GENDERS,
  ALLOWED_STAT_VALUES,
  DEFAULT_ROOM,
  EXPECTED_COLUMNS,
  MUTATION_COLUMN_BODY_PARTS,
  ROOM_A,
  ROOM_B,
  ROOM_C,
  ROOM_D,
  ROOM_ORDER,
  getDefaultBreedWithForGender,
  getExpectedBodyPartForColumn,
  isHeaderRow,
  isRoomMarker,
  normalizeBreedWithForGender,
  normalizeLabel,
  normalizeEntryColumns,
  normalizeMutationValue,
  normalizeStatValueForLogic,
  normalizeStoredStatValue,
  parseSkillMappings,
  parseSkillMappingsTextToRows,
  serializeSkillMappings,
  toRoomLabel,
  validateAndNormalizeCatsData,
  validateMutationValue,
};

export const ROOM_SHORT_LABEL = new Map<Room, string>([
  [ROOM_A, "A"],
  [ROOM_B, "B"],
  [ROOM_C, "C"],
  [ROOM_D, "D"],
]);

export const CATS_STORAGE_KEY = "mewgenics.cats_data_rows";
export const CATS_ID_STORAGE_KEY = "mewgenics.cats_data_ids";
export const MANUAL_CAT_DRAFT_KEY = "mewgenics.manual_cat_draft";
export const PLANNER_CONFIG_STORAGE_KEY = "mewgenics.planner_config";

export const SECTION_KEYS = {
  summary: "SUMMARY",
  trimStrong: "TRIM (STRONG)",
  trimMaybe: "TRIM (MAYBE)",
  move: "MOVE",
  actionRequest: "ACTION REQUEST (OPTIONAL)",
};

export const PRIORITY_ORDER_PARTS = [
  "body",
  "head",
  "tail",
  "leg",
  "arm",
  "eye",
  "eyebrow",
  "ear",
  "mouth",
  "fur",
] as const;

export const PRIORITY_ORDER_LABELS: Record<(typeof PRIORITY_ORDER_PARTS)[number], string> = {
  body: "Body",
  head: "Head",
  tail: "Tail",
  leg: "Leg",
  arm: "Arm",
  eye: "Eye",
  eyebrow: "Eyebrow",
  ear: "Ear",
  mouth: "Mouth",
  fur: "Fur",
};

export const NO_DATA_STEPS = [
  "Expand Import Excel Data, paste spreadsheet rows, then click Save to Browser Data.",
  "Or use Add Cat in Current Cat Rows.",
  "Current Cat Rows will render from browser data as an editable table.",
  "Use row actions to reorder, move between rooms, or delete cats.",
  "Optionally edit Recommendation Customization (mutation priority + Room A/B/C/D focus).",
  "Click Analyze Cats to generate recommendations.",
];

export function createEntryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeRoomLabel(value: string) {
  return toRoomLabel(value);
}

function buildAnalysisCatName(entry: Entry) {
  const catName = entry.columns[0]?.trim() || "Unnamed Cat";
  return `${catName} [id:${entry.id}]`;
}

export function serializeEntries(
  entries: Entry[],
  options: { includeAnalysisIds?: boolean } = {},
) {
  if (!entries.length) {
    return "";
  }

  const grouped = groupEntriesByRoom(entries, (entry) => entry);
  const orderedRooms = getOrderedRooms(grouped);
  const lines: string[] = [];

  orderedRooms.forEach((room) => {
    const roomRows = grouped.get(room);
    if (!roomRows?.length) {
      return;
    }
    lines.push(room);
    roomRows.forEach((entry) => {
      const columns = [...entry.columns];
      if (options.includeAnalysisIds) {
        columns[0] = buildAnalysisCatName(entry);
      }
      lines.push(columns.join("\t"));
    });
  });

  return lines.join("\n");
}

export function serializeEntriesForSpreadsheet(entries: Entry[]) {
  if (!entries.length) {
    return "";
  }

  const grouped = groupEntriesByRoom(entries, (entry) => entry);
  const orderedRooms = getOrderedRooms(grouped);
  const lines: string[] = [];

  orderedRooms.forEach((room) => {
    const roomRows = grouped.get(room);
    if (!roomRows?.length) {
      return;
    }

    lines.push(room);
    roomRows.forEach((entry) => {
      const columns = entry.columns.map((value, columnIndex) => {
        const normalized = value.trim();
        if (!normalized && (columnIndex === 2 || columnIndex >= 10)) {
          return "X";
        }
        return normalized;
      });
      lines.push(columns.join("\t"));
    });
  });

  return lines.join("\n");
}

export function extractRecommendationAction(sectionTitle: string, line: string): { text: string; action?: RecommendationAction } {
  const idMatch = line.match(/\[id:([^\]]+)\]/i);
  const entryId = idMatch?.[1]?.trim();
  const withoutId = stripRecommendationIds(line);
  const withoutCurrentRoom = withoutId.replace(/^(Room\s+[A-D]|[A-D])\s*\|\s*/i, "").trim();

  if (!entryId) {
    return { text: withoutCurrentRoom };
  }

  const isTrimSection = sectionTitle === "Recommended Trims" || sectionTitle === "Potential Trims";
  if (isTrimSection) {
    return {
      text: withoutCurrentRoom,
      action: { kind: "delete", entryId },
    };
  }

  if (sectionTitle === "Move") {
    const moveMatch = withoutCurrentRoom.match(/^(.*?)\s*->\s*(Room [A-D]|[ABCD])\s*(?::|(?:-|\u2013|\u2014))\s+(.+)$/i);
    if (moveMatch) {
      const catName = moveMatch[1].trim();
      const targetRoom = normalizeRoomLabel(moveMatch[2]);
      const reason = moveMatch[3].trim();
      return {
        text: `${catName} -> ${targetRoom}: ${reason}`,
        action: { kind: "move", entryId, targetRoom },
      };
    }
  }

  return { text: withoutId };
}

export function parseStoredEntries(rawText: string, skillMappings: Map<string, string>, storedIds: string[] = []) {
  const rows: Entry[] = [];
  const invalidLines: string[] = [];
  let currentRoom: Room = DEFAULT_ROOM;
  let rowIndex = 0;

  rawText.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (isRoomMarker(line)) {
      currentRoom = toRoomLabel(line);
      return;
    }

    const columns = rawLine.split("\t").map((value) => value.trim());
    if (isHeaderRow(columns)) {
      return;
    }

    if (columns.length !== EXPECTED_COLUMNS) {
      invalidLines.push(`Line ${index + 1}: not rendered (invalid column count).`);
      return;
    }

    rows.push({
      id: storedIds[rowIndex] || createEntryId(),
      room: currentRoom,
      columns: normalizeEntryColumns(columns, skillMappings),
    });
    rowIndex += 1;
  });

  return { rows, invalidLines };
}

export function groupEntriesByRoom<T>(entries: Entry[], mapEntry: (entry: Entry, index: number) => T) {
  const grouped = new Map<Room, T[]>();
  entries.forEach((entry, index) => {
    if (!grouped.has(entry.room)) {
      grouped.set(entry.room, []);
    }
    grouped.get(entry.room)?.push(mapEntry(entry, index));
  });
  return grouped;
}

export function getOrderedRooms(groupedEntries: Map<Room, unknown[]>) {
  const rooms = Array.from(groupedEntries.keys());
  return [...ROOM_ORDER, ...rooms.filter((room) => !ROOM_ORDER.includes(room as typeof ROOM_ORDER[number]))];
}

export function filterCatsDataByEnabledRooms(rawText: string, enabledRooms: Set<string>) {
  const lines: string[] = [];
  let currentRoom: Room = DEFAULT_ROOM;

  rawText.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (isRoomMarker(line)) {
      currentRoom = toRoomLabel(line);
      if (enabledRooms.has(currentRoom)) {
        lines.push(currentRoom);
      }
      return;
    }

    if (enabledRooms.has(currentRoom)) {
      lines.push(rawLine);
    }
  });

  return lines.join("\n");
}

export function createEmptyEntry(room: Room) {
  return {
    id: createEntryId(),
    room,
    columns: COLUMN_KEYS.map((_, index) => getDefaultValueForColumn(index)),
  };
}

export function createManualFormValues(entry?: Entry) {
  const columns = entry?.columns ?? COLUMN_KEYS.map((_, index) => getDefaultValueForColumn(index));
  const values = COLUMN_KEYS.reduce<Record<string, string>>((accumulator, key, index) => {
    accumulator[key] = columns[index] ?? getDefaultValueForColumn(index);
    return accumulator;
  }, {});
  values.room = String(entry?.room ?? DEFAULT_ROOM);
  return values;
}

export function getManualCatEntryFromValues(
  values: Record<string, string>,
  skillMappings: Map<string, string>,
  existingEntryId?: string,
) {
  const room = toRoomLabel(String(values.room ?? DEFAULT_ROOM));
  const columns = COLUMN_KEYS.map((key, index) => {
    const raw = String(values[key] ?? "").trim();
    return raw || getDefaultValueForColumn(index);
  });

  const gender = columns[1].toUpperCase();
  if (!ALLOWED_GENDERS.has(gender)) {
    return { error: "Gender must be M, F, or ?." };
  }

  const breedWith = columns[2].toUpperCase();
  if (!ALLOWED_BREED_WITH.has(breedWith)) {
    return { error: "BreedWith must be blank, Any, ?, M, or F." };
  }

  if (columns.slice(3, 10).some((value) => !ALLOWED_STAT_VALUES.has(value))) {
    return { error: "Str through Luck must each be 1-7 (legacy 0/1 also accepted)." };
  }

  for (let columnIndex = 10; columnIndex < columns.length; columnIndex += 1) {
    const mutationError = validateMutationValue(columns[columnIndex], columnIndex);
    if (mutationError) {
      return { error: `${COLUMN_LABELS[columnIndex]}: ${mutationError}` };
    }
  }

  if (!columns[0]) {
    return { error: "Cat name is required." };
  }

  return {
    entry: {
      id: existingEntryId || createEntryId(),
      room,
      columns: normalizeEntryColumns(columns, skillMappings),
    } as Entry,
  };
}

export function parseModelRowToEntry(rawRow: string, skillMappings: Map<string, string>) {
  const lines = String(rawRow ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  let detectedRoom: Room = DEFAULT_ROOM;
  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (isRoomMarker(trimmedLine)) {
      detectedRoom = toRoomLabel(trimmedLine);
      continue;
    }

    const columns = rawLine.split("\t").map((value) => value.trim());
    if (isHeaderRow(columns)) {
      continue;
    }

    if (columns.length === EXPECTED_COLUMNS + 1 && isRoomMarker(columns[0])) {
      detectedRoom = toRoomLabel(columns[0]);
      columns.shift();
    }

    while (columns.length < EXPECTED_COLUMNS) {
      columns.push("");
    }

    if (columns.length !== EXPECTED_COLUMNS) {
      continue;
    }

    return {
      id: createEntryId(),
      room: detectedRoom,
      columns: realignParsedMutationColumns(normalizeEntryColumns(columns, skillMappings)),
    };
  }

  throw new Error(`Parse output was not a valid ${EXPECTED_COLUMNS}-column row.`);
}

function realignParsedMutationColumns(columns: string[]) {
  const nextColumns = [...columns];
  const repairedMutationColumns = Array.from({ length: EXPECTED_COLUMNS - 10 }, () => "");

  const placeMutationValue = (targetIndex: number, value: string) => {
    const localIndex = targetIndex - 10;
    if (localIndex < 0 || localIndex >= repairedMutationColumns.length) {
      return false;
    }
    if (repairedMutationColumns[localIndex]) {
      return false;
    }
    repairedMutationColumns[localIndex] = value;
    return true;
  };

  for (let columnIndex = 10; columnIndex < EXPECTED_COLUMNS; columnIndex += 1) {
    const value = nextColumns[columnIndex] ?? "";
    if (!value) {
      continue;
    }

    const bodyPartMatch = value.match(/^.+?\(([^()]+)\)$/);
    const actualBodyPart = bodyPartMatch?.[1]?.trim().toLowerCase();
    const candidateIndexes = actualBodyPart
      ? [...MUTATION_COLUMN_BODY_PARTS.entries()]
        .filter(([, bodyPart]) => bodyPart === actualBodyPart)
        .map(([index]) => index)
      : [];

    let placed = false;
    for (const candidateIndex of candidateIndexes) {
      if (placeMutationValue(candidateIndex, value)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      // GPT sometimes skips blank duplicate-body-part columns in the middle of the row.
      // Fall back to the original slot for anything we cannot confidently re-home.
      placeMutationValue(columnIndex, value);
    }
  }

  for (let columnIndex = 10; columnIndex < EXPECTED_COLUMNS; columnIndex += 1) {
    nextColumns[columnIndex] = repairedMutationColumns[columnIndex - 10];
  }

  return nextColumns;
}

export function parseStructuredAnalysis(text: string): StructuredAnalysis {
  const parsed: StructuredAnalysis = {
    summary: [],
    trimStrong: [],
    trimMaybe: [],
    move: [],
    actionRequest: [],
    other: [],
  };

  let currentSection: keyof StructuredAnalysis | null = null;
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const normalizedLine = line.replace(/:$/, "").toUpperCase();
    if (normalizedLine === SECTION_KEYS.summary) {
      currentSection = "summary";
      return;
    }
    if (normalizedLine === SECTION_KEYS.trimStrong) {
      currentSection = "trimStrong";
      return;
    }
    if (normalizedLine === SECTION_KEYS.trimMaybe) {
      currentSection = "trimMaybe";
      return;
    }
    if (normalizedLine === SECTION_KEYS.move) {
      currentSection = "move";
      return;
    }
    if (normalizedLine === SECTION_KEYS.actionRequest || normalizedLine === "ACTION REQUEST") {
      currentSection = "actionRequest";
      return;
    }

    const cleanedLine = line.replace(/^[*-]\s*/, "");
    if (currentSection) {
      parsed[currentSection].push(cleanedLine);
    } else {
      parsed.other.push(cleanedLine);
    }
  });

  return parsed;
}

export function isActionRequestLine(line: string) {
  const normalized = line.trim().toLowerCase();
  return normalized.includes("?")
    || normalized.startsWith("if you want")
    || normalized.startsWith("if you'd like")
    || normalized.startsWith("would you like")
    || normalized.startsWith("want me to")
    || normalized.startsWith("let me know")
    || normalized.startsWith("reply with")
    || normalized.includes("i can also");
}

export function sanitizeLiveOutputText(text: string) {
  return stripRecommendationIds(String(text ?? "").replace(/[*_]/g, ""));
}

export function stripRecommendationIds(text: string) {
  return String(text ?? "").replace(/\s*\[id:[^\]]+\]/gi, "").trim();
}

export function parsePriorityOrderText(rawText: string) {
  const priorities = PRIORITY_ORDER_PARTS.reduce<Record<string, string>>((accumulator, part) => {
    accumulator[part] = "";
    return accumulator;
  }, {});
  const extraLines: string[] = [];

  String(rawText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
      if (!match) {
        extraLines.push(line);
        return;
      }

      const bodyPart = match[1].trim().toLowerCase();
      const value = match[2].trim();
      if ((PRIORITY_ORDER_PARTS as readonly string[]).includes(bodyPart)) {
        priorities[bodyPart] = value;
      } else {
        extraLines.push(line);
      }
    });

  return { priorities, extraLines };
}

export function buildPriorityMutationLookup(rawText: string) {
  const lookup = new Map<string, Set<string>>();
  const parsed = parsePriorityOrderText(rawText);

  PRIORITY_ORDER_PARTS.forEach((bodyPart) => {
    const rawValue = parsed.priorities[bodyPart] || "";
    const tokens = rawValue
      .split(/\s*->\s*/)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token && token !== "any");

    lookup.set(bodyPart, new Set(tokens));
  });

  return lookup;
}

export function getMutationTraitName(value: string) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^(.+?)\(([^()]+)\)$/);
  return match ? match[1].trim().toLowerCase() : "";
}

export function serializePriorityOrderText(priorities: Record<string, string>, extraLines: string[] = []) {
  const lines = PRIORITY_ORDER_PARTS.map((part) => `${part}: ${(priorities[part] || "").trim() || "any"}`);
  return [...lines, ...extraLines.filter((line) => line.trim())].join("\n");
}

export function moveEntryToRoom(entries: Entry[], index: number, targetRoom: Room) {
  const nextEntries = entries.map((entry) => ({ ...entry, columns: [...entry.columns] }));
  const source = nextEntries[index];
  if (!source || source.room === targetRoom) {
    return entries;
  }

  const [entry] = nextEntries.splice(index, 1);
  entry.room = targetRoom;
  return insertEntryAtTopOfRoom(nextEntries, entry);
}

export function insertEntryAtTopOfRoom(entries: Entry[], nextEntry: Entry) {
  const nextEntries = entries.map((entry) => ({ ...entry, columns: [...entry.columns] }));
  const firstRoomIndex = nextEntries.findIndex((entry) => entry.room === nextEntry.room);

  if (firstRoomIndex >= 0) {
    nextEntries.splice(firstRoomIndex, 0, nextEntry);
    return nextEntries;
  }

  const roomOrderIndex = ROOM_ORDER.indexOf(nextEntry.room as (typeof ROOM_ORDER)[number]);
  if (roomOrderIndex < 0) {
    return [...nextEntries, nextEntry];
  }

  const insertIndex = nextEntries.findIndex((entry) => {
    const existingRoomOrderIndex = ROOM_ORDER.indexOf(entry.room as (typeof ROOM_ORDER)[number]);
    return existingRoomOrderIndex > roomOrderIndex;
  });

  if (insertIndex < 0) {
    return [...nextEntries, nextEntry];
  }

  nextEntries.splice(insertIndex, 0, nextEntry);
  return nextEntries;
}

export function replaceEntry(entries: Entry[], nextEntry: Entry) {
  const sourceIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (sourceIndex < 0) {
    return entries;
  }

  const currentEntry = entries[sourceIndex];
  const nextEntries = entries.map((entry, index) => (
    index === sourceIndex
      ? { ...nextEntry, columns: [...nextEntry.columns] }
      : { ...entry, columns: [...entry.columns] }
  ));

  if (currentEntry.room === nextEntry.room) {
    nextEntries[sourceIndex] = { ...nextEntry, columns: [...nextEntry.columns] };
    return nextEntries;
  }

  nextEntries.splice(sourceIndex, 1);
  return insertEntryAtTopOfRoom(nextEntries, { ...nextEntry, columns: [...nextEntry.columns] });
}

export function moveEntryByDrop(entries: Entry[], sourceIndex: number, target: { type: "row" | "room"; rowIndex?: number; room: Room; placeAfter: boolean }) {
  const nextEntries = entries.map((entry) => ({ ...entry, columns: [...entry.columns] }));
  const sourceEntry = nextEntries[sourceIndex];
  if (!sourceEntry) {
    return entries;
  }

  if (target.type === "row" && target.rowIndex === sourceIndex && target.room === sourceEntry.room) {
    return entries;
  }

  const [entry] = nextEntries.splice(sourceIndex, 1);
  entry.room = target.room;

  let insertIndex: number;
  if (target.type === "row" && Number.isInteger(target.rowIndex)) {
    const adjustedTargetIndex = (target.rowIndex as number) > sourceIndex ? (target.rowIndex as number) - 1 : (target.rowIndex as number);
    insertIndex = target.placeAfter ? adjustedTargetIndex + 1 : adjustedTargetIndex;
    insertIndex = Math.max(0, Math.min(insertIndex, nextEntries.length));
  } else {
    insertIndex = nextEntries.length;
    for (let i = nextEntries.length - 1; i >= 0; i -= 1) {
      if (nextEntries[i].room === target.room) {
        insertIndex = i + 1;
        break;
      }
    }
  }

  nextEntries.splice(insertIndex, 0, entry);
  return nextEntries;
}

export function getCellDisplayClasses(columnIndex: number, value: string) {
  const normalizedValue = String(value ?? "").trim();
  const normalizedUpper = normalizedValue.toUpperCase();
  const classes: string[] = [];
  const mutationError = columnIndex >= 10 && columnIndex <= 24 ? validateMutationValue(normalizedValue, columnIndex) : "";

  if (isStatColumn(columnIndex)) {
    classes.push("stat-cell");
    classes.push(normalizedValue === "7" ? "stat-good" : "stat-bad");
    return { classes, mutationError };
  }

  if (columnIndex === 1 || columnIndex === 2) {
    if (normalizedUpper === "M") {
      classes.push("value-male");
    } else if (normalizedUpper === "F") {
      classes.push("value-female");
    } else if (normalizedUpper === "?") {
      classes.push("value-unknown");
    }
    return { classes, mutationError };
  }

  if (columnIndex >= 10 && columnIndex <= 24) {
    classes.push(normalizedUpper && normalizedUpper !== "X" ? "trait-filled" : "trait-empty");
    if (mutationError) {
      classes.push("cell-invalid");
    }
  }

  return { classes, mutationError };
}

export function getStoredCatsText() {
  try {
    return localStorage.getItem(CATS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getStoredCatIds() {
  try {
    const raw = localStorage.getItem(CATS_ID_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function setStoredCatIds(ids: string[]) {
  try {
    localStorage.setItem(CATS_ID_STORAGE_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

export function setStoredCatsText(text: string) {
  try {
    localStorage.setItem(CATS_STORAGE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function getStoredPlannerConfig() {
  try {
    const raw = localStorage.getItem(PLANNER_CONFIG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PlannerConfig>) : {};
  } catch {
    return {};
  }
}

export function setStoredPlannerConfig(config: Partial<PlannerConfig>) {
  try {
    localStorage.setItem(PLANNER_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore localStorage failures.
  }
}

export function getManualCatDraft() {
  try {
    const raw = localStorage.getItem(MANUAL_CAT_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ManualDraft) : null;
  } catch {
    return null;
  }
}

export function setManualCatDraft(draft: ManualDraft) {
  try {
    localStorage.setItem(MANUAL_CAT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore localStorage failures.
  }
}

export function clearManualCatDraft() {
  try {
    localStorage.removeItem(MANUAL_CAT_DRAFT_KEY);
  } catch {
    // Ignore localStorage failures.
  }
}

export function buildPlannerConfigFromStored(raw: Partial<PlannerConfig>, defaults: PlannerConfig): PlannerConfig {
  const hasUsableSkillMappings = Array.isArray(raw.skillMappings)
    && raw.skillMappings.some((row) => row.source.trim() || row.target.trim());

  return {
    priorityOrder: raw.priorityOrder || defaults.priorityOrder,
    roomAFocus: raw.roomAFocus || defaults.roomAFocus,
    roomBFocus: raw.roomBFocus || defaults.roomBFocus,
    roomCFocus: raw.roomCFocus || defaults.roomCFocus,
    roomDFocus: raw.roomDFocus || defaults.roomDFocus,
    additionalPromptInstructions: raw.additionalPromptInstructions || defaults.additionalPromptInstructions,
    roomBEnabled: typeof raw.roomBEnabled === "boolean" ? raw.roomBEnabled : defaults.roomBEnabled,
    roomCEnabled: typeof raw.roomCEnabled === "boolean" ? raw.roomCEnabled : defaults.roomCEnabled,
    roomDEnabled: typeof raw.roomDEnabled === "boolean" ? raw.roomDEnabled : defaults.roomDEnabled,
    // A single blank row is just UI scaffolding, not a real override of the defaults.
    skillMappings: hasUsableSkillMappings
      ? raw.skillMappings as SkillMappingRow[]
      : defaults.skillMappings,
  };
}

export function normalizeEntryColumnValue(columnIndex: number, value: string, currentColumns: string[], skillMappings: Map<string, string>) {
  const nextColumns = [...currentColumns];
  const previousGender = nextColumns[1];
  const previousBreedWith = nextColumns[2];

  nextColumns[columnIndex] = normalizeColumnInputValue(columnIndex, value);
  if (columnIndex === 1) {
    const previousDefaultBreedWith = getDefaultBreedWithForGender(previousGender);
    if (!previousBreedWith || previousBreedWith === previousDefaultBreedWith) {
      nextColumns[2] = getDefaultBreedWithForGender(nextColumns[1]);
    }
  }

  return normalizeEntryColumns(nextColumns, skillMappings);
}
