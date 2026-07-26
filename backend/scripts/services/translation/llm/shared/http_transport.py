from __future__ import annotations

import os
import random
import threading
import time
from email.utils import parsedate_to_datetime
from typing import Any

import requests

from services.translation.llm.request_limits import wait_for_request_slot

STREAM_RESPONSES_ENV = "RETAIN_TRANSLATION_STREAM"
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}
_THREAD_LOCAL = threading.local()


def use_stream_responses() -> bool:
    value = os.environ.get(STREAM_RESPONSES_ENV, "")
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_session() -> requests.Session:
    session = getattr(_THREAD_LOCAL, "provider_session", None)
    if session is None:
        session = requests.Session()
        session.trust_env = os.environ.get("PDF_TRANSLATOR_TRUST_ENV_PROXY", "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        if not session.trust_env:
            session.proxies.clear()
        _THREAD_LOCAL.provider_session = session
    return session


def drop_session() -> None:
    session = getattr(_THREAD_LOCAL, "provider_session", None)
    if session is not None:
        session.close()
        _THREAD_LOCAL.provider_session = None


def is_transport_error(exc: Exception) -> bool:
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code in RETRYABLE_STATUS_CODES
    return False


def request_with_retries(
    *,
    method: str,
    url: str,
    headers: dict[str, str],
    body: Any = None,
    timeout: int = 120,
    stream: bool = False,
    max_attempts: int | None = None,
    request_label: str = "",
) -> requests.Response:
    attempts = max(1, int(max_attempts or 2))
    for attempt in range(1, attempts + 1):
        started = time.perf_counter()
        try:
            wait_for_request_slot()
            response = get_session().request(
                method=method.upper(),
                url=url,
                headers=headers,
                json=body,
                timeout=timeout,
                stream=stream,
            )
            if response.status_code >= 400:
                excerpt = " ".join((response.text or "").strip().split())[:800]
                raise requests.HTTPError(
                    f"{response.status_code} provider error for {url}: {excerpt or '<empty>'}",
                    response=response,
                )
            if request_label:
                print(
                    f"{request_label}: provider http ok in {time.perf_counter() - started:.2f}s",
                    flush=True,
                )
            return response
        except requests.RequestException as exc:
            if request_label:
                print(
                    f"{request_label}: provider http failed attempt {attempt}/{attempts}: {exc}",
                    flush=True,
                )
            if attempt >= attempts or not is_transport_error(exc):
                raise
            if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
                drop_session()
            delay = _retry_delay(exc, attempt)
            if request_label:
                print(f"{request_label}: retrying in {delay:.2f}s", flush=True)
            time.sleep(delay)
    raise RuntimeError("provider request failed without an exception")


def _retry_delay(exc: requests.RequestException, attempt: int) -> float:
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        raw = (exc.response.headers.get("Retry-After") or "").strip()
        if raw:
            try:
                return min(300.0, max(0.0, float(raw)))
            except ValueError:
                try:
                    value = parsedate_to_datetime(raw).timestamp() - time.time()
                    return min(300.0, max(0.0, value))
                except (TypeError, ValueError):
                    pass
    return min(20.0, (2 ** max(0, attempt - 1)) + random.random())
