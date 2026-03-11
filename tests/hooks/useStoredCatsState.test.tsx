import { act, renderHook, waitFor } from "@testing-library/react";

import { useStoredCatsState } from "../../src/hooks/useStoredCatsState";

describe("useStoredCatsState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads and writes stored cat rows and ids", async () => {
    window.localStorage.setItem("mewgenics.cats_data_rows", "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t");
    window.localStorage.setItem("mewgenics.cats_data_ids", JSON.stringify(["id-1"]));

    const { result } = renderHook(() => useStoredCatsState(new Map()));

    await waitFor(() => {
      expect(result.current.parsedStored.rows).toHaveLength(1);
    });
    expect(result.current.parsedStored.rows[0].id).toBe("id-1");

    act(() => {
      result.current.writeStoredData("Room B\nBaker\tM\tF\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t", ["id-2"]);
    });

    await waitFor(() => {
      expect(result.current.parsedStored.rows[0].room).toBe("Room B");
    });
    expect(window.localStorage.getItem("mewgenics.cats_data_ids")).toBe(JSON.stringify(["id-2"]));
  });

  it("recovers from corrupted stored id JSON and rewrites a valid id list", async () => {
    window.localStorage.setItem("mewgenics.cats_data_rows", "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t");
    window.localStorage.setItem("mewgenics.cats_data_ids", "{not valid json");

    const { result } = renderHook(() => useStoredCatsState(new Map()));

    await waitFor(() => {
      expect(result.current.parsedStored.rows).toHaveLength(1);
      expect(result.current.storedCatIds).toHaveLength(1);
    });

    const persistedIds = JSON.parse(window.localStorage.getItem("mewgenics.cats_data_ids") || "[]");
    expect(persistedIds).toHaveLength(1);
    expect(typeof persistedIds[0]).toBe("string");
  });

  it("heals mismatched stored id arrays to match the current row count", async () => {
    window.localStorage.setItem("mewgenics.cats_data_rows", [
      "Room A",
      "Pippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      "Baker\tM\tF\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
    ].join("\n"));
    window.localStorage.setItem("mewgenics.cats_data_ids", JSON.stringify(["id-1"]));

    const { result } = renderHook(() => useStoredCatsState(new Map()));

    await waitFor(() => {
      expect(result.current.parsedStored.rows).toHaveLength(2);
      expect(result.current.storedCatIds).toHaveLength(2);
    });

    expect(result.current.storedCatIds[0]).toBe("id-1");
    expect(typeof result.current.storedCatIds[1]).toBe("string");
  });
});
