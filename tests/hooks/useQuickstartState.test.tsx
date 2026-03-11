import { renderHook, waitFor } from "@testing-library/react";

import { useQuickstartState } from "../../src/hooks/useQuickstartState";

describe("useQuickstartState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens quickstart on first visit and stores the seen flag", async () => {
    const { result } = renderHook(() => useQuickstartState());

    await waitFor(() => {
      expect(result.current.quickstartOpen).toBe(true);
    });
    expect(window.localStorage.getItem("mewgenics-planner-quickstart-seen")).toBe("1");
  });

  it("keeps quickstart collapsed on later visits", async () => {
    window.localStorage.setItem("mewgenics-planner-quickstart-seen", "1");
    const { result } = renderHook(() => useQuickstartState());

    await waitFor(() => {
      expect(result.current.quickstartOpen).toBe(false);
    });
  });
});
