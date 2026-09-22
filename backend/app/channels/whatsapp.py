"""Canal WhatsApp — WhatsApp Business Cloud API (Fase 4).

A diferencia de Telegram (long-polling), WhatsApp es **webhook**: Meta manda los
mensajes entrantes a una URL pública. Por eso este canal son rutas dentro de la
app FastAPI (se prueban con un túnel en dev, o ya desplegado en Cloud Run).

Rutas:
  GET  /webhook/whatsapp  → verificación del webhook (Meta manda hub.challenge).
  POST /webhook/whatsapp  → mensajes entrantes → run_agent(channel="whatsapp") → responde.

Reutiliza el MISMO núcleo LangGraph. Requiere en .env: WHATSAPP_PHONE_NUMBER_ID,
WHATSAPP_TOKEN y WHATSAPP_VERIFY_TOKEN.
"""
from __future__ import annotations

import logging
from collections import defaultdict

import httpx
from fastapi import APIRouter, Query, Request, Response

from ..agent.agent import run_agent
from ..core.config import get_settings
from ..core.ratelimit import check_rate_limit

log = logging.getLogger("whatsapp-demo")
router = APIRouter()

# Historial en memoria por remitente (suficiente para dev / un solo proceso).
_history: dict[str, list] = defaultdict(list)
_HISTORY_TURNS = 12


@router.get("/webhook/whatsapp")
def verify_webhook(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    """Meta llama a esta ruta al configurar el webhook; devolvemos el challenge."""
    s = get_settings()
    if hub_mode == "subscribe" and hub_verify_token and hub_verify_token == s.whatsapp_verify_token:
        return Response(content=hub_challenge or "", media_type="text/plain")
    return Response(status_code=403, content="forbidden")


@router.post("/webhook/whatsapp")
async def receive(request: Request):
    """Recibe mensajes entrantes y responde con el agente."""
    try:
        data = await request.json()
    except Exception:
        return {"status": "ignored"}

    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    if msg.get("type") != "text":
                        continue
                    sender = msg.get("from", "")
                    text = (msg.get("text", {}).get("body") or "").strip()
                    if not sender or not text:
                        continue
                    await _handle_message(sender, text)
    except Exception:
        log.exception("Error procesando el webhook de WhatsApp")

    # Siempre 200 para que Meta no reintente en bucle.
    return {"status": "ok"}


async def _handle_message(sender: str, text: str) -> None:
    allowed, _ = check_rate_limit(f"wa:{sender}")
    if not allowed:
        await _send(sender, "Vas muy rápido 🙏 Espera un momentito y seguimos.")
        return

    hist = _history[sender]
    result = run_agent(text, list(hist), lang="es", channel="whatsapp")
    reply = result.get("reply", "")

    hist.append({"role": "user", "content": text})
    hist.append({"role": "assistant", "content": reply})
    del hist[:-_HISTORY_TURNS]

    await _send(sender, reply)


async def _send(to: str, text: str) -> None:
    """Envía un mensaje de texto por la Cloud API."""
    s = get_settings()
    if not (s.whatsapp_phone_number_id and s.whatsapp_token):
        log.warning("WhatsApp no configurado (falta phone_number_id/token); no se envía.")
        return
    url = f"https://graph.facebook.com/{s.whatsapp_api_version}/{s.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    headers = {"Authorization": f"Bearer {s.whatsapp_token}"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code >= 400:
                log.error("WhatsApp send falló %s: %s", r.status_code, r.text[:300])
    except Exception:
        log.exception("No se pudo enviar el mensaje de WhatsApp")
