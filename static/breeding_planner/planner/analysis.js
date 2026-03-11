import {
    applySkillMappingsText,
    getStoredCatsText,
    getStoredPlannerConfigValues,
    PLANNER_CONFIG_FIELDS,
    serializeSkillMappings,
    setStoredPlannerConfigValues,
    validateAndNormalizeCatsData,
} from "./shared.js";

function parseResponseError(data, response) {
    if (Array.isArray(data?.details) && data.details.length) {
        return {
            reason: "validation",
            errors: data.details,
        };
    }

    return {
        reason: "request",
        error: data?.error || `Request failed with ${response.status}`,
    };
}

function parseSseEventBlock(block) {
    const lines = block.split(/\r?\n/);
    let eventName = "message";
    const dataLines = [];

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

    try {
        return {
            eventName,
            payload: JSON.parse(dataLines.join("\n")),
        };
    } catch (err) {
        return {
            eventName,
            payload: { raw: dataLines.join("\n") },
        };
    }
}

export function getPlannerConfigValues() {
    const values = PLANNER_CONFIG_FIELDS.reduce((accumulator, field) => {
        accumulator[field.requestKey] = field.element ? field.element.value : "";
        return accumulator;
    }, {});

    values.skillMappings = serializeSkillMappings();
    return values;
}

export function savePlannerConfigValues() {
    setStoredPlannerConfigValues(getPlannerConfigValues());
}

export function applyPlannerConfigValues(config) {
    PLANNER_CONFIG_FIELDS.forEach((field) => {
        if (field.element && typeof config?.[field.responseKey] === "string") {
            field.element.value = config[field.responseKey];
        }
        if (field.element && typeof config?.[field.requestKey] === "string") {
            field.element.value = config[field.requestKey];
        }
    });

    if (typeof config?.defaultSkillMappings === "string") {
        applySkillMappingsText(config.defaultSkillMappings);
    }
    if (typeof config?.skillMappings === "string") {
        applySkillMappingsText(config.skillMappings);
    }
}

export async function loadPlannerConfig() {
    let loadedDefaults = false;
    let requestError = null;

    try {
        const response = await fetch("/planner-config");
        if (response.ok) {
            const data = await response.json();
            applyPlannerConfigValues(data);
            loadedDefaults = true;
        }
    } catch (err) {
        requestError = err;
    }

    const storedValues = getStoredPlannerConfigValues();
    if (Object.keys(storedValues).length > 0) {
        applyPlannerConfigValues(storedValues);
        return true;
    }

    if (requestError) {
        throw requestError;
    }

    return loadedDefaults;
}

export async function loadOpenAiStatus() {
    const response = await fetch("/openai-status");
    if (!response.ok) {
        throw new Error(`Could not load OpenAI status (${response.status}).`);
    }
    return response.json();
}

export function prepareAnalysisRequest() {
    const catsRaw = getStoredCatsText();
    if (!catsRaw.trim()) {
        return {
            ok: false,
            reason: "no-data",
        };
    }

    const validation = validateAndNormalizeCatsData(catsRaw);
    if (validation.errors.length > 0) {
        return {
            ok: false,
            reason: "validation",
            errors: validation.errors,
        };
    }

    return {
        ok: true,
        body: {
            cats: validation.normalizedCats,
            ...getPlannerConfigValues(),
        },
    };
}

export async function requestPlannerAnalysis({
    endpoint,
    followupRequest = "",
    previousAnalysis = "",
} = {}) {
    const prepared = prepareAnalysisRequest();
    if (!prepared.ok) {
        return prepared;
    }

    const requestBody = { ...prepared.body };
    if (followupRequest.trim()) {
        requestBody.followupRequest = followupRequest.trim();
        requestBody.previousAnalysis = previousAnalysis;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });
    const data = await response.json();

    if (!response.ok) {
        return {
            ok: false,
            ...parseResponseError(data, response),
        };
    }

    return {
        ok: true,
        analysis: data.analysis || "",
    };
}

export async function streamPlannerAnalysis({
    endpoint,
    followupRequest = "",
    previousAnalysis = "",
    onStatus = () => {},
    onOutputDelta = () => {},
} = {}) {
    const prepared = prepareAnalysisRequest();
    if (!prepared.ok) {
        return prepared;
    }

    const requestBody = { ...prepared.body };
    if (followupRequest.trim()) {
        requestBody.followupRequest = followupRequest.trim();
        requestBody.previousAnalysis = previousAnalysis;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const data = await response.json();
        return {
            ok: false,
            ...parseResponseError(data, response),
        };
    }

    if (!response.body) {
        return {
            ok: false,
            reason: "request",
            error: "Streaming is not available in this browser.",
        };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let analysis = "";
    let failure = null;

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
                    onStatus(payload.message || "");
                } else if (eventName === "output_delta") {
                    const delta = payload.delta || "";
                    analysis += delta;
                    onOutputDelta(delta);
                } else if (eventName === "completed") {
                    analysis = payload.analysis || analysis;
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
        } catch (err) {
            console.error(err);
        }
        return {
            ok: false,
            reason: failure.reason || "request",
            errors: failure.errors,
            error: failure.error,
        };
    }

    // SSE blocks can arrive split across chunks, so flush one final partial block here.
    if (buffer.trim()) {
        const parsedEvent = parseSseEventBlock(buffer.replace(/\r/g, ""));
        if (parsedEvent?.eventName === "completed") {
            analysis = parsedEvent.payload.analysis || analysis;
        }
    }

    return {
        ok: true,
        analysis,
    };
}
