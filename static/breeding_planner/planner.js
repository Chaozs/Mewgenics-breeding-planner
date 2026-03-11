import { createCurrentCatsController } from "./planner/current-cats.js";
import { loadOpenAiStatus, loadPlannerConfig, savePlannerConfigValues, streamPlannerAnalysis } from "./planner/analysis.js";
import {
    appendLiveAnalysisOutput,
    appendLiveAnalysisStatus,
    buildSectionCard,
    clearSectionStatus,
    clearRecommendations,
    hideFollowupPanel,
    renderNoDataState,
    renderStorageMessage,
    startLiveAnalysisView,
    renderStructuredAnalysis,
    renderValidationErrors,
} from "./planner/recommendations.js";
import {
    ACTION_HISTORY_LIMIT,
    ACTION_LABELS,
    addCatBtn,
    addSkillMappingRow,
    addSkillMappingBtn,
    analyzeCatsBtn,
    catsImportInput,
    clearImportInputBtn,
    clearManualDraftBtn,
    clearStoredRowsBtn,
    closeManualCatBtn,
    currentCatsView,
    currentCatsStatus,
    followupResponseInput,
    importPanel,
    importStatus,
    loading,
    manualCatDialog,
    manualCatForm,
    manualParseDropzone,
    manualParseFileInput,
    manualParseLockNotice,
    manualParsePreview,
    manualParseSection,
    manualParseStatus,
    plannerAiLockNotice,
    plannerAiSection,
    resultStructured,
    saveImportToStorageBtn,
    sendFollowupBtn,
    setStoredCatsText,
    getStoredCatsText,
    getStoredEntries,
    getStoredRowCount,
    PLANNER_CONFIG_FIELDS,
    renderSkillMappingRows,
    serializeEntries,
    skillMappingsList,
    state,
    undoActionBtn,
    updateStorageMeta,
    validateAndNormalizeCatsData,
    getOpenAiUnavailableMessage,
    isOpenAiFeatureEnabled,
    setOpenAiAvailability,
} from "./planner/shared.js";
import {
    buildManualCatFields,
    clearManualCatDraft,
    closeManualCatDialog,
    consumeManualDraftSaveSuppression,
    extractImageFromClipboardEvent,
    getManualCatEntryFromForm,
    openManualCatDialog,
    parseScreenshotForManualForm,
    resetManualCatForm,
    saveManualCatDraft,
    setManualCatError,
    setManualParseStatus,
    suppressNextManualDraftSave,
} from "./planner/manual-cat.js";

const actionHistory = [];

function clearAnalysisState() {
    state.latestAnalysisText = "";
    clearRecommendations();
}

function updateUndoButtonState() {
    if (!undoActionBtn) {
        return;
    }

    const hasHistory = actionHistory.length > 0;
    undoActionBtn.disabled = !hasHistory;
    undoActionBtn.title = hasHistory ? `Undo ${actionHistory[actionHistory.length - 1].label}` : "Undo";
}

function clearActionHistory() {
    actionHistory.length = 0;
    updateUndoButtonState();
}

function pushActionHistory(snapshot, label) {
    actionHistory.push({ snapshot, label });
    if (actionHistory.length > ACTION_HISTORY_LIMIT) {
        actionHistory.shift();
    }
    updateUndoButtonState();
}

const catsController = createCurrentCatsController({
    getStoredEntries,
    getStoredCatsText,
    persistEntries,
    persistEntriesWithOptions,
    pushActionHistory,
});

function persistEntries(entries) {
    persistEntriesWithOptions(entries, { rerender: true, clearRecommendationsAfter: true });
}

function persistEntriesWithOptions(entries, options = {}) {
    const {
        rerender = true,
        clearRecommendationsAfter = true,
        preserveScroll = false,
    } = options;

    setStoredCatsText(serializeEntries(entries));
    updateStorageMeta();

    if (rerender) {
        catsController.renderCurrentCatsView({ preserveScroll });
    }
    if (clearRecommendationsAfter) {
        clearAnalysisState();
    }
    if (entries.length === 0) {
        renderNoDataState();
    }
}

function undoLastAction() {
    if (!actionHistory.length) {
        return;
    }

    const last = actionHistory.pop();
    updateUndoButtonState();

    setStoredCatsText(last.snapshot);
    updateStorageMeta();
    catsController.renderCurrentCatsView();
    clearAnalysisState();

    if (getStoredRowCount() === 0) {
        renderNoDataState();
        return;
    }

    renderStorageMessage("Undo Applied", [`Reverted ${last.label}.`], "move-section", {
        target: currentCatsStatus,
    });
}

