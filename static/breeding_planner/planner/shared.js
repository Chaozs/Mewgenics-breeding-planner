import {
    COLUMN_DEFINITIONS,
    COLUMN_KEYS,
    COLUMN_LABELS,
    createColumnEditor,
    getDefaultValueForColumn,
    isStatColumn,
    normalizeColumnInputValue,
} from "./cat-schema.js";

export {
    COLUMN_DEFINITIONS,
    COLUMN_KEYS,
    COLUMN_LABELS,
    createColumnEditor,
    getDefaultValueForColumn,
    isStatColumn,
    normalizeColumnInputValue,
};

export const importPanel = document.getElementById("importPanel");
export const catsImportInput = document.getElementById("catsImportInput");
export const priorityOrderInput = document.getElementById("priorityOrderInput");
export const roomAFocusInput = document.getElementById("roomAFocusInput");
export const roomBFocusInput = document.getElementById("roomBFocusInput");
export const roomCFocusInput = document.getElementById("roomCFocusInput");
export const roomDFocusInput = document.getElementById("roomDFocusInput");
export const skillMappingsList = document.getElementById("skillMappingsList");
export const addSkillMappingBtn = document.getElementById("addSkillMappingBtn");
export const loading = document.getElementById("loading");
export const resultStructured = document.getElementById("resultStructured");
export const followupPanel = document.getElementById("followupPanel");
export const followupPromptText = document.getElementById("followupPromptText");
export const followupResponseInput = document.getElementById("followupResponseInput");
export const sendFollowupBtn = document.getElementById("sendFollowupBtn");
export const saveImportToStorageBtn = document.getElementById("saveImportToStorageBtn");
export const clearImportInputBtn = document.getElementById("clearImportInputBtn");
export const addCatBtn = document.getElementById("addCatBtn");
export const undoActionBtn = document.getElementById("undoActionBtn");
export const clearStoredRowsBtn = document.getElementById("clearStoredRowsBtn");
export const plannerStorageMeta = document.getElementById("plannerStorageMeta");
export const importStatus = document.getElementById("importStatus");
export const currentCatsStatus = document.getElementById("currentCatsStatus");
export const currentCatsView = document.getElementById("currentCatsView");
export const plannerAiSection = document.getElementById("plannerAiSection");
export const plannerAiLockNotice = document.getElementById("plannerAiLockNotice");
export const analyzeCatsBtn = document.getElementById("analyzeCatsBtn");
export const manualCatDialog = document.getElementById("manualCatDialog");
export const manualCatForm = document.getElementById("manualCatForm");
export const manualCatFields = document.getElementById("manualCatFields");
export const manualCatError = document.getElementById("manualCatError");
export const clearManualDraftBtn = document.getElementById("clearManualDraftBtn");
export const closeManualCatBtn = document.getElementById("closeManualCatBtn");
export const manualParseSection = document.getElementById("manualParseSection");
export const manualParseDropzone = document.getElementById("manualParseDropzone");
export const manualParseFileInput = document.getElementById("manualParseFileInput");
export const manualParseLockNotice = document.getElementById("manualParseLockNotice");
export const manualParseStatus = document.getElementById("manualParseStatus");
export const manualParsePreview = document.getElementById("manualParsePreview");
export const parseLoadingDialog = document.getElementById("parseLoadingDialog");

