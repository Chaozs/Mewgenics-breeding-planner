import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import OpenAI from "openai";

import {
  APP_PORT,
  ANALYSIS_DEFAULTS,
  ANALYSIS_FIELD_ERRORS,
  CATS_CSV_PATH,
  DEFAULT_PRIORITY_ORDER,
  DEFAULT_ADDITIONAL_PROMPT_INSTRUCTIONS,
  DEFAULT_ROOM_A_FOCUS,
  DEFAULT_ROOM_B_FOCUS,
  DEFAULT_ROOM_C_FOCUS,
  DEFAULT_ROOM_D_FOCUS,
  DEFAULT_SKILL_MAPPINGS,
  PLANNER_PROMPT_TEMPLATE,
  REACT_BUILD_INDEX,
  REACT_BUILD_DIR,
  SCREENSHOT_PROMPT,
  STATIC_DIR,
} from "./config";
import { parseSkillMappings, validateAndNormalizeCatsData } from "./planner-core";

dotenv.config();

type OpenAiStatus = {
  enabled: boolean;
  validated: boolean | null;
  message: string;
  checkedAt: number;
};

type AnalysisRequestValues = {
  cats: string;
  priorityOrder: string;
  roomAFocus: string;
  roomBFocus: string;
  roomCFocus: string;
  roomDFocus: string;
  additionalPromptInstructions: string;
  skillMappings: string;
  followupRequest?: string;
  previousAnalysis?: string;
};

const PORT = APP_PORT;
const OPENAI_STATUS_TTL_MS = 300_000;
const apiKey = (process.env.OPENAI_API_KEY || "").trim();
const openai = apiKey ? new OpenAI({ apiKey }) : null;
const upload = multer({ storage: multer.memoryStorage() });

const openAiStatusCache: OpenAiStatus = {
  enabled: Boolean(apiKey),
  validated: apiKey ? null : false,
  message: apiKey
    ? "OpenAI features are available."
    : "OpenAI API key not configured. Screenshot parsing and ChatGPT planner recommendations are disabled.",
  checkedAt: 0,
};

