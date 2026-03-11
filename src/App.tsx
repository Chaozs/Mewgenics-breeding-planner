import { useEffect, useMemo, useState } from "react";
import { CurrentCatsPanel } from "./components/CurrentCatsPanel";
import { ManualCatDialog } from "./components/ManualCatDialog";
import { PlannerSection } from "./components/PlannerSection";
import { SectionCard } from "./components/Cards";
import { parseScreenshotForManualForm } from "./planner/api";
import { usePlannerAnalysis } from "./hooks/usePlannerAnalysis";
import { usePlannerConfigState } from "./hooks/usePlannerConfigState";
import { useQuickstartState } from "./hooks/useQuickstartState";
import { useStoredCatsState } from "./hooks/useStoredCatsState";
import { getEnabledRooms } from "./planner/room-config";
import type { ManualDraft, MessageCard } from "./types";
import {
  clearManualCatDraft,
  createManualFormValues,
  getManualCatDraft,
  getManualCatEntryFromValues,
  getOrderedRooms,
  groupEntriesByRoom,
  parseSkillMappings,
  parseStoredEntries,
  sanitizeLiveOutputText,
  serializeEntries,
  serializeEntriesForSpreadsheet,
  setManualCatDraft,
  validateAndNormalizeCatsData,
  moveEntryByDrop,
  moveEntryToRoom,
  normalizeEntryColumnValue,
} from "./planner/utils";

type DropTarget = {
  type: "row" | "room";
  rowIndex?: number;
  room: string;
  placeAfter: boolean;
};

type ParseStatus = {
  text: string;
  isError: boolean;
};

type ActionHistorySnapshot = {
  rawText: string;
  ids: string[];
};

