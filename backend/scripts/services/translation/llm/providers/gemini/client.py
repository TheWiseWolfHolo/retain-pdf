from __future__ import annotations

import json
import os
from typing import Any
from urllib.parse import quote

import requests

from services.translation.llm.shared.http_transport import (
    get_session,
    is_transport_error,
    request_with_retries,
    use_stream_responses,
)


DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-flash"
DEFAULT_API_KEY_ENV = "RETAIN_TRANSLATION_API_KEY"


def normalize_base_url(base_url: str) -> str:
    return (base_url or DEFAULT_BASE_URL).strip().rstrip("/")


def chat_completions_url(base_url: str, model: str = DEFAULT_MODEL, *, stream: bool = False) -> str:
    method = "streamGenerateContent?alt=sse" if stream else "generateContent"
    return f"{normalize_base_url(base_url)}/models/{quote(model, safe='-._')}:{{method}}".format(method=method)


def build_headers(api_key: str) -> dict[str, str]:
    return {"content-type": "application/json", "x-goog-api-key": api_key.strip()}


def get_api_key(
    explicit_api_key: str = "",
    env_var: str = DEFAULT_API_KEY_ENV,
    required: bool = True,
) -> str:
    value = explicit_api_key.strip() or os.environ.get(env_var, "").strip()
    if required and not value:
        raise RuntimeError(f"Missing API key. Set {env_var}.")
    return value


def request_chat_content(
    messages: list[dict[str, str]],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    temperature: float = 0.2,
    response_format: dict[str, Any] | None = None,
    timeout: int = 120,
    request_label: str = "",
    max_attempts: int | None = None,
) -> str:
    system_parts = [
        {"text": str(message.get("content", ""))}
        for message in messages
        if message.get("role") == "system"
    ]
    contents = [
        {
            "role": "model" if message.get("role") == "assistant" else "user",
            "parts": [{"text": str(message.get("content", ""))}],
        }
        for message in messages
        if message.get("role") != "system"
    ]
    generation_config: dict[str, Any] = {"temperature": temperature}
    if response_format is not None:
        generation_config["responseMimeType"] = "application/json"
        schema = _response_schema(response_format)
        if schema:
            generation_config["responseJsonSchema"] = schema
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": generation_config,
    }
    if system_parts:
        body["systemInstruction"] = {"parts": system_parts}
    use_stream = use_stream_responses()
    response = request_with_retries(
        method="POST",
        url=chat_completions_url(base_url, model, stream=use_stream),
        headers=build_headers(get_api_key(api_key)),
        body=body,
        timeout=timeout,
        stream=use_stream,
        max_attempts=max_attempts,
        request_label=request_label,
    )
    if use_stream:
        return _read_stream(response)
    return _extract_text(response.json())


def _response_schema(response_format: dict[str, Any]) -> dict[str, Any] | None:
    if response_format.get("type") == "json_schema":
        schema = response_format.get("json_schema", {})
        if isinstance(schema, dict):
            nested = schema.get("schema")
            return nested if isinstance(nested, dict) else schema
    return None


def _extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates", [])
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts", [])
    return "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict))


def _read_stream(response: requests.Response) -> str:
    chunks: list[str] = []
    for raw in response.iter_lines(decode_unicode=True):
        line = (raw or "").strip()
        if line.startswith("data:"):
            chunks.append(_extract_text(json.loads(line[5:].strip())))
    return "".join(chunks)
