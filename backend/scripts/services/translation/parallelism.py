from __future__ import annotations


def normalize_requested_workers(workers: int | float | str | None, *, default: int = 1) -> int:
    try:
        normalized = int(float(default if workers in (None, "") else workers))
    except (TypeError, ValueError):
        return max(1, int(default))
    if normalized == -1:
        return -1
    return max(1, normalized)


def resolve_executor_workers(
    workers: int | float | str | None,
    total_tasks: int,
    *,
    cap: int | None = None,
) -> int:
    requested = normalize_requested_workers(workers)
    total = max(1, int(total_tasks))
    resolved = total if requested == -1 else requested
    if cap is not None:
        resolved = min(resolved, max(1, int(cap)))
    return max(1, min(resolved, total))
