from pathlib import Path
import json
import re
import time

from flask import Blueprint, Response, current_app, jsonify, request, send_from_directory, stream_with_context


PROMPT_PATH = Path(__file__).resolve().parent / "prompt.txt"
PLANNER_PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")
DEFAULT_PRIORITY_ORDER = """body: any
head: +1health -> fearOnContact -> any
tail: backflip -> moreMovePerTurn
leg: tileImmunity -> +1dex -> any
arm: randomDebuff -> jumpMove -> any
eye: confusion -> +2move-1luck -> reflect -> any
eyebrow: +1range -> any
ear: burn -> any
mouth: bonusAttackChance -> leech -> bleed -> any
fur: +1int -> +2move-1luck -> any"""
DEFAULT_ROOM_A_FOCUS = (
    "Inject rare/priority mutations into 7/7 cats, resulting in a 7/7 cat with high mutation "
    "density (few empty body-part slots) and prioritized mutations."
)
DEFAULT_ROOM_B_FOCUS = (
    "Incubator to preserve rare mutations and push those mutations onto cats with as close to "
    "7/7 as possible, then inject into Room A."
)
DEFAULT_ROOM_C_FOCUS = (
    "Secondary incubator/preservation pool to hold niche mutation carriers, bridges, or backups "
    "that should not crowd final-injection lines."
)
DEFAULT_ROOM_D_FOCUS = (
    "Overflow or experimental room for low-priority projects, cleanup candidates, and temporary "
    "tests before promoting cats into higher-priority rooms."
)
DEFAULT_SKILL_MAPPINGS = """10% chance to reflect projectiles => reflect
Your basic attack inflicts Leech => leech"""
ANALYSIS_DEFAULTS = {
    "priorityOrder": DEFAULT_PRIORITY_ORDER,
    "roomAFocus": DEFAULT_ROOM_A_FOCUS,
    "roomBFocus": DEFAULT_ROOM_B_FOCUS,
    "roomCFocus": DEFAULT_ROOM_C_FOCUS,
    "roomDFocus": DEFAULT_ROOM_D_FOCUS,
    "skillMappings": DEFAULT_SKILL_MAPPINGS,
}
ANALYSIS_FIELD_ERRORS = {
    "priorityOrder": "Priority order must be text.",
    "roomAFocus": "Room A focus must be text.",
    "roomBFocus": "Room B focus must be text.",
    "roomCFocus": "Room C focus must be text.",
    "roomDFocus": "Room D focus must be text.",
    "skillMappings": "Skill mappings must be text.",
}
EXPECTED_COLUMNS = 25
ALLOWED_GENDERS = {"M", "F", "?"}
ALLOWED_BREED_WITH = {"", "X", "M", "F", "?"}
COLUMN_LABELS = [
    "Cat",
    "Gender",
    "BreedWith",
    "Str",
    "Dex",
    "Health",
    "Int",
    "Move",
    "Char",
    "Luck",
    "Body",
    "Head",
    "Tail",
    "Leg 1",
    "Leg 2",
    "Arm 1",
    "Arm 2",
    "Eye 1",
    "Eye 2",
    "Eyebrow 1",
    "Eyebrow 2",
    "Ear 1",
    "Ear 2",
    "Mouth",
    "Fur",
]
MUTATION_COLUMN_BODY_PARTS = {
    10: "body",
    11: "head",
    12: "tail",
    13: "leg",
    14: "leg",
    15: "arm",
    16: "arm",
    17: "eye",
    18: "eye",
    19: "eyebrow",
    20: "eyebrow",
    21: "ear",
    22: "ear",
    23: "mouth",
    24: "fur",
}
ROOM_MARKERS = {
    "A",
    "B",
    "C",
    "D",
    "ROOM A",
    "ROOM B",
    "ROOM C",
    "ROOM D",
    "A:",
    "B:",
    "C:",
    "D:",
    "ROOM A:",
    "ROOM B:",
    "ROOM C:",
    "ROOM D:",
}

breeding_planner_bp = Blueprint("breeding_planner", __name__)
OPENAI_STATUS_TTL_SECONDS = 300


