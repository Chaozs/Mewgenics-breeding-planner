import {
    COLUMN_LABELS,
    DEFAULT_ROOM,
    EXPECTED_COLUMNS,
    MANUAL_CAT_DRAFT_KEY,
    manualCatDialog,
    manualCatError,
    manualCatFields,
    manualCatForm,
    manualParseFileInput,
    manualParsePreview,
    manualParseStatus,
    parseLoadingDialog,
    ROOM_ORDER,
    state,
} from "./shared.js";
import {
    COLUMN_KEYS,
    createColumnEditor,
    getDefaultValueForColumn,
    getManualCatEntryFromFormData,
    isHeaderRow,
    isRoomMarker,
    normalizeEntryColumns,
    toRoomLabel,
} from "./shared.js";

export function setManualCatError(message = "") {
    if (manualCatError) {
        manualCatError.textContent = message;
    }
}

export function setManualParseStatus(message, isError = false) {
    if (!manualParseStatus) {
        return;
    }
    manualParseStatus.textContent = message;
    manualParseStatus.classList.toggle("error", isError);
}

export function clearManualParsePreview() {
    if (state.manualParsePreviewObjectUrl) {
        URL.revokeObjectURL(state.manualParsePreviewObjectUrl);
        state.manualParsePreviewObjectUrl = "";
    }
    if (manualParsePreview) {
        manualParsePreview.innerHTML = "";
    }
}

export function showManualParsePreview(file) {
    if (!manualParsePreview || !file) {
        return;
    }

    clearManualParsePreview();

    const image = document.createElement("img");
    state.manualParsePreviewObjectUrl = URL.createObjectURL(file);
    image.src = state.manualParsePreviewObjectUrl;
    image.alt = "Screenshot preview";
    manualParsePreview.appendChild(image);
}

export function resetManualParseSection() {
    if (manualParseFileInput) {
        manualParseFileInput.value = "";
    }
    clearManualParsePreview();
    setManualParseStatus("Waiting for screenshot...");
}

export function showParseLoadingDialog() {
    if (!parseLoadingDialog) {
        return;
    }

    try {
        if (manualCatDialog && manualCatDialog.open && typeof parseLoadingDialog.show === "function") {
            parseLoadingDialog.show();
            return;
        }
        if (typeof parseLoadingDialog.showModal === "function") {
            parseLoadingDialog.showModal();
            return;
        }
        parseLoadingDialog.setAttribute("open", "true");
    } catch (err) {
        parseLoadingDialog.setAttribute("open", "true");
    }
}

export function hideParseLoadingDialog() {
    if (!parseLoadingDialog) {
        return;
    }

    if (typeof parseLoadingDialog.close === "function" && parseLoadingDialog.open) {
        try {
            parseLoadingDialog.close();
            return;
        } catch (err) {
            parseLoadingDialog.removeAttribute("open");
            return;
        }
    }
    parseLoadingDialog.removeAttribute("open");
}

export function extractImageFromClipboardEvent(event) {
    const items = event.clipboardData?.items;
    if (!items) {
        return null;
    }

    for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
            return item.getAsFile();
        }
    }
    return null;
}

