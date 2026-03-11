import type { MessageCard, PlannerConfig, RecommendationAction, SkillMappingRow } from "../types";
import { buildPlannerConfigFromStored, extractRecommendationAction, isActionRequestLine, NO_DATA_STEPS, parseSkillMappingsTextToRows, parseStructuredAnalysis, stripRecommendationIds } from "./utils";

export function normalizeStoredPlannerConfig(raw: Partial<PlannerConfig>, defaults: PlannerConfig): PlannerConfig {
  const nextRaw = { ...raw } as Partial<PlannerConfig> & { skillMappings?: SkillMappingRow[] | string };
  const normalizedRaw: Partial<PlannerConfig> = {
    ...nextRaw,
    skillMappings:
      typeof nextRaw.skillMappings === "string"
        ? parseSkillMappingsTextToRows(nextRaw.skillMappings)
        : nextRaw.skillMappings,
  };
  return buildPlannerConfigFromStored(normalizedRaw, defaults);
}

export function getNoDataCards(showWarning = false): MessageCard[] {
  const cards: MessageCard[] = [];
  if (showWarning) {
    cards.push({
      title: "No Data to Analyze",
      items: ["Browser data is empty. Import spreadsheet rows and save them first."],
      className: "maybe-section",
    });
  }
  cards.push({
    title: "How to Use",
    items: NO_DATA_STEPS,
    className: "other-section",
  });
  return cards;
}

export function buildStructuredResult(text: string) {
  const parsed = parseStructuredAnalysis(text);
  const summaryLines = parsed.summary.map((line) => stripRecommendationIds(line));
  const actionRequestLines: string[] = [];

  parsed.actionRequest.forEach((line) => {
    const normalized = line.trim().toLowerCase().replace(/[.\s]+$/g, "");
    if (line && normalized !== "none") {
      actionRequestLines.push(line);
    }
  });

  parsed.other.forEach((line) => {
    if (isActionRequestLine(line)) {
      actionRequestLines.push(stripRecommendationIds(line));
    } else {
      summaryLines.push(stripRecommendationIds(line));
    }
  });

  const cards: MessageCard[] = [];
  const hasStructuredOutput = summaryLines.length > 0 || parsed.trimStrong.length > 0 || parsed.trimMaybe.length > 0 || parsed.move.length > 0;
  if (!hasStructuredOutput) {
    return {
      cards: [{ title: "Analysis", items: ["Could not detect structured sections in the model response."], className: "maybe-section" }],
      followupPrompt: "",
    };
  }

  if (summaryLines.length > 0) {
    cards.push({ title: "Summary", items: summaryLines, className: "other-section" });
  }
  cards.push({ title: "Recommended Trims", items: parsed.trimStrong.map((line) => extractRecommendationAction("Recommended Trims", line)), className: "strong-section" });
  cards.push({ title: "Potential Trims", items: parsed.trimMaybe.map((line) => extractRecommendationAction("Potential Trims", line)), className: "maybe-section" });
  cards.push({ title: "Move", items: parsed.move.map((line) => extractRecommendationAction("Move", line)), className: "move-section" });

  return {
    cards,
    followupPrompt: actionRequestLines[0] ?? "",
  };
}

export function getRecommendationActionKey(action: RecommendationAction) {
  return action.kind === "delete"
    ? `delete:${action.entryId}`
    : `move:${action.entryId}:${action.targetRoom}`;
}