def _get_openai_status(force_refresh=False):
    client = current_app.config.get("OPENAI_CLIENT")
    if client is None or not current_app.config.get("OPENAI_API_KEY_PRESENT"):
        return {
            "enabled": False,
            "validated": False,
            "message": "OpenAI API key not configured. Screenshot parsing and ChatGPT planner recommendations are disabled.",
        }

    cache = current_app.config.setdefault(
        "OPENAI_STATUS_CACHE",
        {
            "enabled": True,
            "validated": None,
            "message": "OpenAI features are available.",
            "checked_at": 0.0,
        },
    )

    now = time.time()
    if not force_refresh and now - float(cache.get("checked_at") or 0.0) < OPENAI_STATUS_TTL_SECONDS:
        return {
            "enabled": bool(cache.get("enabled", True)),
            "validated": cache.get("validated"),
            "message": str(cache.get("message") or "OpenAI features are available."),
        }

    try:
        # A lightweight model listing call verifies the configured key without using model tokens.
        client.models.list()
        cache.update(
            {
                "enabled": True,
                "validated": True,
                "message": "OpenAI features are available.",
                "checked_at": now,
            }
        )
    except Exception as err:
        error_text = str(err).strip()
        normalized = error_text.lower()
        invalid_key = any(token in normalized for token in ["api key", "401", "incorrect", "invalid"])
        if invalid_key:
            cache.update(
                {
                    "enabled": False,
                    "validated": False,
                    "message": "OpenAI API key is invalid. Screenshot parsing and ChatGPT planner recommendations are disabled.",
                    "checked_at": now,
                }
            )
        else:
            cache.update(
                {
                    "enabled": True,
                    "validated": None,
                    "message": "Could not verify the OpenAI API key right now. GPT features remain enabled, but requests may still fail.",
                    "checked_at": now,
                }
            )

    return {
        "enabled": bool(cache.get("enabled", True)),
        "validated": cache.get("validated"),
        "message": str(cache.get("message") or "OpenAI features are available."),
    }


def _require_openai_features():
    status = _get_openai_status()
    if status["enabled"]:
        return None
    return (
        jsonify(
            {
                "error": status["message"],
            }
        ),
        503,
    )


def _normalize_label(text):
    return re.sub(r"\s+", " ", text.strip().upper())


def _is_room_marker(line):
    return _normalize_label(line) in ROOM_MARKERS


def _is_header_row(columns):
    if len(columns) < 3:
        return False

    first = columns[0].strip().lower()
    second = columns[1].strip().lower()
    third = columns[2].strip().lower().replace(" ", "")
    return first == "cat" and second == "gender" and third == "breedwith"


def _normalize_breed_with_for_gender(breed_with, gender):
    normalized_breed_with = (breed_with or "").upper()
    normalized_gender = (gender or "").upper()
    if normalized_breed_with == "X":
        return _normalize_breed_with_for_gender("", normalized_gender)
    if not normalized_breed_with:
        if normalized_gender == "M":
            return "F"
        if normalized_gender == "F":
            return "M"
        return "?"
    return normalized_breed_with


def _normalize_mutation_value(value):
    trimmed = str(value or "").strip()
    if not trimmed or trimmed.lower() == "x":
        return ""

    legacy_fear_match = re.fullmatch(r"fear\(([^()]+)\)", trimmed, re.IGNORECASE)
    if legacy_fear_match:
        body_part = legacy_fear_match.group(1).strip().lower()
        return f"fearOnContact({body_part})"

    legacy_plus_match = re.fullmatch(r"plus([A-Z][A-Za-z0-9]*)\(([^()]+)\)", trimmed)
    if legacy_plus_match:
        stat = legacy_plus_match.group(1).strip().lower()
        body_part = legacy_plus_match.group(2).strip().lower()
        return f"+1{stat}({body_part})"

    legacy_match = re.fullmatch(r"more([A-Z][A-Za-z0-9]*)Less([A-Z][A-Za-z0-9]*)\(([^()]+)\)", trimmed)
    if legacy_match:
        gain_stat = legacy_match.group(1).strip().lower()
        loss_stat = legacy_match.group(2).strip().lower()
        body_part = legacy_match.group(3).strip().lower()
        return f"+2{gain_stat}-1{loss_stat}({body_part})"

    return trimmed


