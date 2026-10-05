"""Eventos hacia n8n — el agente "avisa" y n8n hace la fontanería.

Patrón:  agente (LangGraph, el cerebro) → POST evento → n8n (Sheets, Telegram, email…)

- `detect_lead`  heurística barata: ¿el mensaje trae email/teléfono o intención de
                 contratar/colaborar? Devuelve el motivo o None.
- `emit_event`   envía el evento a N8N_WEBHOOK_URL en un hilo aparte (fire-and-forget):
                 nunca bloquea ni rompe la respuesta al usuario. Sin URL → no hace nada.
"""
from __future__ import annotations

import logging
import re
import threading
from datetime import datetime, timezone

import httpx

from .config import get_settings

log = logging.getLogger("portfolio-assistant.events")

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\s-]{7,}\d")
_INTENT = re.compile(
    r"(contrat|entrevista|oferta|vacante|puesto|presupuesto|propuesta|colabor|proyecto para|"
    r"hire|hiring|interview|job offer|position|quote|budget|collaborat|freelance)",
    re.IGNORECASE,
)


def detect_lead(text: str) -> str | None:
    """Devuelve el motivo del lead ("email", "telefono", "intencion") o None."""
    t = text or ""
    if _EMAIL.search(t):
        return "email"
    if _PHONE.search(t):
        return "telefono"
    if _INTENT.search(t):
        return "intencion"
    return None


def _post(url: str, secret: str, payload: dict) -> None:
    headers = {"X-N8N-Secret": secret} if secret else {}
    try:
        r = httpx.post(url, json=payload, headers=headers, timeout=5)
        if r.status_code >= 400:
            log.error("n8n respondió %s: %s", r.status_code, r.text[:200])
    except Exception:
        log.exception("No se pudo enviar el evento a n8n")


def emit_event(event: str, data: dict) -> None:
    """Envía {"event", "ts", ...data} a n8n sin bloquear. No-op si no hay URL."""
    s = get_settings()
    if not s.n8n_webhook_url:
        return
    payload = {"event": event, "ts": datetime.now(timezone.utc).isoformat(), **data}
    threading.Thread(target=_post, args=(s.n8n_webhook_url, s.n8n_webhook_secret, payload),
                     daemon=True).start()


def maybe_emit_lead(text: str, channel: str, lang: str, reply: str = "") -> None:
    """Si el mensaje parece un lead, lo manda a n8n."""
    reason = detect_lead(text)
    if reason:
        emit_event("lead", {"channel": channel, "lang": lang, "reason": reason,
                            "message": text, "reply": reply[:500]})
