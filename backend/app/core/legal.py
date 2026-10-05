"""Avisos legales de primera capa (RGPD art. 13 + Reglamento UE de IA art. 50).

Un único sitio para los textos: si cambia la política, se cambia aquí y lo
heredan todos los canales (Telegram, WhatsApp, voz).
"""
from __future__ import annotations

PRIVACY_URL = "https://adrian-cajas-portfolio.web.app/privacidad.html"

# Canales de texto: se añade al primer mensaje de cada conversación.
CHAT_NOTICE = {
    "es": ("ℹ️ Te responde una inteligencia artificial y puede equivocarse. Tus mensajes se usan "
           f"para contestarte; solo guardamos los datos de contacto que nos dejes, para responderte. "
           f"Privacidad: {PRIVACY_URL}"),
    "en": ("ℹ️ You're talking to an AI and it can make mistakes. Your messages are only used to "
           f"reply to you; we only keep contact details you choose to share, to get back to you. "
           f"Privacy: {PRIVACY_URL}"),
}

# Voz: versión hablada (sin URL).
VOICE_NOTICE = {
    "es": "Te atiende una inteligencia artificial y no grabamos la llamada.",
    "en": "You're speaking with an artificial intelligence, and this call isn't recorded.",
}
