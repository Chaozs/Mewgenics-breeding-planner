import { buildStructuredResult, getNoDataCards, getRecommendationActionKey, normalizeStoredPlannerConfig } from "../../src/planner/app-state";
import type { Entry, PlannerConfig } from "../../src/types";

const defaults: PlannerConfig = {
  priorityOrder: "body: any",
  roomAFocus: "A focus",
  roomBFocus: "B focus",
  roomCFocus: "C focus",
  roomDFocus: "D focus",
  additionalPromptInstructions: "",
  roomBEnabled: true,
  roomCEnabled: false,
  roomDEnabled: false,
  skillMappings: [{ source: "reflect chance", target: "reflect" }],
};

const entries: Entry[] = [
  { id: "cat-3", room: "Room A", columns: ["Baker Bean", "M", "F", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
  { id: "cat-2", room: "Room A", columns: ["Shadow", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
  { id: "cat-1", room: "Room B", columns: ["Pippy", "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""] },
];

describe("src/planner/app-state", () => {
  it("normalizes stored planner config from string skill mappings", () => {
    const config = normalizeStoredPlannerConfig(
      { roomAFocus: "Custom A", skillMappings: "Chance to reflect => reflect" } as Partial<PlannerConfig> & { skillMappings: string },
      defaults,
    );

    expect(config.roomAFocus).toBe("Custom A");
    expect(config.roomBFocus).toBe(defaults.roomBFocus);
    expect(config.additionalPromptInstructions).toBe("");
    expect(config.skillMappings).toEqual([{ source: "Chance to reflect", target: "reflect" }]);
  });

  it("builds no-data cards", () => {
    expect(getNoDataCards(true)[0].title).toBe("No Data to Analyze");
    expect(getNoDataCards(false)[0].title).toBe("How to Use");
  });

  it("builds structured planner results and extracts recommendation actions", () => {
    const result = buildStructuredResult(`
SUMMARY
* Keep your A room dense [id:hide-me]
TRIM (STRONG)
* Pippy [id:cat-1] - weak mutation density
TRIM (MAYBE)
* Shadow [id:cat-2] - situational hold
MOVE
* Baker Bean [id:cat-3] -> Room B: better incubator fit
ACTION REQUEST (OPTIONAL)
None
    `, entries);

    expect(result.followupPrompt).toBe("");
    expect(result.cards[0].title).toBe("Summary");
    expect(result.cards[0].items[0]).toBe("Keep your A room dense");
    expect(result.cards[1].title).toBe("Recommended Trims");
    expect(result.cards[1].items[0]).toEqual({ text: "Room B", kind: "group" });
    expect(result.cards[1].items[1]).toEqual({
      text: "Pippy - weak mutation density",
      action: { kind: "delete", entryId: "cat-1" },
    });
    expect(result.cards[2].items[0]).toEqual({ text: "Room A", kind: "group" });
    expect(result.cards[2].items[1]).toEqual({
      text: "Shadow - situational hold",
      action: { kind: "delete", entryId: "cat-2" },
    });
    expect(result.cards[3].items[0]).toEqual({ text: "Room A", kind: "group" });
    expect(result.cards[3].items[1]).toEqual({
      text: "Baker Bean -> Room B: better incubator fit",
      action: { kind: "move", entryId: "cat-3", targetRoom: "Room B" },
    });
  });

  it("sorts grouped recommendation items in current table order", () => {
    const result = buildStructuredResult(`
TRIM (STRONG)
* Pippy [id:cat-1] - later room
* Baker Bean [id:cat-3] - first in room A
* Shadow [id:cat-2] - second in room A
`, entries);

    expect(result.cards[0].items).toEqual([
      { text: "Room A", kind: "group" },
      { text: "Baker Bean - first in room A", action: { kind: "delete", entryId: "cat-3" } },
      { text: "Shadow - second in room A", action: { kind: "delete", entryId: "cat-2" } },
      { text: "Room B", kind: "group" },
      { text: "Pippy - later room", action: { kind: "delete", entryId: "cat-1" } },
    ]);
  });

  it("creates stable recommendation action keys", () => {
    expect(getRecommendationActionKey({ kind: "delete", entryId: "cat-1" })).toBe("delete:cat-1");
    expect(getRecommendationActionKey({ kind: "move", entryId: "cat-2", targetRoom: "Room C" })).toBe("move:cat-2:Room C");
  });
});
