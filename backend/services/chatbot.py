import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").strip()


def resolve_model(default_model: str) -> str:
    model = os.getenv("OPENAI_MODEL", default_model).strip() or default_model
    if OPENAI_API_KEY.startswith("sk-or-") and "/" not in model:
        return f"openai/{model}"
    return model


def get_chat_client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key is not configured")

    base_url = OPENAI_BASE_URL
    if not base_url and OPENAI_API_KEY.startswith("sk-or-"):
        base_url = "https://openrouter.ai/api/v1"

    if base_url:
        return OpenAI(api_key=OPENAI_API_KEY, base_url=base_url)

    return OpenAI(api_key=OPENAI_API_KEY)
