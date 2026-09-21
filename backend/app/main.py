"""API FastAPI del asistente de IA del portfolio.

Endpoints:
  GET  /health  → estado + proveedor/modelo configurados.
  POST /chat    → conversación con el agente (JSON).
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .agent.agent import run_agent
from .core.config import get_settings
from .core.ratelimit import check_rate_limit

logger = logging.getLogger("portfolio-assistant")
settings = get_settings()

app = FastAPI(title="Adrian Cajas — Portfolio AI Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list)
    lang: str = settings.default_lang


class ChatResponse(BaseModel):
    reply: str
    handoff: dict | None = None


def _client_id(request: Request) -> str:
    """IP del cliente. Cloud Run la pasa en X-Forwarded-For."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/")
def root() -> dict:
    return {
        "service": "adrian-portfolio-ai-assistant",
        "health": "/health",
        "chat": "POST /chat",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "provider": settings.llm_provider,
        "model": settings.llm_model,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    lang = "en" if req.lang == "en" else "es"

    ok, reason = check_rate_limit(_client_id(request))
    if not ok:
        msg = (
            "Has enviado demasiados mensajes en poco tiempo. Prueba de nuevo en un momento "
            "o escribe directamente a Adrian: adriancajasalmachi@gmail.com"
            if lang == "es"
            else "You've sent too many messages in a short time. Try again shortly, or email "
            "Adrian directly: adriancajasalmachi@gmail.com"
        )
        return JSONResponse(status_code=429, content={"reply": msg})

    text = req.message.strip()[: settings.max_input_chars]
    history = [t.model_dump() for t in req.history]

    try:
        result = run_agent(text, history, lang)
    except Exception:  # no filtramos detalles internos al cliente
        logger.exception("Error generando respuesta del agente")
        msg = (
            "Ups, ha ocurrido un error al procesar tu mensaje. Inténtalo de nuevo en unos "
            "segundos, o escribe a adriancajasalmachi@gmail.com"
            if lang == "es"
            else "Oops, something went wrong processing your message. Please try again, or "
            "email adriancajasalmachi@gmail.com"
        )
        return JSONResponse(status_code=500, content={"reply": msg})

    return ChatResponse(reply=result["reply"], handoff=result.get("handoff"))
