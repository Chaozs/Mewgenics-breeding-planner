import { act, renderHook, waitFor } from "@testing-library/react";

import { usePlannerAnalysis } from "../../src/hooks/usePlannerAnalysis";
import type { Entry, PlannerConfig } from "../../src/types";
import { ROOM_A, ROOM_B } from "../../shared/rooms";

jest.mock("../../src/planner/api", () => ({
  streamPlannerAnalysis: jest.fn(),
}));

const { streamPlannerAnalysis } = jest.requireMock("../../src/planner/api") as {
  streamPlannerAnalysis: jest.Mock;
};

const plannerConfig: PlannerConfig = {
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

function buildEntry(id: string, room = ROOM_A, name = "Pippy"): Entry {
  return {
    id,
    room,
    columns: [name, "F", "M", "7", "7", "7", "7", "7", "7", "7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  };
}

describe("usePlannerAnalysis", () => {
  beforeEach(() => {
    streamPlannerAnalysis.mockReset();
  });

  it("blocks analysis when GPT features are locked", async () => {
    const showCurrentCatsCards = jest.fn();
    const { result } = renderHook(() => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: true,
      plannerLockMessage: "Locked",
      parsedRows: [],
      storedCatsText: "",
      storedCatIds: [],
      skillMappingsMap: new Map(),
      pushActionSnapshot: jest.fn(),
      writeStoredData: jest.fn(),
      showCurrentCatsCards,
    }));

    await act(async () => {
      await result.current.handleAnalyze("/analyze-stream");
    });

    expect(result.current.analysisState.mode).toBe("error");
    if (result.current.analysisState.mode === "error") {
      expect(result.current.analysisState.cards[0].title).toBe("Feature Disabled");
    }
  });

  it("streams and structures planner analysis output", async () => {
    streamPlannerAnalysis.mockImplementation(async ({ onStatus, onOutputDelta }: any) => {
      onStatus("Preparing planner analysis...");
      onOutputDelta("*SUMMARY*\n");
      return {
        ok: true,
        analysis: "SUMMARY\n* Keep A dense\nMOVE\n* Pippy [id:cat-1] -> Room B: preserve incubator value",
      };
    });

    const { result } = renderHook(() => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: false,
      plannerLockMessage: "",
      parsedRows: [buildEntry("cat-1")],
      storedCatsText: "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      storedCatIds: ["cat-1"],
      skillMappingsMap: new Map(),
      pushActionSnapshot: jest.fn(),
      writeStoredData: jest.fn(),
      showCurrentCatsCards: jest.fn(),
    }));

    await act(async () => {
      await result.current.handleAnalyze("/analyze-stream");
    });

    await waitFor(() => {
      expect(result.current.analysisState.mode).toBe("structured");
    });
    if (result.current.analysisState.mode === "structured") {
      expect(result.current.analysisState.cards[0].title).toBe("Summary");
      expect(result.current.analysisState.cards[1].title).toBe("Recommended Trims");
      expect(result.current.analysisState.cards[3].title).toBe("Move");
      expect(result.current.analysisState.cards[3].items[0]).toEqual({ text: "Room A", kind: "group" });
      expect(result.current.analysisState.cards[3].items[1]).toEqual({
        text: "Pippy -> Room B: preserve incubator value",
        action: { kind: "move", entryId: "cat-1", targetRoom: "Room B" },
      });
    }
  });

  it("shows a request error card when analysis fails", async () => {
    streamPlannerAnalysis.mockResolvedValue({
      ok: false,
      reason: "request",
      error: "Service unavailable",
    });

    const { result } = renderHook(() => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: false,
      plannerLockMessage: "",
      parsedRows: [buildEntry("cat-1")],
      storedCatsText: "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      storedCatIds: ["cat-1"],
      skillMappingsMap: new Map(),
      pushActionSnapshot: jest.fn(),
      writeStoredData: jest.fn(),
      showCurrentCatsCards: jest.fn(),
    }));

    await act(async () => {
      await result.current.handleAnalyze("/analyze-stream");
    });

    expect(result.current.analysisState.mode).toBe("error");
    if (result.current.analysisState.mode === "error") {
      expect(result.current.analysisState.cards[0].title).toBe("Error");
      expect(result.current.analysisState.cards[0].items[0]).toBe("Service unavailable");
    }
  });

  it("falls back gracefully when the model response has no structured sections", async () => {
    streamPlannerAnalysis.mockResolvedValue({
      ok: true,
      analysis: "This answer forgot the expected section headers entirely.",
    });

    const { result } = renderHook(() => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: false,
      plannerLockMessage: "",
      parsedRows: [buildEntry("cat-1")],
      storedCatsText: "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      storedCatIds: ["cat-1"],
      skillMappingsMap: new Map(),
      pushActionSnapshot: jest.fn(),
      writeStoredData: jest.fn(),
      showCurrentCatsCards: jest.fn(),
    }));

    await act(async () => {
      await result.current.handleAnalyze("/analyze-stream");
    });

    expect(result.current.analysisState.mode).toBe("structured");
    if (result.current.analysisState.mode === "structured") {
      expect(result.current.analysisState.cards[0].title).toBe("Summary");
      expect(result.current.analysisState.cards[0].items[0]).toBe("This answer forgot the expected section headers entirely.");
      expect(result.current.analysisState.cards[1].title).toBe("Recommended Trims");
    }
  });

  it("passes the previous analysis into follow-up requests", async () => {
    streamPlannerAnalysis
      .mockResolvedValueOnce({
        ok: true,
        analysis: "SUMMARY\n* Initial pass\nMOVE\n* Pippy [id:cat-1] -> Room B: preserve incubator value",
      })
      .mockResolvedValueOnce({
        ok: true,
        analysis: "SUMMARY\n* Follow-up complete",
      });

    const { result } = renderHook(() => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: false,
      plannerLockMessage: "",
      parsedRows: [buildEntry("cat-1")],
      storedCatsText: "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      storedCatIds: ["cat-1"],
      skillMappingsMap: new Map(),
      pushActionSnapshot: jest.fn(),
      writeStoredData: jest.fn(),
      showCurrentCatsCards: jest.fn(),
    }));

    await act(async () => {
      await result.current.handleAnalyze("/analyze-stream");
    });

    await act(async () => {
      await result.current.handleAnalyze("/analyze-followup-stream", "Please keep at least one reflect cat.");
    });

    expect(streamPlannerAnalysis).toHaveBeenNthCalledWith(2, expect.objectContaining({
      endpoint: "/analyze-followup-stream",
      body: expect.objectContaining({
        followupRequest: "Please keep at least one reflect cat.",
        previousAnalysis: "SUMMARY\n* Initial pass\nMOVE\n* Pippy [id:cat-1] -> Room B: preserve incubator value",
      }),
    }));
  });

  it("applies and undoes recommendation actions", () => {
    const writeStoredData = jest.fn();
    const pushActionSnapshot = jest.fn();
    const showCurrentCatsCards = jest.fn();
    const { result, rerender } = renderHook((props: { rows: Entry[] }) => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: false,
      plannerLockMessage: "",
      parsedRows: props.rows,
      storedCatsText: "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      storedCatIds: props.rows.map((row) => row.id),
      skillMappingsMap: new Map(),
      pushActionSnapshot,
      writeStoredData,
      showCurrentCatsCards,
    }), {
      initialProps: { rows: [buildEntry("cat-1"), buildEntry("cat-2", ROOM_B, "Baker"), buildEntry("cat-3", ROOM_B, "Shadow")] },
    });

    act(() => {
      result.current.handleApplyRecommendationAction({ kind: "move", entryId: "cat-1", targetRoom: ROOM_B });
    });

    expect(pushActionSnapshot).toHaveBeenCalled();
    expect(writeStoredData).toHaveBeenCalledWith(
      expect.stringContaining("Room B\nPippy\tF\tM"),
      ["cat-1", "cat-2", "cat-3"],
    );
    expect(result.current.isRecommendationActionApplied({ kind: "move", entryId: "cat-1", targetRoom: ROOM_B })).toBe(true);

    rerender({ rows: [buildEntry("cat-1", ROOM_B), buildEntry("cat-2", ROOM_B, "Baker"), buildEntry("cat-3", ROOM_B, "Shadow")] });

    act(() => {
      result.current.handleApplyRecommendationAction({ kind: "move", entryId: "cat-1", targetRoom: ROOM_B });
    });

    expect(result.current.isRecommendationActionApplied({ kind: "move", entryId: "cat-1", targetRoom: ROOM_B })).toBe(false);
  });

  it("applies and undoes delete recommendations", () => {
    const writeStoredData = jest.fn();
    const pushActionSnapshot = jest.fn();
    const showCurrentCatsCards = jest.fn();
    const originalRows = [buildEntry("cat-1"), buildEntry("cat-2", ROOM_A, "Baker")];

    const { result, rerender } = renderHook((props: { rows: Entry[] }) => usePlannerAnalysis({
      plannerConfig,
      plannerLocked: false,
      plannerLockMessage: "",
      parsedRows: props.rows,
      storedCatsText: "Room A\nPippy\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\nBaker\tF\tM\t7\t7\t7\t7\t7\t7\t7\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
      storedCatIds: props.rows.map((row) => row.id),
      skillMappingsMap: new Map(),
      pushActionSnapshot,
      writeStoredData,
      showCurrentCatsCards,
    }), {
      initialProps: { rows: originalRows },
    });

    act(() => {
      result.current.handleApplyRecommendationAction({ kind: "delete", entryId: "cat-1" });
    });

    expect(writeStoredData).toHaveBeenCalledWith(
      expect.stringContaining("Baker"),
      ["cat-2"],
    );
    expect(result.current.isRecommendationActionApplied({ kind: "delete", entryId: "cat-1" })).toBe(true);

    rerender({ rows: [buildEntry("cat-2", ROOM_A, "Baker")] });

    act(() => {
      result.current.handleApplyRecommendationAction({ kind: "delete", entryId: "cat-1" });
    });

    expect(writeStoredData).toHaveBeenLastCalledWith(
      expect.stringContaining("Pippy"),
      ["cat-1", "cat-2"],
    );
    expect(result.current.isRecommendationActionApplied({ kind: "delete", entryId: "cat-1" })).toBe(false);
  });
});
