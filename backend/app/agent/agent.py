"""Agente conversacional — Fase 1.

Implementación simple (prompt de sistema con grounding + LLM) estructurada para
migrar a un grafo LangGraph en la Fase 2 sin cambiar la interfaz `run_agent`.
"""
from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from ..core.llm import build_llm
from ..data import load_cv_context
from .prompts import build_system_prompt

_llm: BaseChatModel | None = None
# Nº de turnos previos que se envían como memoria de conversación.
_HISTORY_TURNS = 6


def _get_llm() -> BaseChatModel:
    global _llm
    if _llm is None:
        _llm = build_llm()
    return _llm


def run_agent(message: str, history: list[dict], lang: str = "es") -> str:
    """Genera la respuesta del asistente.

    Args:
        message: mensaje del usuario (ya recortado/validado).
        history: turnos previos [{"role": "user"|"assistant", "content": str}, ...].
        lang: "es" o "en".
    """
    llm = _get_llm()
    system = build_system_prompt(lang, load_cv_context())

    messages: list = [SystemMessage(content=system)]
    for turn in history[-_HISTORY_TURNS:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=message))

    response = llm.invoke(messages)
    return response.content if isinstance(response.content, str) else str(response.content)
