import { DEFAULT_ROOM, isRoomMarker, toRoomLabel } from "./rooms";

export type SkillMappingRowLike = {
  source: string;
  target: string;
};

export const EXPECTED_COLUMNS = 25;
export const ALLOWED_GENDERS = new Set(["M", "F", "?"]);
export const ALLOWED_BREED_WITH = new Set(["", "X", "M", "F", "?", "ANY"]);
export const ALLOWED_STAT_VALUES = new Set(["0", "1", "2", "3", "4", "5", "6", "7"]);
export const COLUMN_LABELS = [
  "Cat",
  "Gender",
  "BreedWith",
  "Str",
  "Dex",
  "Health",
  "Int",
  "Move",
  "Char",
  "Luck",
  "Body",
  "Head",
  "Tail",
  "Leg 1",
  "Leg 2",
  "Arm 1",
  "Arm 2",
  "Eye 1",
  "Eye 2",
  "Eyebrow 1",
  "Eyebrow 2",
  "Ear 1",
  "Ear 2",
  "Mouth",
  "Fur",
] as const;

export const MUTATION_COLUMN_BODY_PARTS = new Map<number, string>([
  [10, "body"],
  [11, "head"],
  [12, "tail"],
  [13, "leg"],
  [14, "leg"],
  [15, "arm"],
  [16, "arm"],
  [17, "eye"],
  [18, "eye"],
  [19, "eyebrow"],
  [20, "eyebrow"],
  [21, "ear"],
  [22, "ear"],
  [23, "mouth"],
  [24, "fur"],
]);

export function isHeaderRow(columns: string[]) {
  if (columns.length < 3) {
    return false;
  }

  const [first, second, third] = columns;
  return first.trim().toLowerCase() === "cat"
    && second.trim().toLowerCase() === "gender"
    && third.trim().toLowerCase().replace(/\s+/g, "") === "breedwith";
}

function unwrapMatchingQuotes(value: string) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length >= 2 && [`"`, `'`].includes(trimmed[0]) && trimmed[0] === trimmed[trimmed.length - 1]) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeSkillMappingKey(value: string) {
  return unwrapMatchingQuotes(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function statTokenToLegacyModifier(statName: string) {
  return String(statName ?? "").trim().toLowerCase();
}

export function parseSkillMappingsTextToRows(rawText = ""): SkillMappingRowLike[] {
  return String(rawText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.match(/^(.*?)\s*(?:=>|->|=)\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      source: unwrapMatchingQuotes(match[1]).trim(),
      target: unwrapMatchingQuotes(match[2]).trim(),
    }));
}

export function serializeSkillMappings(rows: SkillMappingRowLike[]) {
  return rows
    .filter((row) => row.source.trim() && row.target.trim())
    .map((row) => `${row.source.trim()} => ${row.target.trim()}`)
    .join("\n");
}

export function parseSkillMappings(rowsOrText: SkillMappingRowLike[] | string) {
  const rows = Array.isArray(rowsOrText) ? rowsOrText : parseSkillMappingsTextToRows(rowsOrText);
  const mappings = new Map<string, string>();
  rows.forEach((row) => {
    const source = normalizeSkillMappingKey(row.source);
    const target = unwrapMatchingQuotes(row.target).trim();
    if (source && target) {
      mappings.set(source, target);
    }
  });
  return mappings;
}

export function getDefaultBreedWithForGender(gender: string) {
  const normalizedGender = (gender ?? "").toUpperCase();
  if (normalizedGender === "M") {
    return "F";
  }
  if (normalizedGender === "F") {
    return "M";
  }
  return "ANY";
}

export function normalizeBreedWithForGender(breedWith: string, gender: string) {
  const normalizedBreedWith = (breedWith ?? "").toUpperCase();
  const normalizedGender = (gender ?? "").toUpperCase();
  if (normalizedBreedWith === "X") {
    return normalizeBreedWithForGender("", normalizedGender);
  }
  if (!normalizedBreedWith) {
    return getDefaultBreedWithForGender(normalizedGender);
  }
  if (normalizedBreedWith === "ANY") {
    return "ANY";
  }
  return normalizedBreedWith;
}

export function normalizeMutationValue(value: string, skillMappings: Map<string, string>) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "x") {
    return "";
  }

  const legacyFearMatch = trimmed.match(/^fear\(([^()]+)\)$/i);
  if (legacyFearMatch) {
    return `fearOnContact(${legacyFearMatch[1].trim().toLowerCase()})`;
  }

  const legacyPlusMatch = trimmed.match(/^plus([A-Z][A-Za-z0-9]*)\(([^()]+)\)$/);
  if (legacyPlusMatch) {
    return `+1${statTokenToLegacyModifier(legacyPlusMatch[1])}(${legacyPlusMatch[2].trim().toLowerCase()})`;
  }

  const legacyModifierMatch = trimmed.match(/^more([A-Z][A-Za-z0-9]*)Less([A-Z][A-Za-z0-9]*)\(([^()]+)\)$/);
  if (legacyModifierMatch) {
    return `+2${statTokenToLegacyModifier(legacyModifierMatch[1])}-1${statTokenToLegacyModifier(legacyModifierMatch[2])}(${legacyModifierMatch[3].trim().toLowerCase()})`;
  }

  const genericMutationMatch = trimmed.match(/^(.+?)\(([^()]+)\)$/);
  if (genericMutationMatch) {
    const traitText = genericMutationMatch[1].trim();
    const bodyPart = genericMutationMatch[2].trim().toLowerCase();
    const mapped = skillMappings.get(normalizeSkillMappingKey(traitText));
    return `${mapped ?? traitText}(${bodyPart})`;
  }

  return skillMappings.get(normalizeSkillMappingKey(trimmed)) ?? trimmed;
}

