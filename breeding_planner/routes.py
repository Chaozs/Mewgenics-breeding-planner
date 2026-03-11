from pathlib import Path
import re

from flask import Blueprint, current_app, jsonify, request, send_from_directory


PROMPT_PATH = Path(__file__).resolve().parent / "prompt.txt"
PLANNER_PROMPT_TEMPLATE = PROMPT_PATH.read_text(encoding="utf-8")
DEFAULT_PRIORITY_ORDER = """body: any
head: plusHealth -> fear -> any
tail: backflip -> moreMovePerTurn
leg: tileImmunity -> plusDex -> any
arm: randomDebuff -> jumpMove -> any
eye: confusion -> moreMoveLessLuck -> reflect -> any
eyebrow: plusRange -> any
ear: burn -> any
mouth: bonusAttackChance -> leech -> bleed -> any
fur: plusInt -> moreMoveLessLuck -> any"""
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
ANALYSIS_DEFAULTS = {
    "priorityOrder": DEFAULT_PRIORITY_ORDER,
    "roomAFocus": DEFAULT_ROOM_A_FOCUS,
    "roomBFocus": DEFAULT_ROOM_B_FOCUS,
    "roomCFocus": DEFAULT_ROOM_C_FOCUS,
    "roomDFocus": DEFAULT_ROOM_D_FOCUS,
}
ANALYSIS_FIELD_ERRORS = {
    "priorityOrder": "Priority order must be text.",
    "roomAFocus": "Room A focus must be text.",
    "roomBFocus": "Room B focus must be text.",
    "roomCFocus": "Room C focus must be text.",
    "roomDFocus": "Room D focus must be text.",
}
EXPECTED_COLUMNS = 25
ALLOWED_GENDERS = {"M", "F", "?"}
ALLOWED_BREED_WITH = {"X", "M", "F", "?"}
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

    if normalized_breed_with != "X":
        return normalized_breed_with
    if normalized_gender == "M":
        return "F"
    if normalized_gender == "F":
        return "M"
    return "?"


def _row_context(line_number, columns):
    cat_name = ""
    if columns and len(columns) > 0:
        cat_name = (columns[0] or "").strip()
    if cat_name:
        return f"Line {line_number} [Cat: {cat_name}]"
    return f"Line {line_number}"


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

        gender = columns[1].upper()
        if gender not in ALLOWED_GENDERS:
            errors.append(
                f'{context} Column "Gender": value "{columns[1]}" is invalid. Expected M, F, or ?.'
            )

        breed_with = columns[2].upper()
        if breed_with not in ALLOWED_BREED_WITH:
            errors.append(
                f'{context} Column "BreedWith": value "{columns[2]}" is invalid. Expected x, ?, M, or F.'
            )

        stat_labels = ["Str", "Dex", "Health", "Int", "Move", "Char", "Luck"]
        stat_values = columns[3:10]
        for stat_label, stat_value in zip(stat_labels, stat_values):
            if stat_value not in {"0", "1"}:
                errors.append(
                    f'{context} Column "{stat_label}": value "{stat_value}" is invalid. Expected 0 or 1.'
                )

        if any(error.startswith(context) for error in errors):
            continue

        valid_rows += 1
        columns[1] = gender
        columns[2] = _normalize_breed_with_for_gender(breed_with, gender)
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
        }
    )


@breeding_planner_bp.route("/analyze", methods=["POST"])
def analyze():
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


@breeding_planner_bp.route("/analyze-followup", methods=["POST"])
def analyze_followup():
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