export const ROOM_A = "Room A";
export const ROOM_B = "Room B";
export const ROOM_C = "Room C";
export const ROOM_D = "Room D";
export const DEFAULT_ROOM = ROOM_A;
export const ROOM_ORDER = [ROOM_A, ROOM_B, ROOM_C, ROOM_D];
const ROOM_ALIASES = new Map([
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
export const ROOM_SHORT_LABEL = new Map([
    [ROOM_A, "A"],
    [ROOM_B, "B"],
    [ROOM_C, "C"],
    [ROOM_D, "D"],
]);

export const CATS_STORAGE_KEY = "mewgenics.cats_data_rows";
export const MANUAL_CAT_DRAFT_KEY = "mewgenics.manual_cat_draft";
export const PLANNER_CONFIG_STORAGE_KEY = "mewgenics.planner_config";
export const EXPECTED_COLUMNS = 25;
export const ALLOWED_GENDERS = new Set(["M", "F", "?"]);
export const ALLOWED_BREED_WITH = new Set(["", "X", "M", "F", "?"]);
export const MUTATION_COLUMN_BODY_PARTS = new Map([
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
export const ROOM_MARKERS = new Set(ROOM_ALIASES.keys());
export const PLANNER_CONFIG_FIELDS = [
    { requestKey: "priorityOrder", responseKey: "defaultPriorityOrder", element: priorityOrderInput },
    { requestKey: "roomAFocus", responseKey: "defaultRoomAFocus", element: roomAFocusInput },
    { requestKey: "roomBFocus", responseKey: "defaultRoomBFocus", element: roomBFocusInput },
    { requestKey: "roomCFocus", responseKey: "defaultRoomCFocus", element: roomCFocusInput },
    { requestKey: "roomDFocus", responseKey: "defaultRoomDFocus", element: roomDFocusInput },
];

export const SECTION_KEYS = {
    summary: "SUMMARY",
    trimStrong: "TRIM (STRONG)",
    trimMaybe: "TRIM (MAYBE)",
    move: "MOVE",
    actionRequest: "ACTION REQUEST (OPTIONAL)",
};

export const NO_DATA_STEPS = [
    "Expand Import Excel Data, paste spreadsheet rows, then click Save to Browser Data.",
    "Or use Add Cat in Current Cat Rows.",
    "Current Cat Rows will render from browser data as an editable table.",
    "Use row actions to reorder, move between rooms, or delete cats.",
    "Optionally edit Recommendation Customization (mutation priority + Room A/B/C/D focus).",
    "Click Analyze Cats to generate recommendations.",
];

export const ACTION_HISTORY_LIMIT = 100;
export const ACTION_LABELS = {
    "move-up": "move up",
    "move-down": "move down",
    "move-room": "move room",
    "delete": "delete",
    "add": "add",
};
export const ACTION_REQUEST_NONE = "none";

export const state = {
    latestAnalysisText: "",
    manualParsePreviewObjectUrl: "",
    manualDraftHydrated: false,
    suppressManualDraftSaveOnClose: false,
    openAiFeaturesEnabled: true,
    openAiStatusMessage: "",
    dragState: {
        sourceIndex: null,
        sourceRoom: "",
        dropTarget: null,
    },
};

export function setOpenAiAvailability(enabled, message = "") {
    state.openAiFeaturesEnabled = Boolean(enabled);
    state.openAiStatusMessage = String(message || "");
}

export function isOpenAiFeatureEnabled() {
    return state.openAiFeaturesEnabled;
}

export function getOpenAiUnavailableMessage() {
    return state.openAiStatusMessage || "OpenAI features are unavailable.";
}

export function normalizeLabel(value) {
    return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isRoomMarker(line) {
    return ROOM_MARKERS.has(normalizeLabel(line));
}

export function toRoomLabel(line) {
    const normalized = normalizeLabel(line);
    return ROOM_ALIASES.get(normalized) || line.trim() || DEFAULT_ROOM;
}

export function normalizeBreedWithForGender(breedWith, gender) {
    const normalizedBreedWith = (breedWith || "").toUpperCase();
    const normalizedGender = (gender || "").toUpperCase();
    if (normalizedBreedWith === "X") {
        return normalizeBreedWithForGender("", normalizedGender);
    }
    if (!normalizedBreedWith) {
        return getDefaultBreedWithForGender(normalizedGender);
    }
    return normalizedBreedWith;
}

export function getDefaultBreedWithForGender(gender) {
    const normalizedGender = (gender || "").toUpperCase();
    if (normalizedGender === "M") {
        return "F";
    }
    if (normalizedGender === "F") {
        return "M";
    }
    return "?";
}

export function isHeaderRow(columns) {
    if (columns.length < 3) {
        return false;
    }

    const first = columns[0].trim().toLowerCase();
    const second = columns[1].trim().toLowerCase();
    const third = columns[2].trim().toLowerCase().replace(/\s+/g, "");
    return first === "cat" && second === "gender" && third === "breedwith";
}

export function normalizeEntryColumns(columns) {
    const gender = (columns[1] || "?").toUpperCase();
    columns[1] = ALLOWED_GENDERS.has(gender) ? gender : "?";
    columns[2] = normalizeBreedWithForGender(columns[2], columns[1]);
    for (let columnIndex = 10; columnIndex < columns.length; columnIndex += 1) {
        columns[columnIndex] = normalizeMutationValue(columns[columnIndex]);
    }
}

function unwrapMatchingQuotes(value) {
    const trimmed = String(value || "").trim();
    if (trimmed.length >= 2) {
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        if ((first === '"' || first === "'") && last === first) {
            return trimmed.slice(1, -1).trim();
        }
    }
    return trimmed;
}

function normalizeSkillMappingKey(value) {
    return unwrapMatchingQuotes(value).toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseSkillMappingsTextToRows(rawText = "") {
    const rows = [];

    String(rawText || "")
        .split(/\r?\n/)
        .forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                return;
            }

            const match = trimmed.match(/^(.*?)\s*(?:=>|->|=)\s*(.+)$/);
            if (!match) {
                return;
            }

            rows.push({
                source: unwrapMatchingQuotes(match[1]).trim(),
                target: unwrapMatchingQuotes(match[2]).trim(),
            });
        });

    return rows;
}

export function getSkillMappingRows() {
    if (!skillMappingsList) {
        return [];
    }

    return Array.from(skillMappingsList.querySelectorAll("[data-skill-mapping-row]"))
        .map((row) => ({
            source: String(row.querySelector('[data-role="source"]')?.value || "").trim(),
            target: String(row.querySelector('[data-role="target"]')?.value || "").trim(),
        }))
        .filter((row) => row.source || row.target);
}

export function serializeSkillMappings(rows = getSkillMappingRows()) {
    return rows
        .filter((row) => row.source && row.target)
        .map((row) => `${row.source} => ${row.target}`)
        .join("\n");
}

function createSkillMappingRowElement({ source = "", target = "" } = {}) {
    const row = document.createElement("div");
    row.className = "skill-mapping-row";
    row.dataset.skillMappingRow = "true";

    const sourceInput = document.createElement("input");
    sourceInput.type = "text";
    sourceInput.className = "skill-mapping-input";
    sourceInput.dataset.role = "source";
    sourceInput.placeholder = "Original screenshot text";
    sourceInput.value = source;
    row.appendChild(sourceInput);

    const arrow = document.createElement("span");
    arrow.className = "skill-mapping-arrow";
    arrow.textContent = "=>";
    row.appendChild(arrow);

    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.className = "skill-mapping-input";
    targetInput.dataset.role = "target";
    targetInput.placeholder = "Mapped token";
    targetInput.value = target;
    row.appendChild(targetInput);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary-btn skill-mapping-remove";
    removeButton.dataset.action = "remove-skill-mapping";
    removeButton.textContent = "Remove";
    row.appendChild(removeButton);

    return row;
}

export function renderSkillMappingRows(rows = []) {
    if (!skillMappingsList) {
        return;
    }

    skillMappingsList.innerHTML = "";
    const nextRows = rows.length > 0 ? rows : [{ source: "", target: "" }];
    nextRows.forEach((row) => {
        skillMappingsList.appendChild(createSkillMappingRowElement(row));
    });
}

export function addSkillMappingRow(row = { source: "", target: "" }) {
    if (!skillMappingsList) {
        return;
    }
    skillMappingsList.appendChild(createSkillMappingRowElement(row));
}

export function applySkillMappingsText(rawText = "") {
    renderSkillMappingRows(parseSkillMappingsTextToRows(rawText));
}

export function getStoredPlannerConfigValues() {
    try {
        const raw = localStorage.getItem(PLANNER_CONFIG_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return {};
        }
        return parsed;
    } catch (err) {
        console.error(err);
        return {};
    }
}

export function setStoredPlannerConfigValues(values) {
    try {
        localStorage.setItem(PLANNER_CONFIG_STORAGE_KEY, JSON.stringify(values));
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

export function getSkillMappingsText() {
    const liveValue = serializeSkillMappings();
    if (liveValue.trim()) {
        return liveValue;
    }
    return String(getStoredPlannerConfigValues().skillMappings || "");
}

export function parseSkillMappings(rawText = getSkillMappingsText()) {
    const mappings = new Map();

    parseSkillMappingsTextToRows(rawText).forEach((row) => {
            const source = normalizeSkillMappingKey(row.source);
            const target = unwrapMatchingQuotes(row.target).trim();
            if (!source || !target) {
                return;
            }
            mappings.set(source, target);
        });

    return mappings;
}

function statTokenToLegacyModifier(statName) {
    return String(statName || "").trim().toLowerCase();
}

export function normalizeMutationValue(value) {
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
        const stat = statTokenToLegacyModifier(legacyPlusMatch[1]);
        const bodyPart = legacyPlusMatch[2].trim().toLowerCase();
        return `+1${stat}(${bodyPart})`;
    }

    const legacyModifierMatch = trimmed.match(/^more([A-Z][A-Za-z0-9]*)Less([A-Z][A-Za-z0-9]*)\(([^()]+)\)$/);
    if (legacyModifierMatch) {
        const gainStat = statTokenToLegacyModifier(legacyModifierMatch[1]);
        const lossStat = statTokenToLegacyModifier(legacyModifierMatch[2]);
        const bodyPart = legacyModifierMatch[3].trim().toLowerCase();
        return `+2${gainStat}-1${lossStat}(${bodyPart})`;
    }

    const genericMutationMatch = trimmed.match(/^(.+?)\(([^()]+)\)$/);
    if (genericMutationMatch) {
        const traitText = genericMutationMatch[1].trim();
        const bodyPart = genericMutationMatch[2].trim().toLowerCase();
        const mappedTrait = parseSkillMappings().get(normalizeSkillMappingKey(traitText));
        if (mappedTrait) {
            return `${mappedTrait}(${bodyPart})`;
        }
        return `${traitText}(${bodyPart})`;
    }

    const mappedTrait = parseSkillMappings().get(normalizeSkillMappingKey(trimmed));
    if (mappedTrait) {
        return mappedTrait;
    }

    return trimmed;
}

export function getExpectedBodyPartForColumn(index) {
    return MUTATION_COLUMN_BODY_PARTS.get(index) || "";
}

export function validateMutationValue(value, columnIndex) {
    const expectedBodyPart = getExpectedBodyPartForColumn(columnIndex);
    if (!expectedBodyPart) {
        return "";
    }

    const trimmed = String(value ?? "").trim();
    if (!trimmed || trimmed.toLowerCase() === "x") {
        return "";
    }

    // Mutation slots should hold a trait name followed by the owning body part.
    const match = trimmed.match(/^([A-Za-z0-9+\-]+)\(([^()]+)\)$/);
    if (!match) {
        return `value "${trimmed}" is invalid. Expected an empty value, x, or a mutation formatted like traitName(${expectedBodyPart}).`;
    }

    const actualBodyPart = match[2].trim().toLowerCase();
    if (actualBodyPart !== expectedBodyPart) {
        return `value "${trimmed}" is under the wrong body part. Expected (${expectedBodyPart}) for this column.`;
    }

    return "";
}

export function getRowContext(lineNumber, columns) {
    const catName = (columns?.[0] || "").trim();
    if (catName) {
        return `Line ${lineNumber} [Cat: ${catName}]`;
    }
    return `Line ${lineNumber}`;
}

export function parseStoredEntries(rawText) {
    const rows = [];
    const invalidLines = [];
    let currentRoom = DEFAULT_ROOM;

    rawText.split(/\r?\n/).forEach((rawLine, index) => {
        const lineNumber = index + 1;
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
            invalidLines.push(`Line ${lineNumber}: not rendered (invalid column count).`);
            return;
        }

        normalizeEntryColumns(columns);
        rows.push({ room: currentRoom, columns });
    });

    return { rows, invalidLines };
}

export function serializeEntries(entries) {
    if (!entries.length) {
        return "";
    }

    const grouped = groupEntriesByRoom(entries, ({ columns }) => columns);
    const orderedRooms = getOrderedRooms(grouped);
    const lines = [];

    for (const room of orderedRooms) {
        const roomRows = grouped.get(room);
        if (!roomRows || roomRows.length === 0) {
            continue;
        }
        lines.push(room);
        roomRows.forEach((columns) => {
            lines.push(columns.join("\t"));
        });
    }

    return lines.join("\n");
}

export function groupEntriesByRoom(entries, mapEntry = (entry) => entry) {
    const grouped = new Map();

    entries.forEach((entry, index) => {
        if (!grouped.has(entry.room)) {
            grouped.set(entry.room, []);
        }
        grouped.get(entry.room).push(mapEntry(entry, index));
    });

    return grouped;
}

export function getOrderedRooms(groupedEntries) {
    const rooms = Array.from(groupedEntries.keys());
    return [...ROOM_ORDER, ...rooms.filter((room) => !ROOM_ORDER.includes(room))];
}

export function validateAndNormalizeCatsData(rawText, options = {}) {
    const { validateMutations = true } = options;
    const errors = [];
    const warnings = [];
    const normalizedLines = [];
    let validRows = 0;
    let currentRoom = DEFAULT_ROOM;

    rawText.split(/\r?\n/).forEach((rawLine, index) => {
        const lineNumber = index + 1;
        const line = rawLine.trim();
        if (!line) {
            return;
        }

        if (isRoomMarker(line)) {
            currentRoom = toRoomLabel(line);
            normalizedLines.push(currentRoom);
            return;
        }

        const columns = rawLine.split("\t").map((value) => value.trim());
        if (isHeaderRow(columns)) {
            return;
        }

        if (columns.length !== EXPECTED_COLUMNS) {
            const context = getRowContext(lineNumber, columns);
            if (columns.length === 1 && rawLine.includes(",") && !rawLine.includes("\t")) {
                errors.push(`${context} Column separator error: row appears comma-separated. Use tab-separated columns.`);
            } else {
                errors.push(
                    `${context} Column count error: expected ${EXPECTED_COLUMNS} tab-separated columns, found ${columns.length}.`
                );
            }
            return;
        }

        const context = getRowContext(lineNumber, columns);
        let rowHasError = false;
        if (!columns[0]) {
            errors.push(`${context} Column "Cat": value is empty.`);
            rowHasError = true;
        }

        const gender = columns[1].toUpperCase();
        if (!ALLOWED_GENDERS.has(gender)) {
            errors.push(`${context} Column "Gender": value "${columns[1]}" is invalid. Expected M, F, or ?.`);
            rowHasError = true;
        }

        const breedWith = columns[2].toUpperCase();
        if (!ALLOWED_BREED_WITH.has(breedWith)) {
            errors.push(`${context} Column "BreedWith": value "${columns[2]}" is invalid. Expected blank, ?, M, or F.`);
            rowHasError = true;
        }

        const stats = columns.slice(3, 10);
        const statLabels = ["Str", "Dex", "Health", "Int", "Move", "Char", "Luck"];
        stats.forEach((statValue, statIndex) => {
            if (statValue !== "0" && statValue !== "1") {
                errors.push(
                    `${context} Column "${statLabels[statIndex]}": value "${statValue}" is invalid. Expected 0 or 1.`
                );
                rowHasError = true;
            }
        });

        columns.slice(10).forEach((mutationValue, offset) => {
            const columnIndex = offset + 10;
            const mutationError = validateMutationValue(mutationValue, columnIndex);
            if (!mutationError) {
                return;
            }

            const message = `${context} Column "${COLUMN_LABELS[columnIndex]}": ${mutationError}`;
            if (validateMutations) {
                errors.push(message);
                rowHasError = true;
                return;
            }

            // Import is intentionally lenient so users can land rows first and fix
            // invalid mutation cells from the highlighted editor afterward.
            warnings.push(message);
        });

        if (rowHasError) {
            return;
        }

        normalizeEntryColumns(columns);
        if (validRows === 0 && normalizedLines.length === 0) {
            normalizedLines.push(currentRoom);
        }
        normalizedLines.push(columns.join("\t"));
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

export function getManualCatEntryFromFormData(formData) {
    const room = toRoomLabel(String(formData.get("room") || ROOM_A));
    const columns = COLUMN_KEYS.map((key, index) => {
        const raw = String(formData.get(key) || "").trim();
        return raw || getDefaultValueForColumn(index);
    });

    const gender = columns[1].toUpperCase();
    if (!ALLOWED_GENDERS.has(gender)) {
        return { error: "Gender must be M, F, or ?." };
    }

    const breedWith = columns[2].toUpperCase();
    if (!ALLOWED_BREED_WITH.has(breedWith)) {
        return { error: "BreedWith must be blank, ?, M, or F." };
    }

    const stats = columns.slice(3, 10);
    if (stats.some((value) => value !== "0" && value !== "1")) {
        return { error: "Str through Luck must each be 0 or 1." };
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

    normalizeEntryColumns(columns);
    return { entry: { room, columns } };
}

export function getStoredCatsText() {
    try {
        return localStorage.getItem(CATS_STORAGE_KEY) || "";
    } catch (err) {
        console.error(err);
        return "";
    }
}

export function setStoredCatsText(text) {
    try {
        localStorage.setItem(CATS_STORAGE_KEY, text);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

export function getStoredEntries() {
    return parseStoredEntries(getStoredCatsText()).rows;
}

export function getStoredRowCount() {
    return getStoredEntries().length;
}

export function updateStorageMeta() {
    if (!plannerStorageMeta) {
        return;
    }

    const count = getStoredRowCount();
    plannerStorageMeta.textContent = `Browser storage: ${count} row${count === 1 ? "" : "s"}.`;
}
