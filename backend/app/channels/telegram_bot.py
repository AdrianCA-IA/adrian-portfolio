"""Canal Telegram — el agente demo en vivo.

Reutiliza el MISMO núcleo LangGraph (`run_agent`, channel="telegram"). En dev usa
long-polling (no necesita URL pública); en producción se migraría a webhook.

Arrancar (desde la carpeta backend, con el venv):
    .venv/Scripts/python.exe -m app.channels.telegram_bot

Requiere TELEGRAM_BOT_TOKEN en el .env (créalo con @BotFather).
Para tus avisos de leads, pon ADRIAN_TELEGRAM_CHAT_ID en el .env: escribe /id al
bot y te devuelve tu chat_id.
"""
from __future__ import annotations

import logging
from collections import defaultdict

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from ..agent.agent import run_agent
from ..core.config import get_settings
from ..core.ratelimit import check_rate_limit

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("telegram-demo")

# httpx registra la URL completa de cada request a INFO, y esa URL INCLUYE el token
# del bot (…/bot<TOKEN>/getUpdates). Lo subimos a WARNING para NO filtrar el token.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# Estado en memoria (suficiente para un único proceso en dev).
_history: dict[int, list] = defaultdict(list)   # chat_id -> [{role, content}, ...]
_notified: set[int] = set()                     # chats ya avisados a Adrian
_HISTORY_TURNS = 12

_GREETING = {
    "es": ("¡Hey! 👋 Soy el *agente demo* de Adrian (Data Engineer & AI). "
           "Pregúntame lo que quieras sobre su CV, o cuéntame tu caso y vemos qué "
           "proyecto de IA podríais montar. Soy una demo, con guardarraíles 😄"),
    "en": ("Hey! 👋 I'm Adrian's *demo agent* (Data Engineer & AI). "
           "Ask me anything about his CV, or tell me your use case and we'll explore "
           "what AI project you two could build. I'm a demo, with guardrails 😄"),
}
_RATE_MSG = {
    "es": "Vas muy rápido 🙏 Espera un momentito y seguimos.",
    "en": "You're going too fast 🙏 Give it a moment and we'll continue.",
}


def _lang(update: Update) -> str:
    u = update.effective_user
    code = (u.language_code or "es") if u else "es"
    return "en" if code.startswith("en") else "es"


async def _notify_adrian(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Avisa a Adrian (una vez por chat) cuando alguien prueba la demo."""
    s = get_settings()
    if not s.adrian_telegram_chat_id:
        return
    chat_id = update.effective_chat.id
    if chat_id in _notified or str(chat_id) == str(s.adrian_telegram_chat_id):
        return
    _notified.add(chat_id)
    u = update.effective_user
    who = ("@" + u.username) if (u and u.username) else (u.full_name if u else str(chat_id))
    try:
        await context.bot.send_message(
            chat_id=s.adrian_telegram_chat_id,
            text=f"👀 Alguien está probando tu agente demo en Telegram: {who} (id {chat_id}).",
        )
    except Exception:
        log.exception("No se pudo avisar a Adrian")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    lang = _lang(update)
    await _notify_adrian(update, context)
    await update.message.reply_text(_GREETING[lang], parse_mode="Markdown")


async def cmd_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Devuelve el chat_id (para configurar ADRIAN_TELEGRAM_CHAT_ID)."""
    await update.message.reply_text(f"chat_id: {update.effective_chat.id}")


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    text = (update.message.text or "").strip()
    if not text:
        return
    lang = _lang(update)

    allowed, _ = check_rate_limit(f"tg:{chat_id}")
    if not allowed:
        await update.message.reply_text(_RATE_MSG[lang])
        return

    await context.bot.send_chat_action(chat_id=chat_id, action="typing")
    hist = _history[chat_id]
    result = run_agent(text, list(hist), lang, channel="telegram")
    reply = result.get("reply", "")

    hist.append({"role": "user", "content": text})
    hist.append({"role": "assistant", "content": reply})
    del hist[:-_HISTORY_TURNS]   # conserva solo los últimos turnos

    await _notify_adrian(update, context)
    await update.message.reply_text(reply)


def main() -> None:
    s = get_settings()
    if not s.telegram_bot_token:
        raise SystemExit(
            "Falta TELEGRAM_BOT_TOKEN en el .env. Créalo con @BotFather y pégalo ahí."
        )
    app = Application.builder().token(s.telegram_bot_token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("id", cmd_id))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    log.info("Agente demo de Telegram arrancado (long-polling). Ctrl+C para parar.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
