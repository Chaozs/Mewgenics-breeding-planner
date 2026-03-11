import { useCallback, useEffect, useState } from "react";

import { streamPlannerAnalysis } from "../planner/api";
import { buildStructuredResult, getNoDataCards, getRecommendationActionKey } from "../planner/app-state";
import { getEnabledRooms } from "../planner/room-config";
import { NO_DATA_STEPS, sanitizeLiveOutputText, serializeEntries, validateAndNormalizeCatsData } from "../planner/utils";
import type { Entry, MessageCard, PlannerAnalysisState, PlannerConfig, RecommendationAction } from "../types";

type RecommendationUndoState =
  | { kind: "restore-delete"; entry: Entry; index: number }
  | { kind: "undo-move"; entryId: string; previousRoom: string; previousIndex: number };

type ActionHistorySnapshot = {
  rawText: string;
  ids: string[];
};

type PersistOptions = {
  preserveAnalysis?: boolean;
};

type ClearAnalysisOptions = {
  hasRows?: boolean;
};

type UsePlannerAnalysisOptions = {
  plannerConfig: PlannerConfig;
  plannerLocked: boolean;
  plannerLockMessage: string;
  parsedRows: Entry[];
  storedCatsText: string;
  storedCatIds: string[];
  skillMappingsMap: Map<string, string>;
  pushActionSnapshot: (snapshot: ActionHistorySnapshot) => void;
  writeStoredData: (nextRaw: string, nextIds: string[]) => void;
  showCurrentCatsCards: (cards: MessageCard[]) => void;
};

function cloneEntry(entry: Entry): Entry {
  return {
    ...entry,
    columns: [...entry.columns],
  };
}

function getIdleState(hasRows: boolean): PlannerAnalysisState {
  return hasRows
    ? { mode: "idle", cards: [], followupPrompt: "" }
    : { mode: "idle", cards: getNoDataCards(false), followupPrompt: "" };
}