function sendJsonEvent(response: express.Response, eventName: string, payload: unknown) {
  response.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function buildPlannerPrompt(requestValues: AnalysisRequestValues, normalizedCats: string) {
  let prompt = PLANNER_PROMPT_TEMPLATE.replace("<<PRIORITY_ORDER>>", requestValues.priorityOrder);
  prompt = prompt.replace("<<ROOM_A_FOCUS>>", requestValues.roomAFocus);
  prompt = prompt.replace("<<ROOM_B_FOCUS>>", requestValues.roomBFocus);
  prompt = prompt.replace("<<ROOM_C_FOCUS>>", requestValues.roomCFocus);
  prompt = prompt.replace("<<ROOM_D_FOCUS>>", requestValues.roomDFocus);
  prompt = prompt.replace("<<CATS_DATA>>", normalizedCats);

  if (requestValues.additionalPromptInstructions.trim()) {
    prompt += `\n\nAdditional user instructions:\n${requestValues.additionalPromptInstructions.trim()}`;
  }

  if (requestValues.followupRequest?.trim()) {
    prompt +=
      "\n\nFollow-up request from user:\n"
      + `${requestValues.followupRequest.trim()}\n\n`
      + "Previous analysis context:\n"
      + `${requestValues.previousAnalysis?.trim() || "(none provided)"}\n\n`
      + "You must address the follow-up request while keeping the same output format.\n"
      + "If no further user input is needed after this response, set ACTION REQUEST (OPTIONAL) to None.";
  }

  return prompt;
}

function buildScreenshotPrompt(skillMappingsText: string) {
  const mappings = String(skillMappingsText || "").trim();
  if (!mappings) {
    return SCREENSHOT_PROMPT;
  }

  return `${SCREENSHOT_PROMPT}

Additional user-defined skill mappings:
${mappings}

If the screenshot uses one of these descriptions, map it to the token on the right-hand side exactly before adding the (bodypart) suffix.`;
}

async function getOpenAiStatus(forceRefresh = false): Promise<Omit<OpenAiStatus, "checkedAt">> {
  if (!openai || !apiKey) {
    return {
      enabled: false,
      validated: false,
      message: "OpenAI API key not configured. Screenshot parsing and ChatGPT planner recommendations are disabled.",
    };
  }

  if (!forceRefresh && Date.now() - openAiStatusCache.checkedAt < OPENAI_STATUS_TTL_MS) {
    return {
      enabled: openAiStatusCache.enabled,
      validated: openAiStatusCache.validated,
      message: openAiStatusCache.message,
    };
  }

  try {
    await openai.models.list();
    openAiStatusCache.enabled = true;
    openAiStatusCache.validated = true;
    openAiStatusCache.message = "OpenAI features are available.";
    openAiStatusCache.checkedAt = Date.now();
  } catch (error) {
    const errorText = String(error || "").trim().toLowerCase();
    const invalidKey = ["api key", "401", "incorrect", "invalid"].some((token) => errorText.includes(token));
    openAiStatusCache.enabled = !invalidKey;
    openAiStatusCache.validated = invalidKey ? false : null;
    openAiStatusCache.message = invalidKey
      ? "OpenAI API key is invalid. Screenshot parsing and ChatGPT planner recommendations are disabled."
      : "Could not verify the OpenAI API key right now. GPT features remain enabled, but requests may still fail.";
    openAiStatusCache.checkedAt = Date.now();
  }

  return {
    enabled: openAiStatusCache.enabled,
    validated: openAiStatusCache.validated,
    message: openAiStatusCache.message,
  };
}

async function requireOpenAiFeatures(response: express.Response) {
  const status = await getOpenAiStatus();
  if (status.enabled) {
    return true;
  }

  response.status(503).json({ error: status.message });
  return false;
}

function readTextField(data: Record<string, unknown>, fieldName: keyof AnalysisRequestValues, errorMessage: string, required = false) {
  const value = data[fieldName];
  if (typeof value !== "string") {
    return { value: null, error: errorMessage };
  }
  if (required && !value.trim()) {
    return { value: null, error: errorMessage };
  }
  return { value, error: null };
}

function readAnalysisRequest(data: Record<string, unknown>, requireFollowup = false) {
  const cats = readTextField(data, "cats", "Cats data was empty.", true);
  if (cats.error || !cats.value) {
    return { values: null, error: cats.error };
  }

  const values: AnalysisRequestValues = {
    cats: cats.value,
    priorityOrder: DEFAULT_PRIORITY_ORDER,
    roomAFocus: DEFAULT_ROOM_A_FOCUS,
    roomBFocus: DEFAULT_ROOM_B_FOCUS,
    roomCFocus: DEFAULT_ROOM_C_FOCUS,
    roomDFocus: DEFAULT_ROOM_D_FOCUS,
    additionalPromptInstructions: DEFAULT_ADDITIONAL_PROMPT_INSTRUCTIONS,
    skillMappings: DEFAULT_SKILL_MAPPINGS,
  };

  (Object.keys(ANALYSIS_DEFAULTS) as Array<keyof typeof ANALYSIS_DEFAULTS>).forEach((fieldName) => {
    const field = readTextField(data, fieldName, ANALYSIS_FIELD_ERRORS[fieldName]);
    if (!field.error && typeof field.value === "string") {
      values[fieldName] = field.value.trim() || ANALYSIS_DEFAULTS[fieldName];
    }
  });

  for (const fieldName of Object.keys(ANALYSIS_FIELD_ERRORS) as Array<keyof typeof ANALYSIS_FIELD_ERRORS>) {
    const field = readTextField(data, fieldName as keyof AnalysisRequestValues, ANALYSIS_FIELD_ERRORS[fieldName]);
    if (field.error) {
      return { values: null, error: field.error };
    }
  }

  if (requireFollowup) {
    const followupRequest = readTextField(data, "followupRequest", "Follow-up response must be text.", true);
    if (followupRequest.error || !followupRequest.value) {
      return { values: null, error: followupRequest.error };
    }

    const previousAnalysis = readTextField(data, "previousAnalysis", "Previous analysis must be text.");
    if (previousAnalysis.error) {
      return { values: null, error: previousAnalysis.error };
    }

    values.followupRequest = followupRequest.value.trim();
    values.previousAnalysis = previousAnalysis.value || "";
  }

  return { values, error: null };
}

function getValidatedCats(cats: string, skillMappingsText: string) {
  const validation = validateAndNormalizeCatsData(cats, parseSkillMappings(skillMappingsText), true, true);
  if (validation.errors.length > 0) {
    return { normalizedCats: null, errors: validation.errors };
  }
  return { normalizedCats: validation.normalizedCats, errors: null };
}

async function runPlannerAnalysis(requestValues: AnalysisRequestValues) {
  const validated = getValidatedCats(requestValues.cats, requestValues.skillMappings);
  if (!validated.normalizedCats) {
    return { analysis: null, errors: validated.errors };
  }

  const response = await openai!.responses.create({
    model: "gpt-5.4",
    input: buildPlannerPrompt(requestValues, validated.normalizedCats),
  });

  return {
    analysis: response.output_text,
    errors: null,
  };
}

async function handleAnalyzeStreamRequest(
  request: express.Request,
  response: express.Response,
  requireFollowup: boolean,
) {
  if (!(await requireOpenAiFeatures(response))) {
    return;
  }

  const parsed = readAnalysisRequest((request.body || {}) as Record<string, unknown>, requireFollowup);
  if (parsed.error || !parsed.values) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");

  sendJsonEvent(response, "status", { message: "Validating saved cat rows..." });
  const validated = getValidatedCats(parsed.values.cats, parsed.values.skillMappings);
  if (!validated.normalizedCats) {
    sendJsonEvent(response, "error", { reason: "validation", errors: validated.errors });
    response.end();
    return;
  }

  sendJsonEvent(response, "status", { message: "Building planner prompt..." });
  const prompt = buildPlannerPrompt(parsed.values, validated.normalizedCats);
  sendJsonEvent(response, "status", { message: "Submitting request to ChatGPT..." });

  try {
    const stream = await openai!.responses.create({
      model: "gpt-5.4",
      input: prompt,
      stream: true,
    });

    const outputChunks: string[] = [];
    let hasStartedStreaming = false;

    for await (const event of stream as AsyncIterable<any>) {
      const eventType = String(event?.type || "");
      if (eventType === "response.created") {
        sendJsonEvent(response, "status", { message: "ChatGPT accepted the request." });
        continue;
      }

      if (eventType === "response.output_text.delta") {
        const delta = String(event?.delta || "");
        if (!delta) {
          continue;
        }

        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          sendJsonEvent(response, "status", { message: "Streaming recommendation..." });
        }

        outputChunks.push(delta);
        sendJsonEvent(response, "output_delta", { delta });
        continue;
      }

      if (eventType === "response.completed") {
        const finalText = String(event?.response?.output_text || outputChunks.join(""));
        sendJsonEvent(response, "status", { message: "Finalizing recommendation..." });
        sendJsonEvent(response, "completed", { analysis: finalText });
        response.end();
        return;
      }

      if (eventType === "response.failed" || eventType === "error") {
        const errorMessage = String(event?.error?.message || "The planner request failed.");
        sendJsonEvent(response, "error", { reason: "request", error: errorMessage });
        response.end();
        return;
      }
    }

    const finalText = outputChunks.join("");
    if (finalText) {
      sendJsonEvent(response, "completed", { analysis: finalText });
    } else {
      sendJsonEvent(response, "error", { reason: "request", error: "The model finished without returning any recommendation text." });
    }
  } catch (error) {
    sendJsonEvent(response, "error", { reason: "request", error: String(error || "The planner request failed.") });
  }

  response.end();
}

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use("/static", express.static(STATIC_DIR));