def _normalize_entry_columns(columns):
    columns[1] = ((columns[1] or "?").strip().upper()) or "?"
    columns[2] = _normalize_breed_with_for_gender(columns[2], columns[1])
    for column_index in range(10, len(columns)):
        columns[column_index] = _normalize_mutation_value(columns[column_index])


def _row_context(line_number, columns):
    cat_name = ""
    if columns and len(columns) > 0:
        cat_name = (columns[0] or "").strip()
    if cat_name:
        return f"Line {line_number} [Cat: {cat_name}]"
    return f"Line {line_number}"


def _validate_mutation_value(value, column_index):
    expected_body_part = MUTATION_COLUMN_BODY_PARTS.get(column_index, "")
    if not expected_body_part:
        return None

    trimmed = str(value or "").strip()
    if not trimmed or trimmed.lower() == "x":
        return None

    # Mutation slots should hold a trait token plus the body-part suffix.
    match = re.fullmatch(r"([A-Za-z0-9+\-]+)\(([^()]+)\)", trimmed)
    if not match:
        return (
            f'value "{trimmed}" is invalid. Expected an empty value, x, or a mutation formatted like '
            f'traitName({expected_body_part}).'
        )

    actual_body_part = match.group(2).strip().lower()
    if actual_body_part != expected_body_part:
        return (
            f'value "{trimmed}" is under the wrong body part. '
            f"Expected ({expected_body_part}) for this column."
        )

    return None