function focusImportPanel() {
    if (importPanel) {
        importPanel.open = true;
    }
    if (catsImportInput) {
        catsImportInput.focus();
    }
}

function showRequestError(message, title = "Error") {
    if (!resultStructured) {
        return;
    }

    resultStructured.innerHTML = "";
    resultStructured.appendChild(buildSectionCard(title, [message], "strong-section"));
    hideFollowupPanel();
}

function setPlannerAiLocked(locked, message = "") {
    if (!plannerAiSection) {
        return;
    }

    plannerAiSection.classList.toggle("feature-locked", locked);

    if (plannerAiLockNotice) {
        plannerAiLockNotice.hidden = !locked;
        plannerAiLockNotice.textContent = locked ? message : "";
    }

    plannerAiSection.querySelectorAll("details").forEach((details) => {
        details.classList.toggle("feature-locked-panel", locked);
        if (locked) {
            details.open = false;
        }
        const summary = details.querySelector("summary");
        if (summary) {
            summary.setAttribute("aria-disabled", locked ? "true" : "false");
            summary.tabIndex = locked ? -1 : 0;
        }
    });

    plannerAiSection
        .querySelectorAll("textarea, input, select, button")
        .forEach((control) => {
            control.disabled = locked;
        });

    if (followupPanel) {
        followupPanel.hidden = locked || followupPanel.hidden;
    }
}

function setManualParseLocked(locked, message = "") {
    if (manualParseSection) {
        manualParseSection.classList.toggle("feature-locked", locked);
    }
    if (manualParseDropzone) {
        manualParseDropzone.classList.toggle("feature-locked-dropzone", locked);
    }
    if (manualParsePreview) {
        manualParsePreview.classList.toggle("feature-locked-preview", locked);
    }
    if (manualParseFileInput) {
        manualParseFileInput.disabled = locked;
    }
    if (manualParseLockNotice) {
        manualParseLockNotice.hidden = !locked;
        manualParseLockNotice.textContent = locked ? message : "";
    }
    if (manualParseStatus) {
        manualParseStatus.hidden = locked;
    }
    if (!locked) {
        setManualParseStatus("Waiting for screenshot...");
    }
}

function applyOpenAiStatus(status) {
    const enabled = Boolean(status?.enabled);
    const message = String(status?.message || "OpenAI features are unavailable.");
    setOpenAiAvailability(enabled, message);
    setPlannerAiLocked(!enabled, message);
    setManualParseLocked(!enabled, message);
}

async function runAnalysis(endpoint, options = {}) {
    const {
        followupRequest = "",
        previousAnalysis = "",
        busyButton = null,
    } = options;

    if (!isOpenAiFeatureEnabled()) {
        showRequestError(getOpenAiUnavailableMessage(), followupRequest ? "Follow-up Disabled" : "Feature Disabled");
        return;
    }

    if (loading) {
        loading.style.display = "block";
    }
    if (busyButton) {
        busyButton.disabled = true;
    }
    if (resultStructured) {
        resultStructured.innerHTML = "";
    }
    startLiveAnalysisView(followupRequest ? "Preparing follow-up analysis..." : "Preparing planner analysis...");

    try {
        const result = await streamPlannerAnalysis({
            endpoint,
            followupRequest,
            previousAnalysis,
            onStatus: appendLiveAnalysisStatus,
            onOutputDelta: appendLiveAnalysisOutput,
        });

        if (!result.ok) {
            if (result.reason === "no-data") {
                if (loading) {
                    loading.style.display = "none";
                }
                renderNoDataState(true);
                focusImportPanel();
                return;
            }

            if (result.reason === "validation") {
                renderValidationErrors(result.errors);
                return;
            }

            throw new Error(result.error || "Unknown request error.");
        }

        state.latestAnalysisText = result.analysis;
        renderStructuredAnalysis(state.latestAnalysisText);
    } catch (err) {
        console.error(err);
        showRequestError(err.message, followupRequest ? "Follow-up Error" : "Error");
    } finally {
        if (loading) {
            loading.style.display = "none";
        }
        if (busyButton) {
            busyButton.disabled = false;
        }
    }
}

