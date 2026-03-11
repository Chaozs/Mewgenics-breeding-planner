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
export const currentCatsView = document.getElementById("currentCatsView");
export const analyzeCatsBtn = document.getElementById("analyzeCatsBtn");
export const manualCatDialog = document.getElementById("manualCatDialog");
export const manualCatForm = document.getElementById("manualCatForm");
export const manualCatFields = document.getElementById("manualCatFields");
export const manualCatError = document.getElementById("manualCatError");
export const clearManualDraftBtn = document.getElementById("clearManualDraftBtn");
export const closeManualCatBtn = document.getElementById("closeManualCatBtn");
export const manualParseDropzone = document.getElementById("manualParseDropzone");
export const manualParseFileInput = document.getElementById("manualParseFileInput");
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
export const EXPECTED_COLUMNS = 25;
export const ALLOWED_GENDERS = new Set(["M", "F", "?"]);
export const ALLOWED_BREED_WITH = new Set(["X", "M", "F", "?"]);
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
    dragState: {
        sourceIndex: null,
        sourceRoom: "",
        dropTarget: null,
    },
};

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

    if (normalizedBreedWith !== "X") {
        return normalizedBreedWith;
    }
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

        columns[1] = columns[1].toUpperCase();
        columns[2] = normalizeBreedWithForGender(columns[2], columns[1]);
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

export function validateAndNormalizeCatsData(rawText) {
    const errors = [];
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
            errors.push(`${context} Column "BreedWith": value "${columns[2]}" is invalid. Expected x, ?, M, or F.`);
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

        if (rowHasError) {
            return;
        }

        columns[1] = gender;
        columns[2] = normalizeBreedWithForGender(breedWith, gender);
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
        return { error: "BreedWith must be x, ?, M, or F." };
    }

    const stats = columns.slice(3, 10);
    if (stats.some((value) => value !== "0" && value !== "1")) {
        return { error: "Str through Luck must each be 0 or 1." };
    }

    if (!columns[0]) {
        return { error: "Cat name is required." };
    }

    columns[1] = gender;
    columns[2] = normalizeBreedWithForGender(breedWith, gender);
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
