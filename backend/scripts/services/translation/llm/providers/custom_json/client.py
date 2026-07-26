from __future__ import annotations

import copy
import json
import os
import re
from typing import Any

import requests

from services.translation.llm.shared.http_transport import (
    get_session,
    is_transport_error,
    request_with_retries,
    use_stream_responses,
)


DEFAULT_BASE_URL = "https://example.com"
DEFAULT_MODEL = ""
DEFAULT_API_KEY_ENV = "RETAIN_TRANSLATION_API_KEY"
REQUEST_FORMAT_ENV = "RETAIN_TRANSLATION_REQUEST_FORMAT_JSON"
_FULL_PLACEHOLDER = re.compile(r"^\{\{([a-z_]+)\}\}$")
_PATH_PART = re.compile(r"(?P<key>[^.\[\]]+)|\[(?P<index>\d+)\]")


def normalize_base_url(base_url: str) -> str:
    return (base_url or DEFAULT_BASE_URL).strip().rstrip("/")


def _format() -> dict[str, Any]:
    raw = os.environ.get(REQUEST_FORMAT_ENV, "").strip()
    if not raw:
        raise RuntimeError(f"Missing custom request format in {REQUEST_FORMAT_ENV}.")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("custom request format must be a JSON object")
    return payload


def chat_completions_url(base_url: str) -> str:
    request = _format().get("request", {})
    path = str(request.get("path", "") or "")
    return f"{normalize_base_url(base_url)}/{path.lstrip('/')}"


def build_headers(api_key: str) -> dict[str, str]:
    request = _format().get("request", {})
    variables = {"api_key": api_key}
    headers = request.get("headers", {})
    return {
        str(key): str(_render(value, variables))
        for key, value in headers.items()
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
    config = _format()
    request = config.get("request", {})
    system_prompt = "\n\n".join(
        str(message.get("content", ""))
        for message in messages
        if message.get("role") == "system"
    )
    variables = {
        "api_key": get_api_key(api_key),
        "model": model,
        "system_prompt": system_prompt,
        "messages": messages,
        "temperature": temperature,
        "response_schema": response_format or {},
    }
    headers = {
        str(key): str(_render(value, variables))
        for key, value in (request.get("headers", {}) or {}).items()
    }
    body = _render(copy.deepcopy(request.get("body", {})), variables)
    stream_config = config.get("stream", {}) or {}
    use_stream = bool(stream_config.get("enabled")) and use_stream_responses()
    response = request_with_retries(
        method=str(request.get("method", "POST") or "POST"),
        url=chat_completions_url(base_url),
        headers=headers,
        body=body,
        timeout=timeout,
        stream=use_stream,
        max_attempts=max_attempts,
        request_label=request_label,
    )
    if use_stream:
        return _read_stream(response, stream_config)
    payload = response.json()
    value = _extract_path(payload, str((config.get("response", {}) or {}).get("content_path", "")))
    return _text(value)


def _render(value: Any, variables: dict[str, Any]) -> Any:
    if isinstance(value, str):
        full = _FULL_PLACEHOLDER.match(value)
        if full:
            return copy.deepcopy(variables.get(full.group(1), ""))
        rendered = value
        for name, replacement in variables.items():
            rendered = rendered.replace(f"{{{{{name}}}}}", str(replacement))
        return rendered
    if isinstance(value, list):
        return [_render(item, variables) for item in value]
    if isinstance(value, dict):
        return {str(key): _render(item, variables) for key, item in value.items()}
    return value


def _extract_path(payload: Any, path: str) -> Any:
    current = payload
    for match in _PATH_PART.finditer(path):
        key = match.group("key")
        index = match.group("index")
        if key is not None:
            if not isinstance(current, dict):
                raise KeyError(path)
            current = current[key]
        elif index is not None:
            if not isinstance(current, list):
                raise KeyError(path)
            current = current[int(index)]
    return current


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(_text(item) for item in value)
    if isinstance(value, dict) and "text" in value:
        return _text(value["text"])
    return str(value or "")


def _read_stream(response: requests.Response, config: dict[str, Any]) -> str:
    prefix = str(config.get("data_prefix", "data:") or "data:")
    done = str(config.get("done_sentinel", "[DONE]") or "[DONE]")
    content_path = str(config.get("content_path", "") or "")
    chunks: list[str] = []
    for raw in response.iter_lines(decode_unicode=True):
        line = (raw or "").strip()
        if not line.startswith(prefix):
            continue
        data = line[len(prefix) :].strip()
        if not data or data == done:
            continue
        chunks.append(_text(_extract_path(json.loads(data), content_path)))
    return "".join(chunks)