async function analyzeCats() {
    await runAnalysis("/analyze-stream", {
        busyButton: analyzeCatsBtn,
    });
}

async function submitFollowup() {
    if (!followupResponseInput) {
        return;
    }

    const followupText = followupResponseInput.value.trim();
    if (!followupText) {
        followupResponseInput.focus();
        return;
    }

    await runAnalysis("/analyze-followup-stream", {
        followupRequest: followupText,
        previousAnalysis: state.latestAnalysisText,
        busyButton: sendFollowupBtn,
    });
}

if (analyzeCatsBtn) {
    analyzeCatsBtn.addEventListener("click", () => {
        analyzeCats();
    });
}

if (saveImportToStorageBtn) {
    saveImportToStorageBtn.addEventListener("click", () => {
        const raw = catsImportInput ? catsImportInput.value : "";
        if (!raw.trim()) {
            if (catsImportInput) {
                catsImportInput.classList.add("input-error");
            }
            renderStorageMessage(
                "No Import Data",
                ["Paste spreadsheet rows in Import Excel Data before saving."],
                "maybe-section",
                { target: importStatus }
            );
            focusImportPanel();
            return;
        }

        const validation = validateAndNormalizeCatsData(raw, { validateMutations: false });
        if (validation.errors.length > 0) {
            if (catsImportInput) {
                catsImportInput.classList.add("input-error");
            }
            renderValidationErrors(validation.errors, { target: importStatus, includeHowTo: false });
            focusImportPanel();
            return;
        }

        if (catsImportInput) {
            catsImportInput.classList.remove("input-error");
        }
        clearSectionStatus(importStatus);
        setStoredCatsText(validation.normalizedCats);
        clearActionHistory();
        updateStorageMeta();
        catsController.renderCurrentCatsView();
        clearAnalysisState();
        renderStorageMessage(
            "Browser Data Updated",
            [`Saved ${getStoredRowCount()} row(s) to browser data.`],
            "move-section",
            { target: importStatus }
        );
        if (validation.warnings.length > 0 && importStatus) {
            importStatus.appendChild(
                buildSectionCard(
                    "Import Warnings",
                    validation.warnings,
                    "maybe-section"
                )
            );
        }
    });
}

if (clearImportInputBtn) {
    clearImportInputBtn.addEventListener("click", () => {
        if (catsImportInput) {
            catsImportInput.value = "";
            catsImportInput.classList.remove("input-error");
        }
        clearSectionStatus(importStatus);
        clearAnalysisState();
    });
}

if (clearStoredRowsBtn) {
    clearStoredRowsBtn.addEventListener("click", () => {
        setStoredCatsText("");
        clearActionHistory();
        updateStorageMeta();
        catsController.renderCurrentCatsView();
        state.latestAnalysisText = "";
        renderStorageMessage("Browser Data Cleared", ["Removed all stored cat rows."], "maybe-section", {
            target: currentCatsStatus,
        });
        renderNoDataState();
    });
}

if (addCatBtn) {
    addCatBtn.addEventListener("click", () => {
        openManualCatDialog();
    });
}

if (undoActionBtn) {
    undoActionBtn.addEventListener("click", () => {
        undoLastAction();
    });
}

if (sendFollowupBtn) {
    sendFollowupBtn.addEventListener("click", () => {
        submitFollowup();
    });
}

if (closeManualCatBtn) {
    closeManualCatBtn.addEventListener("click", () => {
        closeManualCatDialog();
    });
}

if (clearManualDraftBtn) {
    clearManualDraftBtn.addEventListener("click", () => {
        clearManualCatDraft();
        resetManualCatForm();
    });
}

if (manualCatDialog) {
    manualCatDialog.addEventListener("close", () => {
        if (consumeManualDraftSaveSuppression()) {
            return;
        }
        saveManualCatDraft();
    });
}

if (manualCatForm) {
    manualCatForm.addEventListener("input", () => {
        saveManualCatDraft();
    });

    manualCatForm.addEventListener("change", () => {
        saveManualCatDraft();
    });

    manualCatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const result = getManualCatEntryFromForm();
        if (!result || !result.entry) {
            setManualCatError(result?.error || "Could not add cat.");
            return;
        }

        const entries = getStoredEntries();
        const beforeSnapshot = serializeEntries(entries);
        entries.push(result.entry);
        pushActionHistory(beforeSnapshot, `${ACTION_LABELS.add} (${result.entry.columns[0]})`);
        persistEntries(entries);
        suppressNextManualDraftSave();
        clearManualCatDraft();
        resetManualCatForm();
        closeManualCatDialog();
        renderStorageMessage("Cat Added", [`Added ${result.entry.columns[0]} to ${result.entry.room}.`], "move-section", {
            target: currentCatsStatus,
        });
    });
}