function App() {
  const { plannerConfigLoaded, plannerConfig, setPlannerConfig, openAiStatus } = usePlannerConfigState();
  const [importText, setImportText] = useState("");
  const [importCards, setImportCards] = useState<MessageCard[]>([]);
  const [currentCatsCards, setCurrentCatsCards] = useState<MessageCard[]>([]);
  const { quickstartOpen, setQuickstartOpen } = useQuickstartState();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValues, setManualValues] = useState<Record<string, string>>(createManualFormValues());
  const [manualParseStatus, setManualParseStatus] = useState<ParseStatus>({ text: "Waiting for screenshot...", isError: false });
  const [manualCatError, setManualCatError] = useState("");
  const [manualPreviewUrl, setManualPreviewUrl] = useState("");
  const [actionHistory, setActionHistory] = useState<ActionHistorySnapshot[]>([]);
  const [dragState, setDragState] = useState<{ sourceIndex: number | null; dropTarget: DropTarget | null }>({
    sourceIndex: null,
    dropTarget: null,
  });

  const skillMappingsMap = useMemo(() => parseSkillMappings(plannerConfig.skillMappings), [plannerConfig.skillMappings]);
  const { storedCatsText, storedCatIds, parsedStored, writeStoredData } = useStoredCatsState(skillMappingsMap);
  const groupedEntries = useMemo(() => groupEntriesByRoom(parsedStored.rows, (entry, index) => ({ entry, index })), [parsedStored.rows]);
  const orderedRooms = useMemo(() => getOrderedRooms(groupedEntries), [groupedEntries]);
  const plannerLocked = !openAiStatus.enabled;
  const manualParseLocked = !openAiStatus.enabled;

  function pushActionSnapshot(snapshot: ActionHistorySnapshot) {
    setActionHistory((current) => [...current, snapshot].slice(-100));
  }

  const {
    analysisState,
    followupInput,
    setFollowupInput,
    clearAnalysis,
    persistNextEntries,
    handleAnalyze,
    handleApplyRecommendationAction,
    isRecommendationActionApplied,
  } = usePlannerAnalysis({
    plannerConfig,
    plannerLocked,
    plannerLockMessage: openAiStatus.message,
    parsedRows: parsedStored.rows,
    storedCatsText,
    storedCatIds,
    skillMappingsMap,
    pushActionSnapshot,
    writeStoredData,
    showCurrentCatsCards: setCurrentCatsCards,
  });

  useEffect(() => {
    if (!plannerConfigLoaded) {
      return;
    }

    const draft = getManualCatDraft();
    if (!draft) {
      return;
    }

    setManualValues((current) => ({ ...current, ...draft.values }));
    setManualCatError(draft.manualCatErrorText || "");
    if (openAiStatus.enabled && draft.parseStatusText) {
      setManualParseStatus({ text: draft.parseStatusText, isError: Boolean(draft.parseStatusIsError) });
    }
  }, [openAiStatus.enabled, plannerConfigLoaded]);

  useEffect(() => {
    const draft: ManualDraft = {
      values: manualValues,
      parseStatusText: manualParseLocked ? "" : manualParseStatus.text,
      parseStatusIsError: manualParseStatus.isError,
      manualCatErrorText: manualCatError,
    };
    setManualCatDraft(draft);
  }, [manualCatError, manualParseLocked, manualParseStatus, manualValues]);

  useEffect(() => () => {
    if (manualPreviewUrl) {
      URL.revokeObjectURL(manualPreviewUrl);
    }
  }, [manualPreviewUrl]);

  useEffect(() => {
    function handleWindowPaste(event: ClipboardEvent) {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.id === "catsImportInput") {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          if (manualParseLocked) {
            event.preventDefault();
            setManualOpen(true);
            return;
          }

          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            setManualOpen(true);
            void handleManualParse(file);
          }
          return;
        }
      }
    }

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [manualParseLocked, plannerConfig.skillMappings, manualPreviewUrl]);

  function handleImportSave() {
    if (!importText.trim()) {
      setImportCards([{ title: "No Import Data", items: ["Paste spreadsheet rows in Import Excel Data before saving."], className: "maybe-section" }]);
      return;
    }

    const validation = validateAndNormalizeCatsData(importText, skillMappingsMap, false, false);
    if (validation.errors.length > 0) {
      setImportCards([{ title: "Invalid Spreadsheet Format", items: validation.errors, className: "strong-section" }]);
      return;
    }

    const imported = parseStoredEntries(validation.normalizedCats, skillMappingsMap, []);
    writeStoredData(serializeEntries(imported.rows), imported.rows.map((entry) => entry.id));
    setActionHistory([]);
    clearAnalysis({ hasRows: imported.rows.length > 0 });

    const cards: MessageCard[] = [{
      title: "Browser Data Updated",
      items: [`Saved ${imported.rows.length} row(s) to browser data.`],
      className: "move-section",
    }];
    if (validation.warnings.length > 0) {
      cards.push({ title: "Import Warnings", items: validation.warnings, className: "maybe-section" });
    }
    setImportCards(cards);
  }

  async function handleManualParse(file: File) {
    if (manualParseLocked) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setManualParseStatus({ text: "Selected file is not an image.", isError: true });
      return;
    }

    if (manualPreviewUrl) {
      URL.revokeObjectURL(manualPreviewUrl);
    }
    setManualPreviewUrl(URL.createObjectURL(file));
    setManualParseStatus({ text: "Parsing cat...", isError: false });

    try {
      const parsedEntry = await parseScreenshotForManualForm(file, plannerConfig.skillMappings);
      setManualValues(createManualFormValues(parsedEntry));
      setManualParseStatus({ text: "Parsed successfully.", isError: false });
      setManualCatError("");
    } catch (error) {
      console.error(error);
      setManualParseStatus({ text: `Error: ${error instanceof Error ? error.message : "Could not parse screenshot."}`, isError: true });
    }
  }

  function handleManualSubmit() {
    const result = getManualCatEntryFromValues(manualValues, skillMappingsMap);
    if (!("entry" in result) || !result.entry) {
      setManualCatError(result.error || "Could not add cat.");
      return;
    }
    const nextEntry = result.entry;
    persistNextEntries([...parsedStored.rows, nextEntry], {
      title: "Cat Added",
      items: [`Added ${nextEntry.columns[0]} to ${nextEntry.room}.`],
      className: "move-section",
    });
    clearManualCatDraft();
    setManualOpen(false);
    setManualValues(createManualFormValues());
    setManualCatError("");
    setManualParseStatus(manualParseLocked ? { text: "", isError: true } : { text: "Waiting for screenshot...", isError: false });
    if (manualPreviewUrl) {
      URL.revokeObjectURL(manualPreviewUrl);
      setManualPreviewUrl("");
    }
  }

  async function handleExportSpreadsheetData() {
    const exportText = serializeEntriesForSpreadsheet(parsedStored.rows);
    if (!exportText) {
      setCurrentCatsCards([{ title: "No Cats to Export", items: ["Add or import cats before exporting spreadsheet data."], className: "maybe-section" }]);
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = exportText;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCurrentCatsCards([{
        title: "Spreadsheet Data Copied",
        items: ["Copied spreadsheet-ready cat data to your clipboard. Empty BreedWith and mutation fields were exported as X so the rows paste cleanly into Excel."],
        className: "move-section",
      }]);
    } catch (error) {
      console.error(error);
      setCurrentCatsCards([{
        title: "Export Failed",
        items: ["Could not copy spreadsheet data to the clipboard."],
        className: "strong-section",
      }]);
    }
  }

  return (
    <>
      <main className="app-shell">
        <header className="panel topbar planner-hero">
          <div>
            <p className="eyebrow">Mewgenics</p>
            <h1>Breeding Planner</h1>
            <p className="subtitle">Import or add cats, organize them by room, then generate structured trim and move recommendations.</p>
          </div>
        </header>

        <details className="panel import-panel planner-centered quickstart-panel" open={quickstartOpen} onToggle={(event) => setQuickstartOpen((event.currentTarget as HTMLDetailsElement).open)}>
          <summary className="import-summary">Quick Start</summary>
          <div className="import-content">
            <div className="quickstart-header">
              <div>
                <p className="field-help">Use the planner in this order. If you skip a step, the sections below still work independently.</p>
              </div>
            </div>
            <div className="quickstart-grid">
              <section className="quickstart-step">
                <span className="quickstart-step-number">1</span>
                <div>
                  <h3>Load your cats</h3>
                  <p>Use <strong>Import Excel Data</strong> for bulk paste, or <strong>Add Cat</strong> for manual entry and screenshot parsing.</p>
                </div>
              </section>
              <section className="quickstart-step">
                <span className="quickstart-step-number">2</span>
                <div>
                  <h3>Review Current Cat Rows</h3>
                  <p>Edit values, move cats between rooms, reorder rows, and fix any red invalid mutation warnings before analysis.</p>
                </div>
              </section>
              <section className="quickstart-step">
                <span className="quickstart-step-number">3</span>
                <div>
                  <h3>Analyze and apply recommendations</h3>
                  <p>Optionally adjust skill mappings or planner settings, click <strong>Analyze Cats</strong>, then apply supported move/delete actions directly from the results.</p>
                </div>
              </section>
            </div>
            <div className="quickstart-note-grid">
              <div className="quickstart-note">
                <strong>Does not need a ChatGPT API key</strong>
                <span>Importing rows, manually editing cats, filtering, reordering, and local browser storage all work without an API key.</span>
              </div>
              <div className="quickstart-note">
                <strong>Needs a ChatGPT API key</strong>
                <span>Screenshot parsing, planner recommendations, and planner follow-up requests require a valid OpenAI API key.</span>
              </div>
            </div>
          </div>
        </details>

        <details id="importPanel" className="panel import-panel planner-centered">
          <summary className="import-summary">Import Excel Data</summary>
          <div className="import-content">
            <label className="section-label" htmlFor="catsImportInput">Paste Spreadsheet Rows</label>
            <p className="field-help">Paste tab-separated cat rows from your spreadsheet here, then save them into this browser.</p>
            <div className="planner-guidance-box import-example-box">
              <strong>Expected column order</strong>
              <span>Each pasted row should contain these 25 tab-separated columns, in this exact order:</span>
              <pre className="import-example-code">Cat	Gender	BreedWith	Str	Dex	Health	Int	Move	Char	Luck	Body	Head	Tail	Leg	Leg	Arm	Arm	Eye	Eye	Eyebrow	Eyebrow	Ear	Ear	Mouth	Fur</pre>
              <span>Example row:</span>
              <pre className="import-example-code">Pippy	F	M	7	7	7	6	7	5	7	+1dex(body)			tileImmunity(leg)		randomDebuff(arm)	reflect(eye)				leech(mouth)	+1int(fur)</pre>
            </div>
            <textarea id="catsImportInput" rows={14} value={importText} onChange={(event) => { setImportText(event.target.value); setImportCards([]); clearAnalysis(); }} />
            <div className="buttons compact">
              <button type="button" className="primary-btn" onClick={handleImportSave}>Save to Browser Data</button>
              <button type="button" className="secondary-btn" onClick={() => { setImportText(""); setImportCards([]); clearAnalysis(); }}>Clear Pasted Data</button>
            </div>
            <div className="section-status" hidden={importCards.length === 0}>
              {importCards.map((card, index) => <SectionCard key={`${card.title}-${index}`} {...card} />)}
            </div>
          </div>
        </details>

        <CurrentCatsPanel
          entries={parsedStored.rows}
          invalidLines={parsedStored.invalidLines}
          priorityOrder={plannerConfig.priorityOrder}
          orderedRooms={orderedRooms}
          groupedEntries={groupedEntries}
          actionHistoryCount={actionHistory.length}
          statusCards={currentCatsCards}
          dragState={dragState}
          onOpenManual={() => setManualOpen(true)}
          onExport={() => void handleExportSpreadsheetData()}
          onUndo={() => {
            const snapshot = actionHistory[actionHistory.length - 1];
            if (!snapshot) {
              return;
            }
            setActionHistory((current) => current.slice(0, -1));
            writeStoredData(snapshot.rawText, snapshot.ids);
            clearAnalysis();
            setCurrentCatsCards([{ title: "Undo Applied", items: ["Reverted the last row change."], className: "move-section" }]);
          }}
          onClear={() => {
            writeStoredData("", []);
            setActionHistory([]);
            setCurrentCatsCards([{ title: "All Cats Cleared", items: ["Removed all stored cat rows from this browser."], className: "maybe-section" }]);
            clearAnalysis({ hasRows: false });
          }}
          onDelete={(index) => {
            if (index < 0 || index >= parsedStored.rows.length) {
              return;
            }
            persistNextEntries(parsedStored.rows.filter((_, entryIndex) => entryIndex !== index), {
              title: "Row Deleted",
              items: [`Deleted ${parsedStored.rows[index].columns[0] || "cat"}.`],
              className: "maybe-section",
            });
          }}
          onMoveRoom={(index, targetRoom) => {
            const nextEntries = moveEntryToRoom(parsedStored.rows, index, targetRoom);
            if (serializeEntries(nextEntries) !== storedCatsText) {
              persistNextEntries(nextEntries, {
                title: "Row Moved",
                items: [`Moved ${(parsedStored.rows[index]?.columns[0] || "cat")} to ${targetRoom}.`],
                className: "move-section",
              });
            }
          }}
          onCellChange={(rowIndex, columnIndex, value) => {
            const nextEntries = parsedStored.rows.map((entry, entryIndex) => entryIndex !== rowIndex
              ? entry
              : { ...entry, columns: normalizeEntryColumnValue(columnIndex, value, entry.columns, skillMappingsMap) });
            writeStoredData(serializeEntries(nextEntries), nextEntries.map((entry) => entry.id));
            clearAnalysis();
          }}
          onDragStart={(rowIndex) => setDragState({ sourceIndex: rowIndex, dropTarget: null })}
          onDragOver={(target) => setDragState((current) => ({ ...current, dropTarget: target }))}
          onDrop={(target) => {
            if (dragState.sourceIndex === null) {
              return;
            }
            const nextEntries = moveEntryByDrop(parsedStored.rows, dragState.sourceIndex, target);
            setDragState({ sourceIndex: null, dropTarget: null });
            if (serializeEntries(nextEntries) !== storedCatsText) {
              persistNextEntries(nextEntries, { title: "Rows Reordered", items: ["Updated row order."], className: "move-section" });
            }
          }}
          onDragEnd={() => setDragState({ sourceIndex: null, dropTarget: null })}
        />

        <PlannerSection
          plannerConfig={plannerConfig}
          plannerLocked={plannerLocked}
          plannerLockMessage={openAiStatus.message}
          analysisState={analysisState}
          followupInput={followupInput}
          onConfigChange={(key, value) => { setPlannerConfig((current) => ({ ...current, [key]: value })); clearAnalysis(); }}
          onRoomEnabledChange={(key, value) => { setPlannerConfig((current) => ({ ...current, [key]: value })); clearAnalysis(); }}
          onSkillMappingChange={(index, key, value) => {
            setPlannerConfig((current) => ({
              ...current,
              skillMappings: current.skillMappings.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
            }));
            clearAnalysis();
          }}
          onAddSkillMapping={() => { setPlannerConfig((current) => ({ ...current, skillMappings: [...current.skillMappings, { source: "", target: "" }] })); clearAnalysis(); }}
          onRemoveSkillMapping={(index) => {
            setPlannerConfig((current) => ({
              ...current,
              skillMappings: current.skillMappings.filter((_, rowIndex) => rowIndex !== index).length > 0
                ? current.skillMappings.filter((_, rowIndex) => rowIndex !== index)
                : [{ source: "", target: "" }],
            }));
            clearAnalysis();
          }}
          onAnalyze={() => void handleAnalyze("/analyze-stream")}
          onFollowupInputChange={setFollowupInput}
          onSendFollowup={() => void handleAnalyze("/analyze-followup-stream", followupInput)}
          onApplyRecommendationAction={handleApplyRecommendationAction}
          isRecommendationActionApplied={isRecommendationActionApplied}
        />
      </main>

      <footer className="planner-footer">
        <p>Fan-made tool. Not affiliated with or endorsed by Mewgenics or its creators. Created by Chaozs.</p>
      </footer>

      <ManualCatDialog
        open={manualOpen}
        values={manualValues}
        parseLocked={manualParseLocked}
        parseLockMessage={openAiStatus.message}
        parseStatus={manualParseStatus}
        manualCatError={manualCatError}
        previewUrl={manualPreviewUrl}
        onClose={() => setManualOpen(false)}
        onClearDraft={() => {
          clearManualCatDraft();
          setManualValues(createManualFormValues());
          setManualCatError("");
          setManualParseStatus(manualParseLocked ? { text: "", isError: true } : { text: "Waiting for screenshot...", isError: false });
          if (manualPreviewUrl) {
            URL.revokeObjectURL(manualPreviewUrl);
            setManualPreviewUrl("");
          }
        }}
        onSubmit={handleManualSubmit}
        onValueChange={(key, value) => setManualValues((current) => ({ ...current, [key]: value }))}
        onFileChange={(file) => void handleManualParse(file)}
        onPaste={(event) => {
          if (manualParseLocked) {
            return;
          }
          const items = event.clipboardData?.items;
          if (!items) {
            return;
          }
          for (const item of Array.from(items)) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                void handleManualParse(file);
              }
              return;
            }
          }
        }}
      />
    </>
  );
}

export default App;