export function parseModelRowToEntry(rawRow) {
    const lines = String(rawRow || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    let detectedRoom = DEFAULT_ROOM;
    for (const line of lines) {
        if (isRoomMarker(line)) {
            detectedRoom = toRoomLabel(line);
            continue;
        }

        const columns = line.split("\t").map((value) => value.trim());
        if (isHeaderRow(columns)) {
            continue;
        }

        // The vision model sometimes prefixes the row with a room marker cell.
        if (columns.length === EXPECTED_COLUMNS + 1 && isRoomMarker(columns[0])) {
            detectedRoom = toRoomLabel(columns[0]);
            columns.shift();
        }

        if (columns.length !== EXPECTED_COLUMNS) {
            continue;
        }

        const normalizedColumns = columns.slice();
        normalizeEntryColumns(normalizedColumns);
        return { room: detectedRoom, columns: normalizedColumns };
    }

    throw new Error(`Parse output was not a valid ${EXPECTED_COLUMNS}-column row.`);
}

export function applyParsedEntryToManualForm(entry) {
    if (!manualCatForm || !entry || !entry.columns) {
        return;
    }

    const normalizedColumns = entry.columns.slice();
    normalizeEntryColumns(normalizedColumns);

    const controls = manualCatForm.querySelectorAll("input[name], select[name]");
    controls.forEach((control) => {
        if (control.name === "room") {
            control.value = entry.room || DEFAULT_ROOM;
            return;
        }

        const index = COLUMN_KEYS.indexOf(control.name);
        if (index < 0) {
            return;
        }

        let nextValue = normalizedColumns[index];
        if (!nextValue) {
            nextValue = getDefaultValueForColumn(index);
        }
        control.value = nextValue;
    });
}

export async function parseScreenshotForManualForm(file, options = {}) {
    const { keepCurrentForm = false } = options;

    if (!file || !file.type.startsWith("image/")) {
        setManualParseStatus("Selected file is not an image.", true);
        return;
    }

    setManualCatError("");
    setManualParseStatus("Parsing cat...");
    showManualParsePreview(file);
    showParseLoadingDialog();

    let parsedEntry = null;
    let parseError = null;

    try {
        const formData = new FormData();
        formData.append("image", file, file.name || "screenshot.png");

        const response = await fetch("/parse", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Request failed with ${response.status}`);
        }
        parsedEntry = parseModelRowToEntry(data.row || "");
    } catch (err) {
        console.error(err);
        parseError = err;
    } finally {
        hideParseLoadingDialog();
    }

    if (parseError) {
        if (!manualCatDialog?.open) {
            openManualCatDialog();
        }
        setManualParseStatus(`Error: ${parseError.message}`, true);
        saveManualCatDraft();
        return;
    }

    if (!keepCurrentForm) {
        openManualCatDialog();
    }
    applyParsedEntryToManualForm(parsedEntry);
    showManualParsePreview(file);
    setManualParseStatus("Parsed successfully.");
    saveManualCatDraft();
}

export function buildManualCatFields() {
    if (!manualCatFields) {
        return;
    }

    manualCatFields.innerHTML = "";

    const roomField = document.createElement("label");
    roomField.className = "manual-field";
    roomField.innerHTML = '<span class="manual-label">Room</span>';
    const roomSelect = document.createElement("select");
    roomSelect.name = "room";
    roomSelect.innerHTML = ROOM_ORDER.map((room) => `<option value="${room}">${room}</option>`).join("");
    roomField.appendChild(roomSelect);
    manualCatFields.appendChild(roomField);

    COLUMN_LABELS.forEach((label, index) => {
        const field = document.createElement("label");
        field.className = "manual-field";

        const title = document.createElement("span");
        title.className = "manual-label";
        title.textContent = label;
        field.appendChild(title);

        const control = createColumnEditor(index, getDefaultValueForColumn(index), {
            name: COLUMN_KEYS[index],
        });
        field.appendChild(control);
        manualCatFields.appendChild(field);
    });
}

export function resetManualCatForm() {
    if (!manualCatForm) {
        return;
    }

    manualCatForm.reset();
    const controls = manualCatForm.querySelectorAll("input[name], select[name]");
    controls.forEach((control) => {
        if (control.name === "room") {
            control.value = DEFAULT_ROOM;
            return;
        }
        const index = COLUMN_KEYS.indexOf(control.name);
        if (index >= 0) {
            control.value = getDefaultValueForColumn(index);
        }
    });
    setManualCatError("");
    resetManualParseSection();
}

export function getManualCatDraft() {
    try {
        const raw = localStorage.getItem(MANUAL_CAT_DRAFT_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed;
    } catch (err) {
        console.error(err);
        return null;
    }
}

export function clearManualCatDraft() {
    try {
        localStorage.removeItem(MANUAL_CAT_DRAFT_KEY);
    } catch (err) {
        console.error(err);
    }
}

export function saveManualCatDraft() {
    if (!manualCatForm) {
        return;
    }

    const values = {};
    const controls = manualCatForm.querySelectorAll("input[name], select[name]");
    controls.forEach((control) => {
        if (control.name) {
            values[control.name] = String(control.value ?? "");
        }
    });

    const draft = {
        values,
        parseStatusText: manualParseStatus ? manualParseStatus.textContent || "" : "",
        parseStatusIsError: manualParseStatus ? manualParseStatus.classList.contains("error") : false,
        manualCatErrorText: manualCatError ? manualCatError.textContent || "" : "",
    };

    try {
        localStorage.setItem(MANUAL_CAT_DRAFT_KEY, JSON.stringify(draft));
    } catch (err) {
        console.error(err);
    }
}

export function applyManualCatDraft(draft) {
    resetManualCatForm();
    if (!draft || !manualCatForm) {
        return;
    }

    const values = draft.values && typeof draft.values === "object" ? draft.values : {};
    const controls = manualCatForm.querySelectorAll("input[name], select[name]");
    controls.forEach((control) => {
        if (!control.name || !(control.name in values)) {
            return;
        }

        const nextValue = String(values[control.name] ?? "");
        if (nextValue.length > 0) {
            control.value = nextValue;
        }
    });

    const parseStatusText = typeof draft.parseStatusText === "string" ? draft.parseStatusText : "";
    if (parseStatusText.trim()) {
        setManualParseStatus(parseStatusText, Boolean(draft.parseStatusIsError));
    }

    if (typeof draft.manualCatErrorText === "string") {
        setManualCatError(draft.manualCatErrorText);
    }
}

export function openManualCatDialog() {
    if (!manualCatDialog) {
        return;
    }

    if (!state.manualDraftHydrated) {
        const draft = getManualCatDraft();
        if (draft) {
            applyManualCatDraft(draft);
        } else {
            resetManualCatForm();
        }
        state.manualDraftHydrated = true;
    }

    if (typeof manualCatDialog.showModal === "function") {
        manualCatDialog.showModal();
    } else {
        manualCatDialog.setAttribute("open", "true");
    }
}

export function closeManualCatDialog() {
    if (!manualCatDialog) {
        return;
    }
    if (typeof manualCatDialog.close === "function") {
        manualCatDialog.close();
    } else {
        manualCatDialog.removeAttribute("open");
    }
}

export function getManualCatEntryFromForm() {
    if (!manualCatForm) {
        return null;
    }

    return getManualCatEntryFromFormData(new FormData(manualCatForm));
}

export function suppressNextManualDraftSave() {
    state.suppressManualDraftSaveOnClose = true;
}

export function consumeManualDraftSaveSuppression() {
    if (!state.suppressManualDraftSaveOnClose) {
        return false;
    }
    state.suppressManualDraftSaveOnClose = false;
    return true;
}
