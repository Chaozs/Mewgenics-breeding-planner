import base64
from pathlib import Path

from flask import Blueprint, current_app, jsonify, redirect, request, url_for


PROMPT_PATH = Path(__file__).resolve().parent / "prompt.txt"
SCREENSHOT_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")

screenshot_parser_bp = Blueprint("screenshot_parser", __name__)


@screenshot_parser_bp.route("/")
def index():
    return redirect(url_for("breeding_planner.planner"))


@screenshot_parser_bp.route("/parse", methods=["POST"])
def parse():
    uploaded_file = request.files.get("image")
    if uploaded_file is None:
        return jsonify({"error": "No image file received."}), 400

    image_bytes = uploaded_file.read()
    if not image_bytes:
        return jsonify({"error": "Uploaded file was empty."}), 400

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    response = current_app.config["OPENAI_CLIENT"].responses.create(
        model="gpt-5.4",
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": SCREENSHOT_PROMPT},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/png;base64,{base64_image}",
                    },
                ],
            }
        ],
    )

    row = response.output_text.strip()
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
