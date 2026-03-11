export type Room = "Room A" | "Room B" | "Room C" | "Room D" | string;

export type Entry = {
  id: string;
  room: Room;
  columns: string[];
};

export type RecommendationAction =
  | { kind: "delete"; entryId: string }
  | { kind: "move"; entryId: string; targetRoom: Room };

export type MessageCardItem =
  | string
  | {
    text: string;
    action?: RecommendationAction;
  };

export type MessageCard = {
  title: string;
  items: MessageCardItem[];
  className?: string;
};

export type PlannerAnalysisState =
  | { mode: "idle"; cards: MessageCard[]; followupPrompt: string }
  | { mode: "error"; cards: MessageCard[]; followupPrompt: string }
  | { mode: "streaming"; statuses: string[]; liveOutput: string; followupPrompt: string }
  | { mode: "structured"; cards: MessageCard[]; followupPrompt: string; text: string };

export type PlannerConfig = {
  priorityOrder: string;
  roomAFocus: string;
  roomBFocus: string;
  roomCFocus: string;
  roomDFocus: string;
  additionalPromptInstructions: string;
  roomBEnabled: boolean;
  roomCEnabled: boolean;
  roomDEnabled: boolean;
  skillMappings: SkillMappingRow[];
};

export type SkillMappingRow = {
  source: string;
  target: string;
};

export type OpenAiStatus = {
  enabled: boolean;
  validated: boolean | null;
  message: string;
};

export type StructuredAnalysis = {
  summary: string[];
  trimStrong: string[];
  trimMaybe: string[];
  move: string[];
  actionRequest: string[];
  other: string[];
};

export type ManualDraft = {
  values: Record<string, string>;
  parseStatusText: string;
  parseStatusIsError: boolean;
  manualCatErrorText: string;
};

export type StreamPlannerAnalysisOptions = {
  endpoint: string;
  body: Record<string, string>;
  onStatus?: (message: string) => void;
  onOutputDelta?: (delta: string) => void;
};
