from __future__ import annotations

import json
import os
from typing import Any

import requests

from services.translation.llm.shared.http_transport import (
    get_session,
    is_transport_error,
    request_with_retries,
    use_stream_responses,
)


DEFAULT_BASE_URL = "https://api.anthropic.com"
DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_API_KEY_ENV = "RETAIN_TRANSLATION_API_KEY"


def normalize_base_url(base_url: str) -> str:
    value = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    if value.endswith("/v1/messages"):
        return value[: -len("/v1/messages")]
    return value


def chat_completions_url(base_url: str) -> str:
    base = normalize_base_url(base_url)
    return f"{base}/messages" if base.endswith("/v1") else f"{base}/v1/messages"


def build_headers(api_key: str) -> dict[str, str]:
    return {
        "content-type": "application/json",
        "x-api-key": api_key.strip(),
        "anthropic-version": "2023-06-01",
    }


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
    del response_format
    system_parts = [
        str(message.get("content", ""))
        for message in messages
        if message.get("role") == "system"
    ]
    provider_messages = [
        {
            "role": "assistant" if message.get("role") == "assistant" else "user",
            "content": str(message.get("content", "")),
        }
        for message in messages
        if message.get("role") != "system"
    ]
    use_stream = use_stream_responses()
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": 8192,
        "temperature": temperature,
        "messages": provider_messages,
        "stream": use_stream,
    }
    if system_parts:
        body["system"] = "\n\n".join(system_parts)
    response = request_with_retries(
        method="POST",
        url=chat_completions_url(base_url),
        headers=build_headers(get_api_key(api_key)),
        body=body,
        timeout=timeout,
        stream=use_stream,
        max_attempts=max_attempts,
        request_label=request_label,
    )
    if use_stream:
        return _read_stream(response)
    payload = response.json()
    return "".join(
        str(block.get("text", ""))
        for block in payload.get("content", [])
        if isinstance(block, dict) and block.get("type") == "text"
    )


def _read_stream(response: requests.Response) -> str:
    chunks: list[str] = []
    for raw in response.iter_lines(decode_unicode=True):
        line = (raw or "").strip()
        if not line.startswith("data:"):
            continue
        data = json.loads(line[5:].strip())
        if data.get("type") != "content_block_delta":
            continue
        delta = data.get("delta")
        if isinstance(delta, dict) and delta.get("type") == "text_delta":
            chunks.append(str(delta.get("text", "")))
    return "".join(chunks)
