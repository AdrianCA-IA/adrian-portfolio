"""API FastAPI del asistente de IA del portfolio.

Endpoints:
  GET  /health  → estado + proveedor/modelo configurados.
  POST /chat    → conversación con el agente (JSON).
"""
from __future__ import annotations

import json
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .agent.agent import run_agent
from .agent.graph import build_agent_messages, demo_handoff_payload, get_llm, wants_demo_handoff
from .channels.telegram_webhook import router as telegram_router
from .channels.whatsapp import router as whatsapp_router
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

# Canales por webhook (para producción en Cloud Run).
app.include_router(whatsapp_router)      # /webhook/whatsapp
app.include_router(telegram_router)      # /webhook/telegram


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


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, request: Request):
    """Igual que /chat pero en streaming (SSE) para el canal web."""
    lang = "en" if req.lang == "en" else "es"
    ok, _ = check_rate_limit(_client_id(request))
    text = req.message.strip()[: settings.max_input_chars]
    history = [t.model_dump() for t in req.history]

    async def gen():
        if not ok:
            msg = (
                "Has enviado demasiados mensajes en poco tiempo. Prueba de nuevo en un momento "
                "o escribe a adriancajasalmachi@gmail.com"
                if lang == "es"
                else "You've sent too many messages in a short time. Try again shortly, or email "
                "adriancajasalmachi@gmail.com"
            )
            yield _sse({"type": "error", "reply": msg})
            return
        try:
            if wants_demo_handoff(text, history, "web"):
                payload = demo_handoff_payload(lang)
                yield _sse({"type": "full", "reply": payload["reply"], "handoff": payload["handoff"]})
                return
            messages = build_agent_messages(text, history, lang, "web")
            async for chunk in get_llm().astream(messages):
                token = chunk.content if isinstance(chunk.content, str) else ""
                if token:
                    yield _sse({"type": "token", "token": token})
            yield _sse({"type": "done"})
        except Exception:
            logger.exception("Error en el streaming del agente")
            msg = (
                "Ups, ha ocurrido un error. Inténtalo de nuevo en unos segundos."
                if lang == "es" else "Oops, something went wrong. Please try again."
            )
            yield _sse({"type": "error", "reply": msg})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