app.get("/", (_request, response) => {
  response.redirect("/planner");
});

app.get("/planner", (_request, response) => {
  if (!fs.existsSync(REACT_BUILD_INDEX)) {
    response.status(503).send("React frontend has not been built yet. Run `npm run build` first.");
    return;
  }
  response.sendFile(REACT_BUILD_INDEX);
});

app.get("/planner-config", (_request, response) => {
  response.json({
    defaultPriorityOrder: DEFAULT_PRIORITY_ORDER,
    defaultRoomAFocus: DEFAULT_ROOM_A_FOCUS,
    defaultRoomBFocus: DEFAULT_ROOM_B_FOCUS,
    defaultRoomCFocus: DEFAULT_ROOM_C_FOCUS,
    defaultRoomDFocus: DEFAULT_ROOM_D_FOCUS,
    defaultAdditionalPromptInstructions: DEFAULT_ADDITIONAL_PROMPT_INSTRUCTIONS,
    defaultSkillMappings: DEFAULT_SKILL_MAPPINGS,
  });
});

app.get("/openai-status", async (_request, response) => {
  response.json(await getOpenAiStatus());
});

app.post("/parse", upload.single("image"), async (request, response) => {
  if (!(await requireOpenAiFeatures(response))) {
    return;
  }

  if (!request.file) {
    response.status(400).json({ error: "No image file received." });
    return;
  }

  if (!request.file.buffer.length) {
    response.status(400).json({ error: "Uploaded file was empty." });
    return;
  }

  const skillMappings = typeof request.body.skillMappings === "string" ? request.body.skillMappings : "";
  const mimeType = request.file.mimetype || "image/png";
  const base64Image = request.file.buffer.toString("base64");

  try {
    const modelResponse = await openai!.responses.create({
      model: "gpt-5.4",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildScreenshotPrompt(skillMappings) },
            { type: "input_image", image_url: `data:${mimeType};base64,${base64Image}`, detail: "auto" },
          ],
        },
      ],
    });

    // Preserve trailing tabs so blank columns survive round-trips.
    response.json({ row: modelResponse.output_text.replace(/[\r\n]+$/, "") });
  } catch (error) {
    response.status(502).json({ error: String(error || "Screenshot parsing request failed.") });
  }
});