if (catsImportInput) {
    catsImportInput.addEventListener("input", () => {
        if (catsImportInput.value.trim()) {
            catsImportInput.classList.remove("input-error");
        }
        clearSectionStatus(importStatus);
        clearAnalysisState();
    });

    catsImportInput.addEventListener("paste", () => {
        catsImportInput.classList.remove("input-error");
        clearSectionStatus(importStatus);
        clearAnalysisState();
    });
}

[...PLANNER_CONFIG_FIELDS.map((field) => field.element)]
    .filter(Boolean)
    .forEach((element) => {
        element.addEventListener("input", () => {
            clearAnalysisState();
            savePlannerConfigValues();
        });
    });

if (addSkillMappingBtn) {
    addSkillMappingBtn.addEventListener("click", () => {
        if (!isOpenAiFeatureEnabled()) {
            return;
        }
        addSkillMappingRow();
        clearAnalysisState();
        savePlannerConfigValues();
    });
}

if (skillMappingsList) {
    skillMappingsList.addEventListener("input", () => {
        if (!isOpenAiFeatureEnabled()) {
            return;
        }
        clearAnalysisState();
        savePlannerConfigValues();
    });

    skillMappingsList.addEventListener("click", (event) => {
        const removeButton = event.target.closest('[data-action="remove-skill-mapping"]');
        if (!removeButton) {
            return;
        }

        const row = removeButton.closest("[data-skill-mapping-row]");
        if (!row) {
            return;
        }

        row.remove();
        if (!skillMappingsList.querySelector("[data-skill-mapping-row]")) {
            renderSkillMappingRows();
        }
        clearAnalysisState();
        savePlannerConfigValues();
    });
}

if (manualParseFileInput) {
    manualParseFileInput.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        await parseScreenshotForManualForm(file, { keepCurrentForm: true });
    });
}

if (manualParseDropzone) {
    manualParseDropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        manualParseDropzone.classList.add("dragover");
    });

    manualParseDropzone.addEventListener("dragleave", () => {
        manualParseDropzone.classList.remove("dragover");
    });

    manualParseDropzone.addEventListener("drop", async (event) => {
        event.preventDefault();
        manualParseDropzone.classList.remove("dragover");

        const file = event.dataTransfer?.files?.[0];
        if (!file) {
            setManualParseStatus("No dropped file found.", true);
            return;
        }

        if (!file.type.startsWith("image/")) {
            setManualParseStatus("Dropped file is not an image.", true);
            return;
        }

        await parseScreenshotForManualForm(file, { keepCurrentForm: true });
    });
}

document.addEventListener("paste", async (event) => {
    if (document.activeElement === catsImportInput) {
        return;
    }

    const imageFile = extractImageFromClipboardEvent(event);
    if (!imageFile) {
        return;
    }

    if (!isOpenAiFeatureEnabled()) {
        event.preventDefault();
        openManualCatDialog();
        return;
    }

    event.preventDefault();
    await parseScreenshotForManualForm(imageFile, { keepCurrentForm: Boolean(manualCatDialog?.open) });
});

if (currentCatsView) {
    currentCatsView.addEventListener("click", catsController.handleRowAction);
    currentCatsView.addEventListener("input", catsController.handleCellEditInput);
    currentCatsView.addEventListener("change", catsController.handleCellEditChange);
    currentCatsView.addEventListener("dragstart", catsController.handleRowDragStart);
    currentCatsView.addEventListener("dragover", catsController.handleRowDragOver);
    currentCatsView.addEventListener("drop", catsController.handleRowDrop);
    currentCatsView.addEventListener("dragend", catsController.handleRowDragEnd);
}

buildManualCatFields();
renderSkillMappingRows();
loadOpenAiStatus()
    .then((status) => {
        applyOpenAiStatus(status);
    })
    .catch((err) => {
        console.error(err);
    });
loadPlannerConfig().catch((err) => {
    console.error(err);
});
updateStorageMeta();
catsController.renderCurrentCatsView();
updateUndoButtonState();
if (!getStoredCatsText().trim()) {
    renderNoDataState();
}
