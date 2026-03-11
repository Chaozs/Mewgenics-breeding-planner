const STAT_COLUMN_START = 3;
const STAT_COLUMN_END = 9;

function createSelectOptions(values, labelMap = {}) {
    return values.map((value) => ({
        value,
        label: labelMap[value] || value,
    }));
}

export const COLUMN_DEFINITIONS = [
    { key: "cat", label: "Cat", defaultValue: "", control: "text", placeholder: "" },
    { key: "gender", label: "Gender", defaultValue: "?", control: "select", options: createSelectOptions(["?", "M", "F"]) },
    {
        key: "breed_with",
        label: "BreedWith",
        defaultValue: "X",
        control: "select",
        options: createSelectOptions(["X", "?", "M", "F"], { X: "x" }),
    },
    { key: "str", label: "Str", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "dex", label: "Dex", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "health", label: "Health", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "int", label: "Int", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "move", label: "Move", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "char", label: "Char", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "luck", label: "Luck", defaultValue: "0", control: "select", options: createSelectOptions(["0", "1"]) },
    { key: "body", label: "Body", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "head", label: "Head", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "tail", label: "Tail", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "leg_1", label: "Leg 1", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "leg_2", label: "Leg 2", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "arm_1", label: "Arm 1", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "arm_2", label: "Arm 2", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "eye_1", label: "Eye 1", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "eye_2", label: "Eye 2", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "eyebrow_1", label: "Eyebrow 1", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "eyebrow_2", label: "Eyebrow 2", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "ear_1", label: "Ear 1", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "ear_2", label: "Ear 2", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "mouth", label: "Mouth", defaultValue: "x", control: "text", placeholder: "x" },
    { key: "fur", label: "Fur", defaultValue: "x", control: "text", placeholder: "x" },
];

export const COLUMN_LABELS = COLUMN_DEFINITIONS.map((definition) => definition.label);
export const COLUMN_KEYS = COLUMN_DEFINITIONS.map((definition) => definition.key);

export function isStatColumn(index) {
    return index >= STAT_COLUMN_START && index <= STAT_COLUMN_END;
}

export function getColumnDefinition(index) {
    return COLUMN_DEFINITIONS[index] || null;
}

export function getDefaultValueForColumn(index) {
    return getColumnDefinition(index)?.defaultValue || "";
}

export function normalizeColumnInputValue(columnIndex, value) {
    let nextValue = String(value ?? "").trim();

    if (columnIndex === 1) {
        nextValue = nextValue.toUpperCase();
        return ["M", "F", "?"].includes(nextValue) ? nextValue : "?";
    }

    if (columnIndex === 2) {
        nextValue = nextValue.toUpperCase();
        return ["X", "M", "F", "?"].includes(nextValue) ? nextValue : "X";
    }

    if (isStatColumn(columnIndex)) {
        return nextValue === "1" ? "1" : "0";
    }

    return nextValue;
}

export function createColumnEditor(columnIndex, value, options = {}) {
    const definition = getColumnDefinition(columnIndex);
    if (!definition) {
        throw new Error(`Unknown column index: ${columnIndex}`);
    }

    const {
        className = "",
        name = definition.key,
        dataset = {},
    } = options;

    let control;
    if (definition.control === "select") {
        control = document.createElement("select");
        definition.options.forEach((option) => {
            const optionElement = document.createElement("option");
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            control.appendChild(optionElement);
        });
    } else {
        control = document.createElement("input");
        control.type = "text";
        if (definition.placeholder) {
            control.placeholder = definition.placeholder;
        }
    }

    control.name = name;
    control.value = normalizeColumnInputValue(columnIndex, value ?? definition.defaultValue);
    className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => control.classList.add(token));

    Object.entries(dataset).forEach(([key, datasetValue]) => {
        if (datasetValue !== undefined && datasetValue !== null) {
            control.dataset[key] = String(datasetValue);
        }
    });

    return control;
}
