import type { Entry, MessageCard, MessageCardItem, PlannerConfig, RecommendationAction, SkillMappingRow } from "../types";
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

function buildGroupedRecommendationItems(sectionTitle: string, lines: string[], entries: Entry[]): MessageCardItem[] {
  if (lines.length === 0) {
    return [];
  }

  const entryOrder = new Map<string, { index: number; room: string }>();
  const roomOrder = new Map<string, number>();
  entries.forEach((entry, index) => {
    entryOrder.set(entry.id, { index, room: entry.room });
    if (!roomOrder.has(entry.room)) {
      roomOrder.set(entry.room, roomOrder.size);
    }
  });

  const grouped = new Map<string, Array<{ sortIndex: number; item: MessageCardItem }>>();
  const unmatched: MessageCardItem[] = [];

  lines.forEach((line) => {
    const item = extractRecommendationAction(sectionTitle, line);
    const entryId = item.action?.entryId ?? line.match(/\[id:([^\]]+)\]/i)?.[1]?.trim();
    const entryMeta = entryId ? entryOrder.get(entryId) : undefined;
    if (!entryMeta) {
      unmatched.push(item);
      return;
    }

    if (!grouped.has(entryMeta.room)) {
      grouped.set(entryMeta.room, []);
    }
    grouped.get(entryMeta.room)?.push({ sortIndex: entryMeta.index, item });
  });

  const orderedRooms = [...grouped.keys()].sort((left, right) => (roomOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (roomOrder.get(right) ?? Number.MAX_SAFE_INTEGER));
  const groupedItems: MessageCardItem[] = [];

  orderedRooms.forEach((room) => {
    const roomItems = grouped.get(room);
    if (!roomItems?.length) {
      return;
    }

    groupedItems.push({ text: room, kind: "group" });
    roomItems
      .sort((left, right) => left.sortIndex - right.sortIndex)
      .forEach(({ item }) => {
        groupedItems.push(item);
      });
  });

  if (unmatched.length > 0) {
    if (groupedItems.length > 0) {
      groupedItems.push({ text: "Other", kind: "group" });
    }
    groupedItems.push(...unmatched);
  }

  return groupedItems;
}

export function buildStructuredResult(text: string, entries: Entry[] = []) {
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
  cards.push({ title: "Recommended Trims", items: buildGroupedRecommendationItems("Recommended Trims", parsed.trimStrong, entries), className: "strong-section" });
  cards.push({ title: "Potential Trims", items: buildGroupedRecommendationItems("Potential Trims", parsed.trimMaybe, entries), className: "maybe-section" });
  cards.push({ title: "Move", items: buildGroupedRecommendationItems("Move", parsed.move, entries), className: "move-section" });

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