export function normalizeStoredStatValue(value: string) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "1") {
    return "7";
  }
  return ALLOWED_STAT_VALUES.has(trimmed) ? trimmed : "7";
}

export function normalizeStatValueForLogic(value: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "7" ? "1" : "0";
}

export function normalizeEntryColumns(columns: string[], skillMappings: Map<string, string>) {
  const nextColumns = [...columns];
  const gender = (nextColumns[1] ?? "?").toUpperCase();
  nextColumns[1] = ALLOWED_GENDERS.has(gender) ? gender : "?";
  nextColumns[2] = normalizeBreedWithForGender(nextColumns[2] ?? "", nextColumns[1] ?? "?");
  for (let columnIndex = 3; columnIndex <= 9; columnIndex += 1) {
    nextColumns[columnIndex] = normalizeStoredStatValue(nextColumns[columnIndex]);
  }
  for (let columnIndex = 10; columnIndex < nextColumns.length; columnIndex += 1) {
    nextColumns[columnIndex] = normalizeMutationValue(nextColumns[columnIndex] ?? "", skillMappings);
  }
  return nextColumns;
}

export function getExpectedBodyPartForColumn(index: number) {
  return MUTATION_COLUMN_BODY_PARTS.get(index) ?? "";
}

export function validateMutationValue(value: string, columnIndex: number) {
  const expectedBodyPart = getExpectedBodyPartForColumn(columnIndex);
  if (!expectedBodyPart) {
    return "";
  }

  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "x") {
    return "";
  }

  const match = trimmed.match(/^([A-Za-z0-9+\-]+)\(([^()]+)\)$/);
  if (!match) {
    return `"${trimmed}" is not in the expected format for this body part. Leave it blank, or use something like traitName(${expectedBodyPart}).`;
  }

  const actualBodyPart = match[2].trim().toLowerCase();
  if (actualBodyPart !== expectedBodyPart) {
    return `"${trimmed}" is assigned to the wrong body part. This column expects (${expectedBodyPart}).`;
  }

  return "";
}

