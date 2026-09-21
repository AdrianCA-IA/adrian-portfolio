"""Configuración del backend, leída de variables de entorno (.env)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Ruta absoluta a backend/.env → independiente del directorio de trabajo desde
# el que se arranque uvicorn (backend/app/core/config.py → parents[2] = backend/).
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH), env_file_encoding="utf-8", extra="ignore"
    )

    # ── LLM ────────────────────────────────────────────────────────────
    # Proveedor intercambiable: "anthropic" (por defecto) o "openai".
    llm_provider: str = "anthropic"
    # Modelo por defecto. Ver backend/.env.example para la tabla de coste/calidad.
    llm_model: str = "claude-opus-5"
    llm_max_tokens: int = 1200
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # ── Servidor ───────────────────────────────────────────────────────
    # Orígenes permitidos por CORS (coma-separados). Incluye puertos de dev
    # (5500 = frontend estático, 8000 = alternativo) y el dominio de producción.
    allowed_origins: str = (
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:8000,http://127.0.0.1:8000,"
        "https://adrian-cajas-portfolio.web.app"
    )
    default_lang: str = "es"

    # ── Guardarraíles de coste / abuso ─────────────────────────────────
    max_input_chars: int = 1500      # recorta entradas largas
    rate_limit_per_min: int = 8      # mensajes por IP y minuto
    rate_limit_per_day: int = 100    # mensajes por IP y día

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
