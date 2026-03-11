import { renderHook } from "@testing-library/react";

import {
  buildPriorityMutationLookup,
  createManualFormValues,
  extractRecommendationAction,
  filterCatsDataByEnabledRooms,
  getCellDisplayClasses,
  getManualCatEntryFromValues,
  getMutationTraitName,
  insertEntryAtTopOfRoom,
  moveEntryByDrop,
  moveEntryToRoom,
  normalizeEntryColumnValue,
  parseModelRowToEntry,
  parsePriorityOrderText,
  parseSkillMappings,
  parseStoredEntries,
  parseStructuredAnalysis,
  sanitizeLiveOutputText,
  serializeEntries,
  serializeEntriesForSpreadsheet,
  serializePriorityOrderText,
  stripRecommendationIds,
} from "../../src/planner/utils";
import { ROOM_A, ROOM_B } from "../../shared/rooms";

describe("src/planner/utils", () => {
  const mappings = parseSkillMappings([
    { source: "reflect chance", target: "reflect" },
    { source: "leech text", target: "leech" },
  ]);

  it("serializes and parses stored entries with rooms and ids", () => {
    const raw = [
      "Room A",
      "Pippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      "Room B",
      "Baker Bean\tM\tF\t7\t7\t6\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
    ].join("\n");

    const parsed = parseStoredEntries(raw, mappings, ["id-1", "id-2"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].id).toBe("id-1");
    expect(parsed.rows[1].room).toBe(ROOM_B);
    expect(serializeEntries(parsed.rows)).toContain("Room B");
    expect(serializeEntries(parsed.rows, { includeAnalysisIds: true })).toContain("[id:id-1]");
  });

  it("exports spreadsheet data with X placeholders", () => {
    const rows = parseStoredEntries([
      "Room A",
      "Pippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
    ].join("\n"), mappings, ["id-1"]).rows;

    const exported = serializeEntriesForSpreadsheet(rows);
    expect(exported).toContain("Room A");
    expect(exported).toContain("\tX\tX\tX");
  });

  it("filters raw cat data by enabled rooms", () => {
    const raw = [
      "Room A",
      "Pippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      "Room B",
      "Baker Bean\tM\tF\t7\t7\t6\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
    ].join("\n");

    expect(filterCatsDataByEnabledRooms(raw, new Set([ROOM_B]))).toContain("Room B");
    expect(filterCatsDataByEnabledRooms(raw, new Set([ROOM_B]))).not.toContain("Room A");
  });

  it("parses model rows and manual form values", () => {
    const modelColumns = [
      "Pippy", "F", "M", "7", "7", "7", "7", "7", "7", "7",
      "", "", "", "", "", "", "", "reflect chance(eye)", "", "", "", "", "", "leech text(mouth)", "",
    ];
    const parsed = parseModelRowToEntry(`Room B\n${modelColumns.join("\t")}`, mappings);
    expect(parsed.room).toBe(ROOM_B);
    expect(parsed.columns[17]).toBe("reflect(eye)");
    expect(parsed.columns[23]).toBe("leech(mouth)");

    const values = createManualFormValues(parsed);
    expect(values.room).toBe(ROOM_B);
    expect(values.cat).toBe("Pippy");

    const manual = getManualCatEntryFromValues(values, mappings);
    expect("entry" in manual).toBe(true);
    if ("entry" in manual) {
      expect(manual.entry).toBeDefined();
      expect(manual.entry!.room).toBe(ROOM_B);
    }
  });

  it("re-homes parsed screenshot mutations when blank duplicate columns were skipped", () => {
    const modelColumns = [
      "Josephine", "F", "M", "7", "7", "7", "7", "7", "7", "7",
      "",
      "+1health(head)",
      "knockback(tail)",
      "+2luck-1move(leg)",
      "",
      "",
      "+2char-1luck(eye)",
      "",
      "+1range(eyebrow)",
      "+2dex-1health(ear)",
      "",
      "",
      "",
      "",
      "",
    ];

    const parsed = parseModelRowToEntry(modelColumns.join("\t"), mappings);
    expect(parsed.columns[11]).toBe("+1health(head)");
    expect(parsed.columns[12]).toBe("knockback(tail)");
    expect(parsed.columns[13]).toBe("+2luck-1move(leg)");
    expect(parsed.columns[17]).toBe("+2char-1luck(eye)");
    expect(parsed.columns[19]).toBe("+1range(eyebrow)");
    expect(parsed.columns[21]).toBe("+2dex-1health(ear)");
    expect(parsed.columns[16]).toBe("");
    expect(parsed.columns[18]).toBe("");
    expect(parsed.columns[20]).toBe("");
  });

  it("re-homes multiple duplicate-body-part mutations into both available slots", () => {
    const modelColumns = [
      "Double Eye", "F", "M", "7", "7", "7", "7", "7", "7", "7",
      "",
      "",
      "",
      "",
      "",
      "",
      "+1range(eye)",
      "+2move-1luck(eye)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const parsed = parseModelRowToEntry(modelColumns.join("\t"), mappings);
    expect(parsed.columns[17]).toBe("+1range(eye)");
    expect(parsed.columns[18]).toBe("+2move-1luck(eye)");
  });

  it("keeps malformed mutation text in its original column when it cannot be safely re-homed", () => {
    const modelColumns = [
      "Odd Parse", "F", "M", "7", "7", "7", "7", "7", "7", "7",
      "",
      "",
      "",
      "",
      "",
      "",
      "mysteryMutation",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const parsed = parseModelRowToEntry(modelColumns.join("\t"), mappings);
    expect(parsed.columns[16]).toBe("mysteryMutation");
    expect(parsed.columns[17]).toBe("");
  });

  it("parses structured analysis helpers", () => {
    const parsed = parseStructuredAnalysis(`
SUMMARY
* hello
MOVE
- Cat [id:abc] -> Room B: move reason
`);
    expect(parsed.summary).toEqual(["hello"]);
    expect(parsed.move).toEqual(["Cat [id:abc] -> Room B: move reason"]);
    expect(stripRecommendationIds("Cat [id:abc] -> Room B")).toBe("Cat -> Room B");
    expect(sanitizeLiveOutputText("*Cat* [id:abc] _text_")).toBe("Cat text");
    expect(extractRecommendationAction("Move", "Cat [id:abc] -> Room B: move reason")).toEqual({
      text: "Cat -> Room B: move reason",
      action: { kind: "move", entryId: "abc", targetRoom: "Room B" },
    });
  });

  it("handles priority order parsing and lookup", () => {
    const parsed = parsePriorityOrderText("body: any\nhead: fearOnContact -> any\ncustom line");
    expect(parsed.priorities.head).toBe("fearOnContact -> any");
    expect(parsed.extraLines).toEqual(["custom line"]);
    expect(serializePriorityOrderText(parsed.priorities, parsed.extraLines)).toContain("custom line");

    const lookup = buildPriorityMutationLookup("head: fearOnContact -> any");
    expect(lookup.get("head")?.has("fearoncontact")).toBe(true);
  });

  it("moves rows by room or drop target", () => {
    const entries = [
      { id: "1", room: ROOM_A, columns: ["Pippy", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
      { id: "2", room: ROOM_A, columns: ["Baker", "M", "F", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
    ];

    const movedRoom = moveEntryToRoom(entries, 0, ROOM_B);
    expect(movedRoom[1].room).toBe(ROOM_B);

    const dropped = moveEntryByDrop(entries, 0, { type: "row", rowIndex: 1, room: ROOM_A, placeAfter: true });
    expect(dropped[1].id).toBe("1");
  });

  it("inserts new entries at the top of their room section", () => {
    const entries = [
      { id: "1", room: ROOM_A, columns: ["Pippy", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
      { id: "2", room: ROOM_B, columns: ["Baker", "M", "F", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
    ];

    const insertedA = insertEntryAtTopOfRoom(entries, { id: "3", room: ROOM_A, columns: ["New A", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] });
    expect(insertedA[0].id).toBe("3");

    const insertedB = insertEntryAtTopOfRoom(entries, { id: "4", room: ROOM_B, columns: ["New B", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] });
    expect(insertedB[1].id).toBe("4");
    expect(insertedB[2].id).toBe("2");
  });

  it("normalizes inline edits and cell display classes", () => {
    const columns = ["Pippy", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    const next = normalizeEntryColumnValue(1, "m", columns, mappings);
    expect(next[1]).toBe("M");
    expect(next[2]).toBe("F");
    expect(getMutationTraitName("+1dex(head)")).toBe("+1dex");
    expect(getCellDisplayClasses(3, "7").classes).toContain("stat-good");
    expect(getCellDisplayClasses(10, "badMutation").classes).toContain("cell-invalid");
  });
});
