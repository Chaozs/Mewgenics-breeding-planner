import {
  getDefaultBreedWithForGender,
  normalizeBreedWithForGender,
  normalizeEntryColumns,
  normalizeMutationValue,
  normalizeStatValueForLogic,
  normalizeStoredStatValue,
  parseSkillMappings,
  parseSkillMappingsTextToRows,
  serializeSkillMappings,
  validateAndNormalizeCatsData,
  validateMutationValue,
} from "../../shared/planner-core";

describe("shared/planner-core", () => {
  it("parses and serializes skill mappings", () => {
    const rows = parseSkillMappingsTextToRows(`
      # comment
      "10% chance to reflect projectiles" => reflect
      'Your basic attack inflicts Leech' = leech
    `);

    expect(rows).toEqual([
      { source: "10% chance to reflect projectiles", target: "reflect" },
      { source: "Your basic attack inflicts Leech", target: "leech" },
    ]);
    expect(serializeSkillMappings(rows)).toContain("reflect");
    expect(parseSkillMappings(rows).get("10% chance to reflect projectiles")).toBe("reflect");
  });

  it("normalizes legacy mutation formats and skill mappings", () => {
    const mappings = parseSkillMappings([{ source: "10% chance to reflect projectiles", target: "reflect" }]);

    expect(normalizeMutationValue("fear(head)", mappings)).toBe("fearOnContact(head)");
    expect(normalizeMutationValue("plusDex(arm)", mappings)).toBe("+1dex(arm)");
    expect(normalizeMutationValue("moreMoveLessDex(body)", mappings)).toBe("+2move-1dex(body)");
    expect(normalizeMutationValue("10% chance to reflect projectiles(eye)", mappings)).toBe("reflect(eye)");
    expect(normalizeMutationValue("X", mappings)).toBe("");
  });

  it("normalizes breed-with and stat values", () => {
    expect(getDefaultBreedWithForGender("M")).toBe("F");
    expect(getDefaultBreedWithForGender("F")).toBe("M");
    expect(getDefaultBreedWithForGender("?")).toBe("ANY");
    expect(normalizeBreedWithForGender("", "M")).toBe("F");
    expect(normalizeBreedWithForGender("X", "F")).toBe("M");
    expect(normalizeBreedWithForGender("", "?")).toBe("ANY");
    expect(normalizeBreedWithForGender("any", "?")).toBe("ANY");
    expect(normalizeStoredStatValue("1")).toBe("7");
    expect(normalizeStoredStatValue("6")).toBe("6");
    expect(normalizeStatValueForLogic("7")).toBe("1");
    expect(normalizeStatValueForLogic("6")).toBe("0");
  });

  it("validates mutation body-part placement", () => {
    expect(validateMutationValue("+1dex(arm)", 15)).toBe("");
    expect(validateMutationValue("+1dex(body)", 11)).toContain("expects (head)");
    expect(validateMutationValue("plusLuckAndDodge", 12)).toContain("expected format");
  });

  it("normalizes an entry row and validates spreadsheet input", () => {
    const mappings = parseSkillMappings([{ source: "Your basic attack inflicts Leech", target: "leech" }]);
    const normalized = normalizeEntryColumns([
      "Pippy", "f", "", "1", "7", "6", "7", "3", "7", "7",
      "fear(body)", "plusDex(head)", "", "", "", "", "", "", "", "", "", "", "", "Your basic attack inflicts Leech(mouth)", "",
    ], mappings);

    expect(normalized[1]).toBe("F");
    expect(normalized[2]).toBe("M");
    expect(normalized[3]).toBe("7");
    expect(normalized[10]).toBe("fearOnContact(body)");
    expect(normalized[11]).toBe("+1dex(head)");
    expect(normalized[23]).toBe("leech(mouth)");

    const goodRow = [
      "Pippy", "?", "ANY", "7", "7", "6", "7", "3", "7", "7",
      "", "+1dex(head)", "", "", "", "", "", "", "", "", "", "", "", "leech(mouth)", "",
    ].join("\t");

    const validation = validateAndNormalizeCatsData(`Room A\n${goodRow}`, mappings, true, true);
    expect(validation.errors).toEqual([]);
    expect(validation.normalizedCats).toContain("Room A");
    expect(validation.normalizedCats).toContain("\t1\t1\t0\t1\t0\t1\t1\t");

    const badValidation = validateAndNormalizeCatsData(`Room A\nPippy,F`, mappings, true, false);
    expect(badValidation.errors[0]).toContain("comma-separated");
  });
});
