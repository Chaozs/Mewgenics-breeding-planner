import {
    getStoredCatsText,
    PLANNER_CONFIG_FIELDS,
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

export function getPlannerConfigValues() {
    return PLANNER_CONFIG_FIELDS.reduce((values, field) => {
        values[field.requestKey] = field.element ? field.element.value : "";
        return values;
    }, {});
}

export function applyPlannerConfigValues(config) {
    PLANNER_CONFIG_FIELDS.forEach((field) => {
        if (field.element && typeof config?.[field.responseKey] === "string") {
            field.element.value = config[field.responseKey];
        }
    });
}

export async function loadPlannerConfig() {
    const response = await fetch("/planner-config");
    if (!response.ok) {
        return false;
    }

    const data = await response.json();
    applyPlannerConfigValues(data);
    return true;
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
