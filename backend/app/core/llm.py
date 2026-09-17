"""Fábrica del modelo de lenguaje (LLM), intercambiable por proveedor.

El modelo se elige por variables de entorno, así la nube y el proveedor son
un detalle de configuración y no algo incrustado en el código.
"""
from __future__ import annotations

import os

from langchain_core.language_models.chat_models import BaseChatModel

from .config import get_settings


def build_llm() -> BaseChatModel:
    """Construye el chat model según LLM_PROVIDER / LLM_MODEL."""
    s = get_settings()
    provider = s.llm_provider.lower().strip()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        if s.anthropic_api_key:
            os.environ.setdefault("ANTHROPIC_API_KEY", s.anthropic_api_key)
        # OJO: los modelos Claude 5 (opus-5 / sonnet-5) rechazan 'temperature'
        # con un 400. Por eso NO la pasamos aquí y dejamos el valor del servidor.
        return ChatAnthropic(
            model=s.llm_model,
            max_tokens=s.llm_max_tokens,
            timeout=30,
        )

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        if s.openai_api_key:
            os.environ.setdefault("OPENAI_API_KEY", s.openai_api_key)
        return ChatOpenAI(
            model=s.llm_model,
            max_tokens=s.llm_max_tokens,
            temperature=0.3,
            timeout=30,
        )

    raise ValueError(
        f"LLM_PROVIDER no soportado: {s.llm_provider!r} (usa 'anthropic' u 'openai')"
    )
