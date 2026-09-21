"""Interfaz del agente — ejecuta el grafo LangGraph.

`run_agent` es el único punto de entrada que usan los canales (web/Telegram/
WhatsApp). Devuelve el texto de respuesta y, si procede, la info de handoff
(enlaces de demo) para que el canal muestre botones.
"""
from __future__ import annotations

from .graph import get_graph


def run_agent(message: str, history: list[dict], lang: str = "es", channel: str = "web") -> dict:
    """Ejecuta el grafo y devuelve {"reply": str, "handoff": dict | None}."""
    state = {
        "user_text": message,
        "history": history,
        "lang": lang,
        "channel": channel,
    }
    result = get_graph().invoke(state)
    return {"reply": result.get("reply", ""), "handoff": result.get("handoff")}
