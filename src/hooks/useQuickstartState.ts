import { useEffect, useState } from "react";

const QUICKSTART_SEEN_STORAGE_KEY = "mewgenics-planner-quickstart-seen";

export function useQuickstartState() {
  const [quickstartOpen, setQuickstartOpen] = useState(false);

  useEffect(() => {
    try {
      const hasSeenQuickstart = window.localStorage.getItem(QUICKSTART_SEEN_STORAGE_KEY) === "1";
      setQuickstartOpen(!hasSeenQuickstart);
      if (!hasSeenQuickstart) {
        window.localStorage.setItem(QUICKSTART_SEEN_STORAGE_KEY, "1");
      }
    } catch {
      setQuickstartOpen(true);
    }
  }, []);

  return { quickstartOpen, setQuickstartOpen };
}
