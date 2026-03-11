import {
    ACTION_REQUEST_NONE,
    NO_DATA_STEPS,
    SECTION_KEYS,
    followupPanel,
    followupPromptText,
    followupResponseInput,
    loading,
    resultStructured,
    sendFollowupBtn,
} from "./shared.js";

let liveProgressList = null;
let liveOutputPre = null;
let liveOutputEmpty = null;

function sanitizeLiveOutputText(text) {
    return String(text || "").replace(/[*_]/g, "");
}

function resetLiveAnalysisRefs() {
    liveProgressList = null;
    liveOutputPre = null;
    liveOutputEmpty = null;
}

function clearTargetContainer(target) {
    if (!target) {
        return false;
    }
    resetLiveAnalysisRefs();
    target.innerHTML = "";
    if ("hidden" in target) {
        target.hidden = false;
    }
    return true;
}

export function appendInlineMarkdown(parent, text) {
    const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    const tokens = text.split(tokenPattern).filter((token) => token.length > 0);

    tokens.forEach((token) => {
        if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
            const strong = document.createElement("strong");
            strong.textContent = token.slice(2, -2);
            parent.appendChild(strong);
            return;
        }
        if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
            const em = document.createElement("em");
            em.textContent = token.slice(1, -1);
            parent.appendChild(em);
            return;
        }
        parent.appendChild(document.createTextNode(token));
    });
}

export function stripInlineMarkdownWrapper(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) {
        return trimmed.slice(2, -2).trim();
    }
    if (trimmed.startsWith("*") && trimmed.endsWith("*") && trimmed.length > 2) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

export function buildItemElement(text) {
    const item = document.createElement("li");
    const match = text.match(/^(.+?)\s*(?::|(?:-|\u2013|\u2014))\s+(.+)$/);

    if (!match) {
        appendInlineMarkdown(item, text);
        return item;
    }

    const name = document.createElement("strong");
    name.textContent = stripInlineMarkdownWrapper(match[1]);
    item.appendChild(name);
    item.appendChild(document.createTextNode(": "));
    appendInlineMarkdown(item, match[2].trim());
    return item;
}

export function buildSectionCard(title, items, cardClass) {
    const card = document.createElement("section");
    card.className = `recommendation-card ${cardClass}`;

    const heading = document.createElement("h3");
    heading.textContent = title;
    card.appendChild(heading);

    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No cats listed.";
        card.appendChild(empty);
        return card;
    }

    const list = document.createElement("ul");
    items.forEach((entry) => {
        list.appendChild(buildItemElement(entry));
    });
    card.appendChild(list);
    return card;
}

export function parseStructuredAnalysis(text) {
    const parsed = {
        summary: [],
        trimStrong: [],
        trimMaybe: [],
        move: [],
        actionRequest: [],
        other: [],
    };

    let currentSection = null;
    text.split(/\r?\n/).forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            return;
        }

        const normalizedLine = line.replace(/:$/, "").toUpperCase();
        if (normalizedLine === SECTION_KEYS.summary) {
            currentSection = "summary";
            return;
        }
        if (normalizedLine === SECTION_KEYS.trimStrong) {
            currentSection = "trimStrong";
            return;
        }
        if (normalizedLine === SECTION_KEYS.trimMaybe) {
            currentSection = "trimMaybe";
            return;
        }
        if (normalizedLine === SECTION_KEYS.move) {
            currentSection = "move";
            return;
        }
        if (normalizedLine === SECTION_KEYS.actionRequest || normalizedLine === "ACTION REQUEST") {
            currentSection = "actionRequest";
            return;
        }

        const cleanedLine = line.replace(/^[*-]\s*/, "");
        if (currentSection) {
            parsed[currentSection].push(cleanedLine);
        } else {
            parsed.other.push(cleanedLine);
        }
    });

    return parsed;
}

export function isActionRequestLine(line) {
    if (!line) {
        return false;
    }

    const normalized = line.trim().toLowerCase();
    return (
        normalized.includes("?") ||
        normalized.startsWith("if you want") ||
        normalized.startsWith("if you'd like") ||
        normalized.startsWith("would you like") ||
        normalized.startsWith("want me to") ||
        normalized.startsWith("let me know") ||
        normalized.startsWith("reply with") ||
        normalized.includes("i can also")
    );
}

export function showFollowupPanel(promptLine) {
    if (!followupPanel || !followupPromptText || !followupResponseInput || !sendFollowupBtn) {
        return;
    }

    followupPromptText.textContent = promptLine;
    followupResponseInput.value = "";
    followupPanel.hidden = false;
    sendFollowupBtn.disabled = false;
}

export function hideFollowupPanel() {
    if (!followupPanel || !followupPromptText || !followupResponseInput || !sendFollowupBtn) {
        return;
    }

    followupPanel.hidden = true;
    followupPromptText.textContent = "";
    followupResponseInput.value = "";
    sendFollowupBtn.disabled = false;
}

