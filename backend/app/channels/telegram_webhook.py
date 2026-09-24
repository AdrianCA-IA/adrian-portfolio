"""Canal Telegram por WEBHOOK (producción / Cloud Run).

En dev usamos long-polling (telegram_bot.py). En producción, Cloud Run es
request-driven y no mantiene un proceso de polling vivo, así que Telegram
entrega los mensajes a este webhook. Reutiliza el MISMO núcleo LangGraph.

Ruta:  POST /webhook/telegram

Seguridad: Telegram envía la cabecera 'X-Telegram-Bot-Api-Secret-Token' con el
valor que fijamos al registrar el webhook (setWebhook); lo validamos aquí.
"""
from __future__ import annotations

import logging
from collections import defaultdict

import httpx
from fastapi import APIRouter, Header, Request, Response

from ..agent.agent import run_agent
from ..core.config import get_settings
from ..core.ratelimit import check_rate_limit

log = logging.getLogger("telegram-webhook")
router = APIRouter()

_history: dict[int, list] = defaultdict(list)
_notified: set[int] = set()
_HISTORY_TURNS = 12

_GREETING = {
    "es": ("¡Hey! 👋 Soy el *agente demo* de Adrian (Data Engineer & AI). "
           "Pregúntame lo que quieras sobre su CV, o cuéntame tu caso y vemos qué "
           "proyecto de IA podríais montar. Soy una demo, con guardarraíles 😄"),
    "en": ("Hey! 👋 I'm Adrian's *demo agent* (Data Engineer & AI). "
           "Ask me anything about his CV, or tell me your use case and we'll explore "
           "what AI project you two could build. I'm a demo, with guardrails 😄"),
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
            r = await client.post(url, json=payload)
            if r.status_code >= 400:
                log.error("Telegram %s falló %s: %s", method, r.status_code, r.text[:200])
    except Exception:
        log.exception("Error llamando a Telegram %s", method)


async def _notify_adrian(chat_id: int, frm: dict) -> None:
    s = get_settings()
    if not s.adrian_telegram_chat_id:
        return
    if chat_id in _notified or str(chat_id) == str(s.adrian_telegram_chat_id):
        return
    _notified.add(chat_id)
    who = ("@" + frm["username"]) if frm.get("username") else frm.get("first_name", "alguien")
    await _tg("sendMessage", {
        "chat_id": s.adrian_telegram_chat_id,
        "text": f"👀 Alguien está probando tu agente demo en Telegram: {who} (id {chat_id}).",
    })


@router.post("/webhook/telegram")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    s = get_settings()
    if s.telegram_webhook_secret and x_telegram_bot_api_secret_token != s.telegram_webhook_secret:
        return Response(status_code=403, content="forbidden")

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()
    if not chat_id or not text:
        return {"ok": True}

    frm = msg.get("from") or {}
    lang = "en" if (frm.get("language_code") or "es").startswith("en") else "es"

    if text.startswith("/id"):
        await _tg("sendMessage", {"chat_id": chat_id, "text": f"chat_id: {chat_id}"})
        return {"ok": True}

    if text.startswith("/start"):
        await _notify_adrian(chat_id, frm)
        await _tg("sendMessage", {"chat_id": chat_id, "text": _GREETING[lang], "parse_mode": "Markdown"})
        return {"ok": True}

    allowed, _ = check_rate_limit(f"tg:{chat_id}")
    if not allowed:
        await _tg("sendMessage", {"chat_id": chat_id, "text": _RATE[lang]})
        return {"ok": True}

    await _tg("sendChatAction", {"chat_id": chat_id, "action": "typing"})
    hist = _history[chat_id]
    result = run_agent(text, list(hist), lang, channel="telegram")
    reply = result.get("reply", "")
    hist.append({"role": "user", "content": text})
    hist.append({"role": "assistant", "content": reply})
    del hist[:-_HISTORY_TURNS]

    await _notify_adrian(chat_id, frm)
    await _tg("sendMessage", {"chat_id": chat_id, "text": reply})
    return {"ok": True}