def _validate_and_normalize_cats_data(raw_text):
    errors = []
    normalized_lines = []
    valid_rows = 0

    for line_number, raw_line in enumerate(raw_text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        if _is_room_marker(line):
            normalized_lines.append(line)
            continue

        columns = [value.strip() for value in raw_line.split("\t")]
        if _is_header_row(columns):
            continue

        if len(columns) != EXPECTED_COLUMNS:
            context = _row_context(line_number, columns)
            if len(columns) == 1 and "," in raw_line and "\t" not in raw_line:
                errors.append(
                    f'{context} Column separator error: row appears comma-separated. Use tab-separated columns.'
                )
            else:
                errors.append(
                    f"{context} Column count error: expected {EXPECTED_COLUMNS} tab-separated columns, found {len(columns)}."
                )
            continue

        context = _row_context(line_number, columns)

        if not columns[0]:
            errors.append(f'{context} Column "Cat": value is empty.')

        _normalize_entry_columns(columns)
        gender = columns[1].upper()
        if gender not in ALLOWED_GENDERS:
            errors.append(
                f'{context} Column "Gender": value "{columns[1]}" is invalid. Expected M, F, or ?.'
            )

        breed_with = columns[2].upper()
        if breed_with not in ALLOWED_BREED_WITH:
            errors.append(
                f'{context} Column "BreedWith": value "{columns[2]}" is invalid. Expected blank, ?, M, or F.'
            )

        stat_labels = ["Str", "Dex", "Health", "Int", "Move", "Char", "Luck"]
        stat_values = columns[3:10]
        for stat_label, stat_value in zip(stat_labels, stat_values):
            if stat_value not in {"0", "1"}:
                errors.append(
                    f'{context} Column "{stat_label}": value "{stat_value}" is invalid. Expected 0 or 1.'
                )

        for column_index in range(10, len(columns)):
            mutation_error = _validate_mutation_value(columns[column_index], column_index)
            if mutation_error:
                errors.append(
                    f'{context} Column "{COLUMN_LABELS[column_index]}": {mutation_error}'
                )

        if any(error.startswith(context) for error in errors):
            continue

        valid_rows += 1
        normalized_lines.append("\t".join(columns))

    if valid_rows == 0:
        errors.append("No valid cat rows were found.")

    if errors:
        return None, errors

    return "\n".join(normalized_lines), None


def _build_analysis_prompt(
    normalized_cats,
    priority_order,
    room_a_focus,
    room_b_focus,
    room_c_focus,
    room_d_focus,
    followup_request="",
    previous_analysis="",
):
    prompt = PLANNER_PROMPT_TEMPLATE.replace("<<PRIORITY_ORDER>>", priority_order)
    prompt = prompt.replace("<<ROOM_A_FOCUS>>", room_a_focus)
    prompt = prompt.replace("<<ROOM_B_FOCUS>>", room_b_focus)
    prompt = prompt.replace("<<ROOM_C_FOCUS>>", room_c_focus)
    prompt = prompt.replace("<<ROOM_D_FOCUS>>", room_d_focus)
    prompt = prompt.replace("<<CATS_DATA>>", normalized_cats)

    if followup_request.strip():
        prompt += (
            "\n\nFollow-up request from user:\n"
            f"{followup_request.strip()}\n\n"
            "Previous analysis context:\n"
            f"{previous_analysis.strip() or '(none provided)'}\n\n"
            "You must address the follow-up request while keeping the same output format.\n"
            "If no further user input is needed after this response, set ACTION REQUEST (OPTIONAL) to None."
        )

    return prompt


def _read_text_field(data, field_name, error_message, required=False):
    value = data.get(field_name, "")
    if not isinstance(value, str):
        return None, error_message
    if required and not value.strip():
        return None, error_message
    return value, None


def _read_analysis_request(data, require_followup=False):
    cats, error = _read_text_field(data, "cats", "Cats data was empty.", required=True)
    if error:
        return None, error

    request_values = {"cats": cats}
    for field_name, default_value in ANALYSIS_DEFAULTS.items():
        value, error = _read_text_field(
            data,
            field_name,
            ANALYSIS_FIELD_ERRORS[field_name],
        )
        if error:
            return None, error
        request_values[field_name] = value.strip() or default_value

    if require_followup:
        followup_request, error = _read_text_field(
            data,
            "followupRequest",
            "Follow-up response must be text.",
            required=True,
        )
        if error:
            return None, error

        previous_analysis, error = _read_text_field(
            data,
            "previousAnalysis",
            "Previous analysis must be text.",
        )
        if error:
            return None, error

        request_values["followupRequest"] = followup_request.strip()
        request_values["previousAnalysis"] = previous_analysis

    return request_values, None


def _run_planner_analysis(request_values):
    normalized_cats, validation_errors = _validate_and_normalize_cats_data(request_values["cats"])
    if validation_errors:
        return None, validation_errors

    prompt = _build_analysis_prompt(
        normalized_cats,
        request_values["priorityOrder"],
        request_values["roomAFocus"],
        request_values["roomBFocus"],
        request_values["roomCFocus"],
        request_values["roomDFocus"],
        followup_request=request_values.get("followupRequest", ""),
        previous_analysis=request_values.get("previousAnalysis", ""),
    )

    response = current_app.config["OPENAI_CLIENT"].responses.create(
        model="gpt-5.4",
        input=prompt,
    )
    return response.output_text, None


def _stream_json_event(event_name, payload):
    return f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"


def _stream_planner_analysis_events(request_values):
    yield _stream_json_event("status", {"message": "Validating saved cat rows..."})
    normalized_cats, validation_errors = _validate_and_normalize_cats_data(request_values["cats"])
    if validation_errors:
        yield _stream_json_event(
            "error",
            {
                "reason": "validation",
                "errors": validation_errors,
            },
        )
        return

    yield _stream_json_event("status", {"message": "Building planner prompt..."})
    prompt = _build_analysis_prompt(
        normalized_cats,
        request_values["priorityOrder"],
        request_values["roomAFocus"],
        request_values["roomBFocus"],
        request_values["roomCFocus"],
        request_values["roomDFocus"],
        followup_request=request_values.get("followupRequest", ""),
        previous_analysis=request_values.get("previousAnalysis", ""),
    )

    yield _stream_json_event("status", {"message": "Submitting request to ChatGPT..."})

    output_chunks = []
    has_started_streaming = False
    completed = False

    try:
        stream = current_app.config["OPENAI_CLIENT"].responses.create(
            model="gpt-5.4",
            input=prompt,
            stream=True,
        )

        for event in stream:
            event_type = getattr(event, "type", "")

            if event_type == "response.created":
                yield _stream_json_event("status", {"message": "ChatGPT accepted the request."})
                continue

            if event_type == "response.output_text.delta":
                delta = getattr(event, "delta", "")
                if not delta:
                    continue

                if not has_started_streaming:
                    has_started_streaming = True
                    yield _stream_json_event("status", {"message": "Streaming recommendation..."})

                output_chunks.append(delta)
                yield _stream_json_event("output_delta", {"delta": delta})
                continue

            if event_type == "response.completed":
                completed = True
                final_response = getattr(event, "response", None)
                final_text = getattr(final_response, "output_text", "") or "".join(output_chunks)
                yield _stream_json_event("status", {"message": "Finalizing recommendation..."})
                yield _stream_json_event("completed", {"analysis": final_text})
                return

            if event_type in {"response.failed", "error"}:
                error = getattr(event, "error", None)
                error_message = getattr(error, "message", "") or "The planner request failed."
                yield _stream_json_event(
                    "error",
                    {
                        "reason": "request",
                        "error": error_message,
                    },
                )
                return
    except Exception as err:
        yield _stream_json_event(
            "error",
            {
                "reason": "request",
                "error": str(err) or "The planner request failed.",
            },
        )
        return

    if completed:
        return

    final_text = "".join(output_chunks)
    if final_text:
        yield _stream_json_event("completed", {"analysis": final_text})
        return

    yield _stream_json_event(
        "error",
        {
            "reason": "request",
            "error": "The model finished without returning any recommendation text.",
        },
    )


def _stream_planner_response(request_values):
    return Response(
        stream_with_context(_stream_planner_analysis_events(request_values)),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@breeding_planner_bp.route("/planner")
def planner():
    return send_from_directory("static/breeding_planner", "planner.html")


@breeding_planner_bp.route("/planner-config", methods=["GET"])
def planner_config():
    return jsonify(
        {
            "defaultPriorityOrder": DEFAULT_PRIORITY_ORDER,
            "defaultRoomAFocus": DEFAULT_ROOM_A_FOCUS,
            "defaultRoomBFocus": DEFAULT_ROOM_B_FOCUS,
            "defaultRoomCFocus": DEFAULT_ROOM_C_FOCUS,
            "defaultRoomDFocus": DEFAULT_ROOM_D_FOCUS,
            "defaultSkillMappings": DEFAULT_SKILL_MAPPINGS,
        }
    )


@breeding_planner_bp.route("/openai-status", methods=["GET"])
def openai_status():
    return jsonify(_get_openai_status())


@breeding_planner_bp.route("/analyze", methods=["POST"])
def analyze():
    unavailable = _require_openai_features()
    if unavailable:
        return unavailable

    data = request.get_json(silent=True) or {}
    request_values, error = _read_analysis_request(data)
    if error:
        return jsonify({"error": error}), 400

    analysis, validation_errors = _run_planner_analysis(request_values)
    if validation_errors:
        return (
            jsonify(
                {
                    "error": "Invalid cat rows format.",
                    "details": validation_errors,
                }
            ),
            400,
        )

    return jsonify({"analysis": analysis})


@breeding_planner_bp.route("/analyze-stream", methods=["POST"])
def analyze_stream():
    unavailable = _require_openai_features()
    if unavailable:
        return unavailable

    data = request.get_json(silent=True) or {}
    request_values, error = _read_analysis_request(data)
    if error:
        return jsonify({"error": error}), 400

    return _stream_planner_response(request_values)


@breeding_planner_bp.route("/analyze-followup", methods=["POST"])
def analyze_followup():
    unavailable = _require_openai_features()
    if unavailable:
        return unavailable

    data = request.get_json(silent=True) or {}
    request_values, error = _read_analysis_request(data, require_followup=True)
    if error:
        return jsonify({"error": error}), 400

    analysis, validation_errors = _run_planner_analysis(request_values)
    if validation_errors:
        return (
            jsonify(
                {
                    "error": "Invalid cat rows format.",
                    "details": validation_errors,
                }
            ),
            400,
        )

    return jsonify({"analysis": analysis})


@breeding_planner_bp.route("/analyze-followup-stream", methods=["POST"])
def analyze_followup_stream():
    unavailable = _require_openai_features()
    if unavailable:
        return unavailable

    data = request.get_json(silent=True) or {}
    request_values, error = _read_analysis_request(data, require_followup=True)
    if error:
        return jsonify({"error": error}), 400

    return _stream_planner_response(request_values)