function getFriendlyRowContext(room: string, rowInRoom: number, columns: string[]) {
  const catName = (columns[0] ?? "").trim();
  if (catName) {
    return `${catName}, row ${rowInRoom} in ${room}`;
  }
  return `Row ${rowInRoom} in ${room}`;
}

export function validateAndNormalizeCatsData(
  rawText: string,
  skillMappings: Map<string, string>,
  validateMutations = true,
  normalizeStatsForLogic = false,
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedLines: string[] = [];
  let validRows = 0;
  let currentRoom = DEFAULT_ROOM;
  let rowInCurrentRoom = 0;

  rawText.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (isRoomMarker(line)) {
      currentRoom = toRoomLabel(line);
      rowInCurrentRoom = 0;
      normalizedLines.push(currentRoom);
      return;
    }

    const columns = rawLine.split("\t").map((value) => value.trim());
    if (isHeaderRow(columns)) {
      return;
    }

    rowInCurrentRoom += 1;

    if (columns.length !== EXPECTED_COLUMNS) {
      const context = getFriendlyRowContext(currentRoom, rowInCurrentRoom, columns);
      if (columns.length === 1 && rawLine.includes(",") && !rawLine.includes("\t")) {
        errors.push(`${context}: this row looks comma-separated. Paste tab-separated spreadsheet columns instead.`);
      } else {
        errors.push(`${context}: expected ${EXPECTED_COLUMNS} spreadsheet columns, but found ${columns.length}.`);
      }
      return;
    }

    const context = getFriendlyRowContext(currentRoom, rowInCurrentRoom, columns);
    let rowHasError = false;
    if (!columns[0]) {
      errors.push(`${context}: the Cat column is empty.`);
      rowHasError = true;
    }

    const gender = columns[1].toUpperCase();
    if (!ALLOWED_GENDERS.has(gender)) {
      errors.push(`${context}: Gender must be M, F, or ?; received "${columns[1]}".`);
      rowHasError = true;
    }

    const breedWith = columns[2].toUpperCase();
    if (!ALLOWED_BREED_WITH.has(breedWith)) {
      errors.push(`${context}: BreedWith must be blank, Any, ?, M, or F; received "${columns[2]}".`);
      rowHasError = true;
    }

    columns.slice(3, 10).forEach((statValue, statIndex) => {
      if (!ALLOWED_STAT_VALUES.has(statValue)) {
        errors.push(`${context}: ${COLUMN_LABELS[statIndex + 3]} must be 1-7 (legacy 0/1 is also allowed); received "${statValue}".`);
        rowHasError = true;
      }
    });

    columns.slice(10).forEach((mutationValue, offset) => {
      const columnIndex = offset + 10;
      const mutationError = validateMutationValue(mutationValue, columnIndex);
      if (!mutationError) {
        return;
      }

      const message = `${context}: ${COLUMN_LABELS[columnIndex]} has an issue. ${mutationError}`;
      if (validateMutations) {
        errors.push(message);
        rowHasError = true;
      } else {
        warnings.push(message);
      }
    });

    if (rowHasError) {
      return;
    }

    const normalizedColumns = normalizeEntryColumns(columns, skillMappings);
    if (normalizeStatsForLogic) {
      for (let statIndex = 3; statIndex <= 9; statIndex += 1) {
        normalizedColumns[statIndex] = normalizeStatValueForLogic(normalizedColumns[statIndex]);
      }
    }
    if (validRows === 0 && normalizedLines.length === 0) {
      normalizedLines.push(currentRoom);
    }
    normalizedLines.push(normalizedColumns.join("\t"));
    validRows += 1;
  });

  if (validRows === 0) {
    errors.push("No valid cat rows were found.");
  }

  return {
    errors,
    warnings,
    normalizedCats: normalizedLines.join("\n"),
  };
}
