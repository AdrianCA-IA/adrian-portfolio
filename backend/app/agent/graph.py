"""Grafo LangGraph del agente — Fase 2.

Flujo:  START → classify → (chat) respond → END
                        └→ (handoff) handoff → END

- `classify`  decide si el visitante quiere PROBAR la demo del agente.
- `respond`   respuesta normal anclada al CV (puede ofrecer la demo).
- `handoff`   devuelve el mensaje + enlaces/botones de Telegram/WhatsApp.

El mismo grafo se reutiliza en los canales web, Telegram y WhatsApp. Las piezas
(build de mensajes, detección de handoff, payload de handoff, LLM) se exponen como
funciones para poder reutilizarlas también en el endpoint de streaming.
"""
from __future__ import annotations

import re
from typing import Optional, TypedDict
from urllib.parse import quote

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from ..core.config import get_settings
from ..core.llm import build_llm
from ..data import load_cv_context
from .prompts import build_system_prompt


class ChatState(TypedDict, total=False):
    user_text: str
    history: list          # [{"role": "user"|"assistant", "content": str}, ...]
    lang: str              # "es" | "en"
    channel: str           # "web" | "telegram" | "whatsapp"
    intent: str            # "chat" | "handoff"
    reply: str
    handoff: Optional[dict]  # {"telegram_url": str, "whatsapp_url": str} | None


# ── LLM (perezoso, compartido) ─────────────────────────────────────────
_llm = None
_HISTORY_TURNS = 6


def get_llm():
    global _llm
    if _llm is None:
        _llm = build_llm()
    return _llm


# ── Detección de intención (heurística; barata y sin latencia extra) ───
# Bilingüe (ES + EN).
_AFFIRM = (r"(s[ií]+|yes|yeah|yep|sure|vale|dale+|claro|ok(?:ay)?|venga|por supuesto|of\s*course|"
           r"quiero|i\s*want|i'?d\s*like|me gustar[ií]a|let'?s|va|genial|perfecto|great)")
_DEMO = r"(prob(ar|arlo|émoslo|amos)|try|test|show|demo|agente|agent|whats?app|telegram|bot)"


def _wants_demo(user_text: str, history: list) -> bool:
    t = (user_text or "").lower().strip()
    if not t:
        return False
    if re.search(_DEMO, t) and re.search(_AFFIRM, t):
        return True
    if re.search(r"(prob(ar|arlo|émoslo)|mu[eé]stra|ens[eé]ña|ver|try|test|show|see).{0,20}(agente|agent|whats?app|telegram|bot|demo)", t):
        return True
    if re.fullmatch(_AFFIRM + r"[.!\s]*", t):
        last_bot = ""
        for turn in reversed(history or []):
            if turn.get("role") == "assistant":
                last_bot = (turn.get("content") or "").lower()
                break
        if ("whatsapp" in last_bot or "telegram" in last_bot or "demo" in last_bot) and (
            "prob" in last_bot or "agente" in last_bot or "agent" in last_bot
            or "demo" in last_bot or "try" in last_bot
        ):
            return True
    return False


def wants_demo_handoff(user_text: str, history: list, channel: str) -> bool:
    """El handoff solo tiene sentido en web (en Telegram/WhatsApp ya están dentro)."""
    return channel == "web" and _wants_demo(user_text, history)


def _contact_note(lang: str) -> str:
    """Nota de contacto DIRECTO (WhatsApp personal), solo si está configurado."""
    contact = get_settings().contact_whatsapp
    if not contact:
        return ""
    if lang == "en":
        return (f"\n\nDIRECT CONTACT (not the demo): when someone shows real interest in contacting "
                f"or hiring Adrian, ALWAYS share his personal WhatsApp ({contact}) TOGETHER WITH his "
                "email and LinkedIn — not just one of them. This WhatsApp is his personal contact, "
                "NOT the demo number.")
    return (f"\n\nCONTACTO DIRECTO (no la demo): cuando alguien muestre interés real de contactar o "
            f"contratar a Adrian, comparte SIEMPRE su WhatsApp personal ({contact}) JUNTO CON su email "
            "y LinkedIn — no solo uno. Este WhatsApp es su contacto personal, NO el de la demo.")


