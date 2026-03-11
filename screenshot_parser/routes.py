import base64
from pathlib import Path

from flask import Blueprint, current_app, jsonify, redirect, request, url_for


PROMPT_PATH = Path(__file__).resolve().parent / "prompt.txt"
SCREENSHOT_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")

screenshot_parser_bp = Blueprint("screenshot_parser", __name__)


def _build_screenshot_prompt(skill_mappings_text):
    prompt = SCREENSHOT_PROMPT
    mappings = (skill_mappings_text or "").strip()
    if not mappings:
        return prompt

    return (
        f"{prompt}\n\n"
        "Additional user-defined skill mappings:\n"
        f"{mappings}\n\n"
        "If the screenshot uses one of these descriptions, map it to the token on the right-hand side exactly "
        "before adding the (bodypart) suffix."
    )


@screenshot_parser_bp.route("/")
def index():
    return redirect(url_for("breeding_planner.planner"))


@screenshot_parser_bp.route("/parse", methods=["POST"])
def parse():
    client = current_app.config.get("OPENAI_CLIENT")
    status_cache = current_app.config.get("OPENAI_STATUS_CACHE") or {}
    if client is None:
        return (
            jsonify(
                {
                    "error": "OpenAI API key not configured. Screenshot parsing is disabled.",
                }
            ),
            503,
        )
    if status_cache.get("enabled") is False:
        return jsonify({"error": status_cache.get("message") or "Screenshot parsing is disabled."}), 503

    uploaded_file = request.files.get("image")
    if uploaded_file is None:
        return jsonify({"error": "No image file received."}), 400

    image_bytes = uploaded_file.read()
    if not image_bytes:
        return jsonify({"error": "Uploaded file was empty."}), 400

    skill_mappings = request.form.get("skillMappings", "")

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    try:
        response = client.responses.create(
            model="gpt-5.4",
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": _build_screenshot_prompt(skill_mappings)},
                        {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{base64_image}",
                        },
                    ],
                }
            ],
        )
    except Exception as err:
        return jsonify({"error": str(err) or "Screenshot parsing request failed."}), 502

    # Preserve tab-delimited empty columns; only trim line breaks around the model output.
    row = response.output_text.rstrip("\r\n")
    return jsonify({"row": row})


@screenshot_parser_bp.route("/save", methods=["POST"])
def save():
    data = request.get_json(silent=True) or {}
    row = (data.get("row") or "").strip()

    if not row:
        return jsonify({"error": "Row was empty."}), 400

    with open("cats.csv", "a", encoding="utf-8", newline="") as file_handle:
        file_handle.write(row + "\n")

    return jsonify({"status": "saved"})
