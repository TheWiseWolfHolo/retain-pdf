from __future__ import annotations

import os
import threading
import time


_LOCK = threading.Lock()
_NEXT_ALLOWED_AT = 0.0


def _limit(name: str) -> int:
    try:
        return max(0, int(float(os.environ.get(name, "0") or 0)))
    except ValueError:
        return 0


def min_interval_seconds() -> float:
    qps = _limit("RETAIN_TRANSLATION_RATE_LIMIT_QPS")
    rpm = _limit("RETAIN_TRANSLATION_RATE_LIMIT_RPM")
    intervals = [
        value
        for value in (
            1.0 / qps if qps else 0.0,
            60.0 / rpm if rpm else 0.0,
        )
        if value
    ]
    return max(intervals, default=0.0)


def wait_for_request_slot() -> float:
    interval = min_interval_seconds()
    if interval <= 0:
        return 0.0
    global _NEXT_ALLOWED_AT
    with _LOCK:
        now = time.monotonic()
        delay = max(0.0, _NEXT_ALLOWED_AT - now)
        _NEXT_ALLOWED_AT = max(now, _NEXT_ALLOWED_AT) + interval
    if delay:
        time.sleep(delay)
    return delay