app.post("/save", async (request, response) => {
  const row = typeof request.body?.row === "string" ? request.body.row.trim() : "";
  if (!row) {
    response.status(400).json({ error: "Row was empty." });
    return;
  }

  await fs.promises.appendFile(CATS_CSV_PATH, `${row}\n`, "utf-8");
  response.json({ status: "saved" });
});

app.post("/analyze", async (request, response) => {
  if (!(await requireOpenAiFeatures(response))) {
    return;
  }

  const parsed = readAnalysisRequest((request.body || {}) as Record<string, unknown>);
  if (parsed.error || !parsed.values) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const result = await runPlannerAnalysis(parsed.values);
    if (result.errors) {
      response.status(400).json({ error: "Invalid cat rows format.", details: result.errors });
      return;
    }
    response.json({ analysis: result.analysis });
  } catch (error) {
    response.status(502).json({ error: String(error || "The planner request failed.") });
  }
});

app.post("/analyze-followup", async (request, response) => {
  if (!(await requireOpenAiFeatures(response))) {
    return;
  }

  const parsed = readAnalysisRequest((request.body || {}) as Record<string, unknown>, true);
  if (parsed.error || !parsed.values) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const result = await runPlannerAnalysis(parsed.values);
    if (result.errors) {
      response.status(400).json({ error: "Invalid cat rows format.", details: result.errors });
      return;
    }
    response.json({ analysis: result.analysis });
  } catch (error) {
    response.status(502).json({ error: String(error || "The planner request failed.") });
  }
});

app.post("/analyze-stream", async (request, response) => {
  await handleAnalyzeStreamRequest(request, response, false);
});

app.post("/analyze-followup-stream", async (request, response) => {
  await handleAnalyzeStreamRequest(request, response, true);
});

const server = app.listen(PORT, () => {
  const buildStatus = fs.existsSync(path.join(REACT_BUILD_DIR, "index.html")) ? "built frontend found" : "frontend build missing";
  console.log(`Mewgenics planner server running at http://127.0.0.1:${PORT} (${buildStatus})`);
});

// Keep the foreground process attached until the HTTP server is explicitly closed.
await new Promise<void>((resolve, reject) => {
  server.on("close", resolve);
  server.on("error", reject);
  process.on("SIGINT", () => {
    server.close(() => resolve());
  });
  process.on("SIGTERM", () => {
    server.close(() => resolve());
  });
});