export function startLiveAnalysisView(initialMessage = "Preparing planner analysis...") {
    if (!resultStructured) {
        return;
    }

    clearTargetContainer(resultStructured);
    hideFollowupPanel();

    const progressCard = document.createElement("section");
    progressCard.className = "recommendation-card move-section";

    const progressHeading = document.createElement("h3");
    progressHeading.textContent = "Analysis Progress";
    progressCard.appendChild(progressHeading);

    liveProgressList = document.createElement("ul");
    progressCard.appendChild(liveProgressList);
    resultStructured.appendChild(progressCard);

    const outputCard = document.createElement("section");
    outputCard.className = "recommendation-card other-section";

    const outputHeading = document.createElement("h3");
    outputHeading.textContent = "Live Response";
    outputCard.appendChild(outputHeading);

    liveOutputEmpty = document.createElement("p");
    liveOutputEmpty.className = "empty";
    liveOutputEmpty.textContent = "Waiting for streamed output...";
    outputCard.appendChild(liveOutputEmpty);

    liveOutputPre = document.createElement("pre");
    liveOutputPre.className = "stream-output";
    liveOutputPre.hidden = true;
    outputCard.appendChild(liveOutputPre);

    resultStructured.appendChild(outputCard);
    appendLiveAnalysisStatus(initialMessage);
}

export function appendLiveAnalysisStatus(message) {
    if (!message) {
        return;
    }
    if (!liveProgressList) {
        startLiveAnalysisView();
    }
    if (!liveProgressList) {
        return;
    }

    const lastItem = liveProgressList.lastElementChild;
    if (lastItem?.textContent === message) {
        return;
    }

    const item = document.createElement("li");
    item.textContent = message;
    liveProgressList.appendChild(item);
}

export function appendLiveAnalysisOutput(delta) {
    if (!delta) {
        return;
    }
    if (!liveOutputPre) {
        startLiveAnalysisView();
    }
    if (!liveOutputPre) {
        return;
    }

    if (liveOutputEmpty) {
        liveOutputEmpty.hidden = true;
    }
    liveOutputPre.hidden = false;
    liveOutputPre.textContent += sanitizeLiveOutputText(delta);
}

export function clearSectionStatus(target) {
    if (!target) {
        return;
    }
    target.innerHTML = "";
    if ("hidden" in target) {
        target.hidden = true;
    }
}

export function renderStructuredAnalysis(text) {
    if (!resultStructured) {
        return;
    }

    resetLiveAnalysisRefs();
    resultStructured.innerHTML = "";
    const parsed = parseStructuredAnalysis(text);
    const summaryLines = [...parsed.summary];
    const actionRequestLines = [];

    parsed.actionRequest.forEach((line) => {
        const normalized = line.trim().toLowerCase().replace(/[.\s]+$/g, "");
        if (!line || normalized === ACTION_REQUEST_NONE) {
            return;
        }
        actionRequestLines.push(line);
    });

    parsed.other.forEach((line) => {
        // Older or less structured model responses sometimes leave follow-up prompts
        // outside the dedicated section, so we recover them heuristically here.
        if (isActionRequestLine(line)) {
            actionRequestLines.push(line);
        } else {
            summaryLines.push(line);
        }
    });

    const hasStructuredOutput =
        summaryLines.length > 0 ||
        parsed.trimStrong.length > 0 ||
        parsed.trimMaybe.length > 0 ||
        parsed.move.length > 0;

    if (!hasStructuredOutput) {
        const message = document.createElement("p");
        message.className = "empty";
        message.textContent = "Could not detect structured sections in the model response.";
        resultStructured.appendChild(message);
        hideFollowupPanel();
        return;
    }

    if (summaryLines.length) {
        resultStructured.appendChild(buildSectionCard("Summary", summaryLines, "other-section"));
    }
    resultStructured.appendChild(buildSectionCard("Recommended Trims", parsed.trimStrong, "strong-section"));
    resultStructured.appendChild(buildSectionCard("Potential Trims", parsed.trimMaybe, "maybe-section"));
    resultStructured.appendChild(buildSectionCard("Move", parsed.move, "move-section"));

    if (actionRequestLines.length) {
        showFollowupPanel(actionRequestLines[0]);
    } else {
        hideFollowupPanel();
    }
}

export function renderNoDataState(showWarning = false) {
    if (!resultStructured) {
        return;
    }

    resetLiveAnalysisRefs();
    resultStructured.innerHTML = "";
    hideFollowupPanel();

    if (showWarning) {
        resultStructured.appendChild(
            buildSectionCard(
                "No Data to Analyze",
                ["Browser data is empty. Import spreadsheet rows and save them first."],
                "maybe-section"
            )
        );
    }

    resultStructured.appendChild(buildSectionCard("How to Use", NO_DATA_STEPS, "other-section"));
}

export function clearRecommendations() {
    if (loading) {
        loading.style.display = "none";
    }
    resetLiveAnalysisRefs();
    if (resultStructured) {
        resultStructured.innerHTML = "";
    }
    hideFollowupPanel();
}

export function renderValidationErrors(errors, options = {}) {
    const {
        target = resultStructured,
        includeHowTo = target === resultStructured,
    } = options;

    if (!target) {
        return;
    }

    clearTargetContainer(target);
    if (target === resultStructured) {
        hideFollowupPanel();
    }
    target.appendChild(buildSectionCard("Invalid Spreadsheet Format", errors, "strong-section"));
    if (includeHowTo) {
        target.appendChild(buildSectionCard("How to Use", NO_DATA_STEPS, "other-section"));
    }
}

export function renderStorageMessage(title, messages, cardClass = "other-section", options = {}) {
    const { target = resultStructured } = options;
    if (!target) {
        return;
    }

    clearTargetContainer(target);
    if (target === resultStructured) {
        hideFollowupPanel();
    }
    target.appendChild(buildSectionCard(title, messages, cardClass));
}
