export type ColumnDefinition = {
  key: string;
  label: string;
  defaultValue: string;
  control: "text" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const STAT_COLUMN_START = 3;
const STAT_COLUMN_END = 9;
const STAT_VALUE_OPTIONS = ["2", "3", "4", "5", "6", "7", "0"];

function createSelectOptions(values: string[], labelMap: Record<string, string> = {}) {
  return values.map((value) => ({
    value,
    label: labelMap[value] ?? value,
  }));
}

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "cat", label: "Cat", defaultValue: "", control: "text", placeholder: "" },
  {
    key: "gender",
    label: "Gender",
    defaultValue: "?",
    control: "select",
    options: createSelectOptions(["?", "M", "F"]),
  },
  {
    key: "breed_with",
    label: "BreedWith",
    defaultValue: "",
    control: "select",
    options: createSelectOptions(["", "ANY", "?", "M", "F"], { "": "", ANY: "Any" }),
  },
  ...["Str", "Dex", "Health", "Int", "Move", "Char", "Luck"].map((label) => ({
    key: label.toLowerCase(),
    label,
    defaultValue: "7",
    control: "select" as const,
    options: createSelectOptions(STAT_VALUE_OPTIONS, { "0": "0 (legacy)" }),
  })),
  { key: "body", label: "Body", defaultValue: "", control: "text", placeholder: "" },
  { key: "head", label: "Head", defaultValue: "", control: "text", placeholder: "" },
  { key: "tail", label: "Tail", defaultValue: "", control: "text", placeholder: "" },
  { key: "leg_1", label: "Leg 1", defaultValue: "", control: "text", placeholder: "" },
  { key: "leg_2", label: "Leg 2", defaultValue: "", control: "text", placeholder: "" },
  { key: "arm_1", label: "Arm 1", defaultValue: "", control: "text", placeholder: "" },
  { key: "arm_2", label: "Arm 2", defaultValue: "", control: "text", placeholder: "" },
  { key: "eye_1", label: "Eye 1", defaultValue: "", control: "text", placeholder: "" },
  { key: "eye_2", label: "Eye 2", defaultValue: "", control: "text", placeholder: "" },
  { key: "eyebrow_1", label: "Eyebrow 1", defaultValue: "", control: "text", placeholder: "" },
  { key: "eyebrow_2", label: "Eyebrow 2", defaultValue: "", control: "text", placeholder: "" },
  { key: "ear_1", label: "Ear 1", defaultValue: "", control: "text", placeholder: "" },
  { key: "ear_2", label: "Ear 2", defaultValue: "", control: "text", placeholder: "" },
  { key: "mouth", label: "Mouth", defaultValue: "", control: "text", placeholder: "" },
  { key: "fur", label: "Fur", defaultValue: "", control: "text", placeholder: "" },
];

export const COLUMN_LABELS = COLUMN_DEFINITIONS.map((definition) => definition.label);
export const COLUMN_KEYS = COLUMN_DEFINITIONS.map((definition) => definition.key);

export function isStatColumn(index: number) {
  return index >= STAT_COLUMN_START && index <= STAT_COLUMN_END;
}

export function getColumnDefinition(index: number) {
  return COLUMN_DEFINITIONS[index] ?? null;
}

export function getDefaultValueForColumn(index: number) {
  return getColumnDefinition(index)?.defaultValue ?? "";
}

export function normalizeColumnInputValue(columnIndex: number, value: string) {
  let nextValue = String(value ?? "").trim();

  if (columnIndex === 1) {
    nextValue = nextValue.toUpperCase();
    return ["M", "F", "?"].includes(nextValue) ? nextValue : "?";
  }

  if (columnIndex === 2) {
    nextValue = nextValue.toUpperCase();
    return ["", "X", "M", "F", "?", "ANY"].includes(nextValue) ? nextValue : "";
  }

  if (isStatColumn(columnIndex)) {
    if (nextValue === "1") {
      return "7";
    }
    return STAT_VALUE_OPTIONS.includes(nextValue) ? nextValue : "7";
  }

  return nextValue;
}
