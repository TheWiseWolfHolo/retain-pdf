from __future__ import annotations

import threading
import time


_LOCK = threading.RLock()
_MIN_INTERVAL_SECONDS = 0.0
_NEXT_ALLOWED_AT = 0.0
_CONFIG = {"rate_limit_qps": 0, "rate_limit_rpm": 0}


def normalize_rate_limit(value: int | float | str | None) -> int:
    try:
        normalized = int(float(value or 0))
    except (TypeError, ValueError):
        return 0
    return max(0, normalized)


def compute_min_interval_seconds(*, rate_limit_qps: int = 0, rate_limit_rpm: int = 0) -> float:
    qps = normalize_rate_limit(rate_limit_qps)
    rpm = normalize_rate_limit(rate_limit_rpm)
    intervals: list[float] = []
    if qps > 0:
        intervals.append(1.0 / qps)
    if rpm > 0:
        intervals.append(60.0 / rpm)
    return max(intervals) if intervals else 0.0


def configure_request_limits(*, rate_limit_qps: int = 0, rate_limit_rpm: int = 0, now: float | None = None) -> dict[str, float | int]:
    min_interval = compute_min_interval_seconds(
        rate_limit_qps=rate_limit_qps,
        rate_limit_rpm=rate_limit_rpm,
    )
    global _MIN_INTERVAL_SECONDS, _NEXT_ALLOWED_AT
    with _LOCK:
        _CONFIG["rate_limit_qps"] = normalize_rate_limit(rate_limit_qps)
        _CONFIG["rate_limit_rpm"] = normalize_rate_limit(rate_limit_rpm)
        _MIN_INTERVAL_SECONDS = min_interval
        _NEXT_ALLOWED_AT = max(0.0, float(now if now is not None else 0.0))
        return current_request_limit_config()


def current_request_limit_config() -> dict[str, float | int]:
    with _LOCK:
        return {
            "rate_limit_qps": _CONFIG["rate_limit_qps"],
            "rate_limit_rpm": _CONFIG["rate_limit_rpm"],
            "min_interval_seconds": _MIN_INTERVAL_SECONDS,
        }


def reserve_request_slot(now: float) -> float:
    global _NEXT_ALLOWED_AT
    with _LOCK:
        if _MIN_INTERVAL_SECONDS <= 0:
            return 0.0
        current = max(0.0, float(now))
        delay = max(0.0, _NEXT_ALLOWED_AT - current)
        _NEXT_ALLOWED_AT = max(current, _NEXT_ALLOWED_AT) + _MIN_INTERVAL_SECONDS
        return delay


def wait_for_request_slot() -> float:
    delay = reserve_request_slot(time.monotonic())
    if delay > 0:
        time.sleep(delay)
    return delay