def build_agent_messages(user_text: str, history: list, lang: str, channel: str) -> list:
    """Construye la lista de mensajes (system + historial + turno actual)."""
    mode = "demo" if channel in ("telegram", "whatsapp") else "web"
    system_text = build_system_prompt(lang, load_cv_context(), mode) + _contact_note(lang)
    messages: list = [SystemMessage(content=system_text)]
    for turn in (history or [])[-_HISTORY_TURNS:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=user_text))
    return messages


def demo_handoff_payload(lang: str) -> dict:
    """Mensaje + enlaces del handoff (web). Devuelve {"reply", "handoff"}."""
    s = get_settings()
    tg_url = f"https://t.me/{s.telegram_bot_username}?start=web" if s.telegram_bot_username else ""
    wa_text = "Hola, quiero probar el agente demo de Adrian" if lang == "es" \
        else "Hi, I'd like to try Adrian's demo agent"
    wa_url = f"https://wa.me/{s.whatsapp_number}?text={quote(wa_text)}" if s.whatsapp_number else ""

    if lang == "en":
        reply = (
            "Awesome! 🚀 Adrian also builds WhatsApp & Telegram agents — you can try one right now. "
            "Tap a button below and the demo agent will greet you instantly and chat about his CV "
            "(and what project you two could build).\n\n"
            "Prefer it to message your own WhatsApp number instead? Just send me your number."
        )
    else:
        reply = (
            "¡Genial! 🚀 Adrian también construye agentes de WhatsApp y Telegram — puedes probar uno ahora. "
            "Toca un botón de abajo y el agente demo te saluda al instante y charla sobre su CV "
            "(y qué proyecto podríais montar).\n\n"
            "¿Prefieres que te escriba a tu propio número de WhatsApp? Dime tu número y listo."
        )

    handoff_data = None
    if tg_url or wa_url:
        handoff_data = {"telegram_url": tg_url, "whatsapp_url": wa_url}
    else:
        note = ("\n\n_(El agente demo se está terminando de montar — en breve verás aquí el botón.)_"
                if lang == "es" else
                "\n\n_(The demo agent is being finished — the button will appear here shortly.)_")
        reply += note
    return {"reply": reply, "handoff": handoff_data}


# ── Nodos ──────────────────────────────────────────────────────────────
def classify(state: ChatState) -> dict:
    channel = state.get("channel", "web")
    wants = wants_demo_handoff(state.get("user_text", ""), state.get("history", []), channel)
    return {"intent": "handoff" if wants else "chat"}


def respond(state: ChatState) -> dict:
    messages = build_agent_messages(
        state.get("user_text", ""), state.get("history", []),
        state.get("lang", "es"), state.get("channel", "web"),
    )
    resp = get_llm().invoke(messages)
    text = resp.content if isinstance(resp.content, str) else str(resp.content)
    return {"reply": text, "handoff": None}


def handoff(state: ChatState) -> dict:
    return demo_handoff_payload(state.get("lang", "es"))


def _route(state: ChatState) -> str:
    return state.get("intent", "chat")


# ── Compilación (perezosa, cacheada) ───────────────────────────────────
_graph = None


def _build_graph():
    g = StateGraph(ChatState)
    g.add_node("classify", classify)
    g.add_node("respond", respond)
    g.add_node("handoff", handoff)
    g.add_edge(START, "classify")
    g.add_conditional_edges("classify", _route, {"chat": "respond", "handoff": "handoff"})
    g.add_edge("respond", END)
    g.add_edge("handoff", END)
    return g.compile()


def get_graph():
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph
