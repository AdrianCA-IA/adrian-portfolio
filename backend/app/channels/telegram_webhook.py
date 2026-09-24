"""Canal Telegram para PRODUCCIÓN — vía webhook (Cloud Run).

En dev usamos long-polling (`telegram_bot.py`, con python-telegram-bot). En Cloud
Run, que escala a cero, no cabe un proceso de polling: Telegram nos envía los
updates a esta ruta. Es autocontenido (API cruda con httpx, sin depender de PTB) y
reutiliza el MISMO núcleo LangGraph.

Tras desplegar, hay que registrar el webhook una vez:
    https://api.telegram.org/bot<TOKEN>/setWebhook?url=<CLOUD_RUN_URL>/webhook/telegram
"""
from __future__ import annotations

import logging
from collections import defaultdict

import httpx
from fastapi import APIRouter, Request

from ..agent.agent import run_agent
from ..core.config import get_settings
from ..core.ratelimit import check_rate_limit

log = logging.getLogger("telegram-webhook")
router = APIRouter()

_history: dict[int, list] = defaultdict(list)
_notified: set[int] = set()
_HISTORY_TURNS = 12

_GREETING = {
    "es": ("¡Hey! 👋 Soy el agente demo de Adrian (Data Engineer & AI). Pregúntame lo que "
           "quieras sobre su CV, o cuéntame tu caso y vemos qué proyecto de IA podríais montar. "
           "Soy una demo, con guardarraíles 😄"),
    "en": ("Hey! 👋 I'm Adrian's demo agent (Data Engineer & AI). Ask me anything about his CV, "
           "or tell me your use case and we'll explore what AI project you two could build. "
           "I'm a demo, with guardrails 😄"),
}
_RATE = {
    "es": "Vas muy rápido 🙏 Espera un momentito y seguimos.",
    "en": "You're going too fast 🙏 Give it a moment and we'll continue.",
}


async def _tg(method: str, payload: dict) -> None:
    s = get_settings()
    if not s.telegram_bot_token:
        return
    url = f"https://api.telegram.org/bot{s.telegram_bot_token}/{method}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            await client.post(url, json=payload)
    except Exception:
        log.exception("Fallo llamando a la API de Telegram (%s)", method)


async def _send(chat_id: int, text: str) -> None:
    await _tg("sendMessage", {"chat_id": chat_id, "text": text})


async def _notify_adrian(chat_id: int, user: dict) -> None:
    s = get_settings()
    if not s.adrian_telegram_chat_id or chat_id in _notified:
        return
    if str(chat_id) == str(s.adrian_telegram_chat_id):
        return
    _notified.add(chat_id)
    who = ("@" + user["username"]) if user.get("username") else str(chat_id)
    await _tg("sendMessage", {
        "chat_id": s.adrian_telegram_chat_id,
        "text": f"👀 Alguien está probando tu agente demo en Telegram: {who} (id {chat_id}).",
    })


@router.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    try:
        data = await request.json()
    except Exception:
        return {"ok": True}

    msg = data.get("message") or data.get("edited_message")
    if not msg:
        return {"ok": True}

    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()
    user = msg.get("from", {}) or {}
    lang = "en" if str(user.get("language_code", "es")).startswith("en") else "es"
    if chat_id is None or not text:
        return {"ok": True}

    try:
        if text.startswith("/start"):
            await _notify_adrian(chat_id, user)
            await _send(chat_id, _GREETING[lang])
            return {"ok": True}
        if text.startswith("/id"):
            await _send(chat_id, f"chat_id: {chat_id}")
            return {"ok": True}

        allowed, _ = check_rate_limit(f"tg:{chat_id}")
        if not allowed:
            await _send(chat_id, _RATE[lang])
            return {"ok": True}

        hist = _history[chat_id]
        result = run_agent(text, list(hist), lang, channel="telegram")
        reply = result.get("reply", "")
        hist.append({"role": "user", "content": text})
        hist.append({"role": "assistant", "content": reply})
        del hist[:-_HISTORY_TURNS]

        await _notify_adrian(chat_id, user)
        await _send(chat_id, reply)
    except Exception:
        log.exception("Error procesando update de Telegram")

    return {"ok": True}
