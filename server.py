import os

from dotenv import load_dotenv
from flask import Flask
from openai import OpenAI

from breeding_planner import breeding_planner_bp
from screenshot_parser import screenshot_parser_bp


def create_app():
    load_dotenv()

    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY. Set it in .env or environment variables.")

    app = Flask(__name__, static_folder="static")
    app.config["OPENAI_CLIENT"] = OpenAI(api_key=api_key)

    app.register_blueprint(screenshot_parser_bp)
    app.register_blueprint(breeding_planner_bp)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(port=5000, debug=True)

