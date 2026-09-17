"""Rate limiter en memoria (por IP) — guardarraíl de coste/abuso.

Nota: es en memoria, por lo que no se comparte entre instancias de Cloud Run ni
sobrevive a reinicios. Suficiente para la Fase 1; en fases posteriores se puede
mover a Redis/Firestore si hace falta un límite global fiable.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from .config import get_settings

_minute_hits: dict[str, deque[float]] = defaultdict(deque)
_day_hits: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(client_id: str) -> tuple[bool, str]:
    """Devuelve (permitido, motivo). Si permitido, registra el hit."""
    s = get_settings()
    now = time.time()

    mq = _minute_hits[client_id]
    while mq and now - mq[0] > 60:
        mq.popleft()

    dq = _day_hits[client_id]
    while dq and now - dq[0] > 86_400:
        dq.popleft()

    if len(mq) >= s.rate_limit_per_min:
        return False, "rate_minute"
    if len(dq) >= s.rate_limit_per_day:
        return False, "rate_day"

    mq.append(now)
    dq.append(now)
    return True, ""