export function usePlannerAnalysis(options: UsePlannerAnalysisOptions) {
  const {
    plannerConfig,
    plannerLocked,
    plannerLockMessage,
    parsedRows,
    storedCatsText,
    storedCatIds,
    skillMappingsMap,
    pushActionSnapshot,
    writeStoredData,
    showCurrentCatsCards,
  } = options;

  const [analysisState, setAnalysisState] = useState<PlannerAnalysisState>(getIdleState(false));
  const [followupInput, setFollowupInput] = useState("");
  const [appliedRecommendationUndos, setAppliedRecommendationUndos] = useState<Record<string, RecommendationUndoState>>({});

  const clearAnalysis = useCallback((clearOptions: ClearAnalysisOptions = {}) => {
    const hasRows = clearOptions.hasRows ?? parsedRows.length > 0;
    setAppliedRecommendationUndos({});
    setAnalysisState(getIdleState(hasRows));
    setFollowupInput("");
  }, [parsedRows.length]);

  const persistNextEntries = useCallback((nextEntries: Entry[], statusCard?: MessageCard, persistOptions: PersistOptions = {}) => {
    pushActionSnapshot({ rawText: storedCatsText, ids: storedCatIds });
    writeStoredData(serializeEntries(nextEntries), nextEntries.map((entry) => entry.id));
    if (!persistOptions.preserveAnalysis) {
      clearAnalysis({ hasRows: nextEntries.length > 0 });
    }
    if (statusCard) {
      showCurrentCatsCards([statusCard]);
    }
  }, [clearAnalysis, pushActionSnapshot, showCurrentCatsCards, storedCatIds, storedCatsText, writeStoredData]);

  const handleAnalyze = useCallback(async (endpoint: string, followupRequest = "") => {
    if (plannerLocked) {
      setAnalysisState({
        mode: "error",
        cards: [{ title: "Feature Disabled", items: [plannerLockMessage], className: "strong-section" }],
        followupPrompt: "",
      });
      return;
    }

    if (!storedCatsText.trim()) {
      setAnalysisState({ mode: "error", cards: getNoDataCards(true), followupPrompt: "" });
      return;
    }

    const enabledRooms = getEnabledRooms(plannerConfig);
    const analysisEntries = parsedRows.filter((entry) => enabledRooms.has(entry.room));
    const analysisCats = serializeEntries(analysisEntries, { includeAnalysisIds: true });
    const validation = validateAndNormalizeCatsData(analysisCats, skillMappingsMap, true, true);
    if (validation.errors.length > 0) {
      setAnalysisState({
        mode: "error",
        cards: [
          { title: "Invalid Spreadsheet Format", items: validation.errors, className: "strong-section" },
          { title: "How to Use", items: NO_DATA_STEPS, className: "other-section" },
        ],
        followupPrompt: "",
      });
      return;
    }

    setAnalysisState({
      mode: "streaming",
      statuses: [followupRequest ? "Preparing follow-up analysis..." : "Preparing planner analysis..."],
      liveOutput: "",
      followupPrompt: "",
    });
    setAppliedRecommendationUndos({});

    const result = await streamPlannerAnalysis({
      endpoint,
      body: {
        cats: validation.normalizedCats,
        priorityOrder: plannerConfig.priorityOrder,
        roomAFocus: plannerConfig.roomAFocus,
        roomBFocus: plannerConfig.roomBEnabled ? plannerConfig.roomBFocus : "Disabled. Ignore Room B entirely in this analysis.",
        roomCFocus: plannerConfig.roomCEnabled ? plannerConfig.roomCFocus : "Disabled. Ignore Room C entirely in this analysis.",
        roomDFocus: plannerConfig.roomDEnabled ? plannerConfig.roomDFocus : "Disabled. Ignore Room D entirely in this analysis.",
        additionalPromptInstructions: plannerConfig.additionalPromptInstructions,
        skillMappings: plannerConfig.skillMappings.map((row) => `${row.source} => ${row.target}`).join("\n"),
        ...(followupRequest.trim()
          ? {
            followupRequest: followupRequest.trim(),
            previousAnalysis: analysisState.mode === "structured" ? analysisState.text : "",
          }
          : {}),
      },
      onStatus: (message) => {
        setAnalysisState((current) => current.mode !== "streaming" || !message || current.statuses[current.statuses.length - 1] === message
          ? current
          : { ...current, statuses: [...current.statuses, message] });
      },
      onOutputDelta: (delta) => {
        setAnalysisState((current) => current.mode !== "streaming"
          ? current
          : { ...current, liveOutput: sanitizeLiveOutputText(current.liveOutput + delta) });
      },
    });

    if (!result.ok) {
      if (result.reason === "validation") {
        setAnalysisState({
          mode: "error",
          cards: [
            { title: "Invalid Spreadsheet Format", items: result.errors || [], className: "strong-section" },
            { title: "How to Use", items: NO_DATA_STEPS, className: "other-section" },
          ],
          followupPrompt: "",
        });
        return;
      }
      setAnalysisState({
        mode: "error",
        cards: [{
          title: followupRequest ? "Follow-up Error" : "Error",
          items: [String(result.error || "Unknown request error.")],
          className: "strong-section",
        }],
        followupPrompt: "",
      });
      return;
    }

    const structured = buildStructuredResult(result.analysis);
    setAnalysisState({ mode: "structured", cards: structured.cards, followupPrompt: structured.followupPrompt, text: result.analysis });
    setFollowupInput("");
  }, [analysisState, parsedRows, plannerConfig, plannerLockMessage, plannerLocked, skillMappingsMap, storedCatsText]);

  const handleApplyRecommendationAction = useCallback((action: RecommendationAction) => {
    const actionKey = getRecommendationActionKey(action);
    const existingUndo = appliedRecommendationUndos[actionKey];
    if (existingUndo) {
      if (existingUndo.kind === "restore-delete") {
        if (parsedRows.some((entry) => entry.id === existingUndo.entry.id)) {
          setAppliedRecommendationUndos((current) => {
            const next = { ...current };
            delete next[actionKey];
            return next;
          });
          return;
        }

        const nextEntries = [...parsedRows];
        nextEntries.splice(
          Math.max(0, Math.min(existingUndo.index, nextEntries.length)),
          0,
          cloneEntry(existingUndo.entry),
        );
        persistNextEntries(nextEntries, {
          title: "Recommendation Undo Applied",
          items: [`Restored ${existingUndo.entry.columns[0] || "cat"} to browser data.`],
          className: "move-section",
        }, { preserveAnalysis: true });
      } else {
        const currentIndex = parsedRows.findIndex((entry) => entry.id === existingUndo.entryId);
        if (currentIndex < 0) {
          showCurrentCatsCards([{ title: "Undo Could Not Be Applied", items: ["That cat no longer exists in browser data."], className: "strong-section" }]);
          return;
        }

        const nextEntries = parsedRows.map((entry) => cloneEntry(entry));
        const [entry] = nextEntries.splice(currentIndex, 1);
        entry.room = existingUndo.previousRoom;
        nextEntries.splice(
          Math.max(0, Math.min(existingUndo.previousIndex, nextEntries.length)),
          0,
          entry,
        );
        persistNextEntries(nextEntries, {
          title: "Recommendation Undo Applied",
          items: [`Moved ${entry.columns[0] || "cat"} back to ${existingUndo.previousRoom}.`],
          className: "move-section",
        }, { preserveAnalysis: true });
      }

      setAppliedRecommendationUndos((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
      return;
    }

    const entryIndex = parsedRows.findIndex((entry) => entry.id === action.entryId);
    if (entryIndex < 0) {
      showCurrentCatsCards([{ title: "Action Could Not Be Applied", items: ["That recommendation no longer matches any current cat row."], className: "strong-section" }]);
      return;
    }

    if (action.kind === "delete") {
      const target = parsedRows[entryIndex];
      persistNextEntries(parsedRows.filter((entry) => entry.id !== action.entryId), {
        title: "Recommendation Applied",
        items: [`Deleted ${target.columns[0] || "cat"} from browser data.`],
        className: "move-section",
      }, { preserveAnalysis: true });
      setAppliedRecommendationUndos((current) => ({
        ...current,
        [actionKey]: {
          kind: "restore-delete",
          entry: cloneEntry(target),
          index: entryIndex,
        },
      }));
      return;
    }

    const target = parsedRows[entryIndex];
    if (target.room === action.targetRoom) {
      showCurrentCatsCards([{ title: "Action Already Applied", items: [`${target.columns[0] || "Cat"} is already in ${action.targetRoom}.`], className: "maybe-section" }]);
      return;
    }

    const nextEntries = parsedRows.map((entry) => entry.id === action.entryId ? { ...entry, room: action.targetRoom } : entry);
    persistNextEntries(nextEntries, {
      title: "Recommendation Applied",
      items: [`Moved ${target.columns[0] || "cat"} to ${action.targetRoom}.`],
      className: "move-section",
    }, { preserveAnalysis: true });
    setAppliedRecommendationUndos((current) => ({
      ...current,
      [actionKey]: {
        kind: "undo-move",
        entryId: action.entryId,
        previousRoom: target.room,
        previousIndex: entryIndex,
      },
    }));
  }, [appliedRecommendationUndos, parsedRows, persistNextEntries, showCurrentCatsCards]);

  const isRecommendationActionApplied = useCallback((action: RecommendationAction) => (
    Boolean(appliedRecommendationUndos[getRecommendationActionKey(action)])
  ), [appliedRecommendationUndos]);

  useEffect(() => {
    if (analysisState.mode === "idle" && !storedCatsText.trim()) {
      setAnalysisState(getIdleState(false));
    }
  }, [analysisState.mode, storedCatsText]);

  return {
    analysisState,
    followupInput,
    setFollowupInput,
    clearAnalysis,
    persistNextEntries,
    handleAnalyze,
    handleApplyRecommendationAction,
    isRecommendationActionApplied,
  };
}
