"""Datos de grounding del asistente (contexto del CV)."""
from __future__ import annotations

from pathlib import Path

_CTX: str | None = None


def load_cv_context() -> str:
    """Carga (y cachea) el contexto del CV desde cv_context.md."""
    global _CTX
    if _CTX is None:
        path = Path(__file__).parent / "cv_context.md"
        _CTX = path.read_text(encoding="utf-8")
    return _CTX
