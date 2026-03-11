import { COLUMN_DEFINITIONS, getDefaultValueForColumn, isStatColumn, normalizeColumnInputValue } from "../../src/planner/schema";

describe("src/planner/schema", () => {
  it("defines the expected defaults", () => {
    expect(COLUMN_DEFINITIONS).toHaveLength(25);
    expect(getDefaultValueForColumn(0)).toBe("");
    expect(getDefaultValueForColumn(3)).toBe("7");
  });

  it("normalizes gender, breed-with, and stats", () => {
    expect(normalizeColumnInputValue(1, "m")).toBe("M");
    expect(normalizeColumnInputValue(1, "invalid")).toBe("?");
    expect(normalizeColumnInputValue(2, "x")).toBe("X");
    expect(normalizeColumnInputValue(2, "invalid")).toBe("");
    expect(normalizeColumnInputValue(3, "1")).toBe("7");
    expect(normalizeColumnInputValue(3, "0")).toBe("0");
    expect(normalizeColumnInputValue(3, "99")).toBe("7");
    expect(isStatColumn(3)).toBe(true);
    expect(isStatColumn(10)).toBe(false);
  });
});
