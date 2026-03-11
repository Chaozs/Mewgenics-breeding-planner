import { useEffect, useState } from "react";

import type { OpenAiStatus, PlannerConfig } from "../types";
import { loadOpenAiStatus, loadPlannerConfigDefaults } from "../planner/api";
import { ROOM_ENABLE_DEFAULTS } from "../planner/room-config";
import { normalizeStoredPlannerConfig } from "../planner/app-state";
import { getStoredPlannerConfig, parseSkillMappingsTextToRows, setStoredPlannerConfig } from "../planner/utils";

const EMPTY_STATUS: OpenAiStatus = { enabled: true, validated: null, message: "" };

export function usePlannerConfigState() {
  const [plannerConfigLoaded, setPlannerConfigLoaded] = useState(false);
  const [plannerConfig, setPlannerConfig] = useState<PlannerConfig>({
    priorityOrder: "",
    roomAFocus: "",
    roomBFocus: "",
    roomCFocus: "",
    roomDFocus: "",
    additionalPromptInstructions: "",
    ...ROOM_ENABLE_DEFAULTS,
    skillMappings: [{ source: "", target: "" }],
  });
  const [openAiStatus, setOpenAiStatus] = useState<OpenAiStatus>(EMPTY_STATUS);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const [defaultsResponse, status] = await Promise.all([
          loadPlannerConfigDefaults(),
          loadOpenAiStatus().catch(() => EMPTY_STATUS),
        ]);

        if (cancelled) {
          return;
        }

        const defaults: PlannerConfig = {
          priorityOrder: defaultsResponse.priorityOrder,
          roomAFocus: defaultsResponse.roomAFocus,
          roomBFocus: defaultsResponse.roomBFocus,
          roomCFocus: defaultsResponse.roomCFocus,
          roomDFocus: defaultsResponse.roomDFocus,
          additionalPromptInstructions: defaultsResponse.additionalPromptInstructions,
          ...ROOM_ENABLE_DEFAULTS,
          skillMappings: parseSkillMappingsTextToRows(defaultsResponse.defaultSkillMappingsText),
        };

        setPlannerConfig(normalizeStoredPlannerConfig(getStoredPlannerConfig(), defaults));
        setOpenAiStatus(status);
        setPlannerConfigLoaded(true);
      } catch (error) {
        console.error(error);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!plannerConfigLoaded) {
      return;
    }
    setStoredPlannerConfig(plannerConfig);
  }, [plannerConfig, plannerConfigLoaded]);

  return {
    plannerConfigLoaded,
    plannerConfig,
    setPlannerConfig,
    openAiStatus,
  };
}
