import { useEffect, useMemo, useState } from "react";

import { getStoredCatIds, getStoredCatsText, parseStoredEntries, setStoredCatIds, setStoredCatsText as persistStoredCatsText } from "../planner/utils";

export function useStoredCatsState(skillMappingsMap: Map<string, string>) {
  const [storedCatsText, setStoredCatsText] = useState("");
  const [storedCatIds, setStoredCatIdsState] = useState<string[]>([]);

  useEffect(() => {
    setStoredCatsText(getStoredCatsText());
    setStoredCatIdsState(getStoredCatIds());
  }, []);

  const parsedStored = useMemo(
    () => parseStoredEntries(storedCatsText, skillMappingsMap, storedCatIds),
    [storedCatsText, skillMappingsMap, storedCatIds],
  );

  useEffect(() => {
    const parsedIds = parsedStored.rows.map((entry) => entry.id);
    const idsMatch = parsedIds.length === storedCatIds.length
      && parsedIds.every((id, index) => id === storedCatIds[index]);
    if (!idsMatch) {
      setStoredCatIdsState(parsedIds);
      setStoredCatIds(parsedIds);
    }
  }, [parsedStored.rows, storedCatIds]);

  function writeStoredData(nextRaw: string, nextIds: string[]) {
    setStoredCatsText(nextRaw);
    setStoredCatIdsState(nextIds);
    persistStoredCatsText(nextRaw);
    setStoredCatIds(nextIds);
  }

  return {
    storedCatsText,
    storedCatIds,
    parsedStored,
    writeStoredData,
  };
}
