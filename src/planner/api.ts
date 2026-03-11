import type { OpenAiStatus, SkillMappingRow, StreamPlannerAnalysisOptions } from "../types";
import { parseModelRowToEntry, parseSkillMappings, serializeSkillMappings } from "./utils";

function parseResponseError(data: any, response: Response) {
  if (Array.isArray(data?.details) && data.details.length > 0) {
    return {
      reason: "validation" as const,
      errors: data.details as string[],
    };
  }

  return {
    reason: "request" as const,
    error: String(data?.error || `Request failed with ${response.status}`),
  };
}

function parseSseEventBlock(block: string) {
  const lines = block.split(/\r?\n/);
  let eventName = "message";
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (!line || line.startsWith(":")) {
      return;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      return;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  if (!dataLines.length) {
    return null;
  }

  return {
    eventName,
    payload: JSON.parse(dataLines.join("\n")),
  };
}

export async function loadPlannerConfigDefaults() {
  const response = await fetch("/planner-config");
  if (!response.ok) {
    throw new Error(`Could not load planner defaults (${response.status}).`);
  }
  const data = await response.json();
  return {
    priorityOrder: String(data.defaultPriorityOrder || ""),
    roomAFocus: String(data.defaultRoomAFocus || ""),
    roomBFocus: String(data.defaultRoomBFocus || ""),
    roomCFocus: String(data.defaultRoomCFocus || ""),
    roomDFocus: String(data.defaultRoomDFocus || ""),
    additionalPromptInstructions: String(data.defaultAdditionalPromptInstructions || ""),
    skillMappings: Array.isArray(data.defaultSkillMappings)
      ? (data.defaultSkillMappings as SkillMappingRow[])
      : [],
    defaultSkillMappingsText: String(data.defaultSkillMappings || ""),
  };
}

export async function loadOpenAiStatus(): Promise<OpenAiStatus> {
  const response = await fetch("/openai-status");
  if (!response.ok) {
    throw new Error(`Could not load OpenAI status (${response.status}).`);
  }
  return response.json();
}

export async function parseScreenshotForManualForm(file: File, skillMappings: SkillMappingRow[]) {
  const formData = new FormData();
  formData.append("image", file, file.name || "screenshot.png");
  formData.append("skillMappings", serializeSkillMappings(skillMappings));

  const response = await fetch("/parse", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(String(data.error || `Request failed with ${response.status}`));
  }
  return parseModelRowToEntry(String(data.row || ""), parseSkillMappings(skillMappings));
}

export async function streamPlannerAnalysis({ endpoint, body, onStatus = () => {}, onOutputDelta = () => {} }: StreamPlannerAnalysisOptions) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json();
    return {
      ok: false as const,
      ...parseResponseError(data, response),
    };
  }

  if (!response.body) {
    return {
      ok: false as const,
      reason: "request" as const,
      error: "Streaming is not available in this browser.",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let analysis = "";
  let failure: any = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex).replace(/\r/g, "");
      buffer = buffer.slice(separatorIndex + 2);

      const parsedEvent = parseSseEventBlock(block);
      if (parsedEvent) {
        const { eventName, payload } = parsedEvent;
        if (eventName === "status") {
          onStatus(String(payload.message || ""));
        } else if (eventName === "output_delta") {
          const delta = String(payload.delta || "");
          analysis += delta;
          onOutputDelta(delta);
        } else if (eventName === "completed") {
          analysis = String(payload.analysis || analysis);
        } else if (eventName === "error") {
          failure = payload;
          break;
        }
      }

      separatorIndex = buffer.indexOf("\n\n");
    }

    if (failure || done) {
      break;
    }
  }

  if (failure) {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel errors.
    }
    return {
      ok: false as const,
      reason: failure.reason || "request",
      errors: failure.errors,
      error: failure.error,
    };
  }

  if (buffer.trim()) {
    const parsedEvent = parseSseEventBlock(buffer.replace(/\r/g, ""));
    if (parsedEvent?.eventName === "completed") {
      analysis = String(parsedEvent.payload.analysis || analysis);
    }
  }

  return {
    ok: true as const,
    analysis,
  };
}
