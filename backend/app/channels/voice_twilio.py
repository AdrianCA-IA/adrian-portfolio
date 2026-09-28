"""Canal Voz — Twilio Voice (Fase 5).

Cualquiera llama al número de Twilio → Twilio manda un webhook aquí. Escuchamos
lo que dice el usuario con reconocimiento de voz (<Gather input="speech">), se lo
pasamos al MISMO agente LangGraph (channel="voice", respuestas cortas y habladas)
y contestamos en voz alta (<Say> con Amazon Polly). Bucle hasta que cuelguen o
lleguemos al límite de la demo (5 min por defecto).

Rutas:
  POST /webhook/voice          → entrada de la llamada: saluda y empieza a escuchar.
  POST /webhook/voice/gather   → cada turno: transcribe → agente → responde → vuelve a escuchar.

Requiere en .env: TWILIO_AUTH_TOKEN (para validar la firma). Voz, idioma y límites
son configurables (VOICE_* / TWILIO_* en config.py).
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import Response
from twilio.request_validator import RequestValidator
from twilio.twiml.voice_response import Gather, VoiceResponse

from ..agent.agent import run_agent
from ..core.config import get_settings
from ..core.ratelimit import check_rate_limit

log = logging.getLogger("voice-demo")
router = APIRouter()

# Estado por llamada (CallSid). En memoria: suficiente para la demo (una instancia).
# El límite de tiempo NO depende de esto: viaja en la URL (?started=) y es robusto.
_calls: dict[str, dict] = {}
_HISTORY_TURNS = 10

# Locuciones fijas (ES). El resto lo genera el agente.
GREET = ("Hola, soy el asistente de voz de Adrián Cajas. Puedes preguntarme por su "
         "experiencia, sus proyectos o su stack. ¿Qué te gustaría saber?")
BYE = ("Se nos acaba el tiempo de la demo. Gracias por llamar. Si quieres seguir, "
       "escríbele por WhatsApp o visita su web. ¡Hasta pronto!")
NOINPUT = "Perdona, no te he oído bien. ¿Puedes repetirlo?"
ERROR = "Uy, ha habido un problema por aquí. ¿Puedes repetir la pregunta?"


def _twiml(vr: VoiceResponse) -> Response:
    return Response(content=str(vr), media_type="application/xml")


def _public_url(request: Request) -> str:
    """Reconstruye la URL pública tal como la llamó Twilio (para validar la firma)."""
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("host", request.url.netloc)
    url = f"{proto}://{host}{request.url.path}"
    if request.url.query:
        url += f"?{request.url.query}"
    return url


def _valid_signature(request: Request, form: dict) -> bool:
    s = get_settings()
    if not s.twilio_validate or not s.twilio_auth_token:
        return True
    sig = request.headers.get("X-Twilio-Signature", "")
    try:
        return RequestValidator(s.twilio_auth_token).validate(_public_url(request), form, sig)
    except Exception:
        log.exception("Fallo validando la firma de Twilio")
        return False


def _gather(started: int) -> Gather:
    """Un <Gather> que escucha voz y postea el resultado al endpoint de turno."""
    s = get_settings()
    return Gather(
        input="speech",
        language=s.voice_language,
        speech_timeout="auto",
        timeout=6,
        action=f"/webhook/voice/gather?started={started}",
        method="POST",
        action_on_empty_result=True,
    )


@router.post("/webhook/voice")
async def incoming_call(request: Request):
    """Entrada de la llamada: saluda y empieza a escuchar."""
    form = dict(await request.form())
    if not _valid_signature(request, form):
        return Response(status_code=403, content="forbidden")

    call_sid = form.get("CallSid", "")
    caller = form.get("From", "anon")

    # Límite de abuso: nº de llamadas por número (no por turno).
    allowed, _ = check_rate_limit(f"voice:{caller}")
    vr = VoiceResponse()
    if not allowed:
        vr.say("Has llamado muchas veces en poco tiempo. Prueba de nuevo más tarde. Gracias.",
               voice=get_settings().voice_tts_voice, language=get_settings().voice_language)
        vr.hangup()
        return _twiml(vr)

    started = int(time.time())
    if call_sid:
        _calls[call_sid] = {"history": [], "turns": 0, "noinput": 0, "started": started}

    s = get_settings()
    g = _gather(started)
    g.say(GREET, voice=s.voice_tts_voice, language=s.voice_language)
    vr.append(g)
    return _twiml(vr)


@router.post("/webhook/voice/gather")
async def handle_turn(request: Request, started: int = 0):
    """Un turno: transcribe lo dicho → agente → responde → vuelve a escuchar."""
    form = dict(await request.form())
    if not _valid_signature(request, form):
        return Response(status_code=403, content="forbidden")

    s = get_settings()
    call_sid = form.get("CallSid", "")
    speech = (form.get("SpeechResult") or "").strip()
    call = _calls.get(call_sid) or {"history": [], "turns": 0, "noinput": 0, "started": started or int(time.time())}

    vr = VoiceResponse()
    elapsed = time.time() - (started or call.get("started", time.time()))

    # ── Corte por tiempo o por nº de turnos ────────────────────────────
    if elapsed >= s.voice_max_seconds or call.get("turns", 0) >= s.voice_max_turns:
        vr.say(BYE, voice=s.voice_tts_voice, language=s.voice_language)
        vr.hangup()
        _calls.pop(call_sid, None)
        return _twiml(vr)

    # ── Sin voz reconocida: reintenta, y tras 2 intentos se despide ─────
    if not speech:
        call["noinput"] = call.get("noinput", 0) + 1
        _calls[call_sid] = call
        if call["noinput"] >= 3:
            vr.say("No consigo oírte bien. Vuelve a llamar cuando quieras. ¡Un saludo!",
                   voice=s.voice_tts_voice, language=s.voice_language)
            vr.hangup()
            _calls.pop(call_sid, None)
            return _twiml(vr)
        g = _gather(int(started or call["started"]))
        g.say(NOINPUT, voice=s.voice_tts_voice, language=s.voice_language)
        vr.append(g)
        return _twiml(vr)

    call["noinput"] = 0

    # ── Turno normal: agente en modo voz ───────────────────────────────
    try:
        result = run_agent(speech, list(call.get("history", [])), lang="es", channel="voice")
        reply = (result.get("reply") or "").strip() or "Perdona, ¿puedes reformular la pregunta?"
    except Exception:
        log.exception("Error del agente en el canal de voz")
        reply = ERROR

    hist = call.get("history", [])
    hist.append({"role": "user", "content": speech})
    hist.append({"role": "assistant", "content": reply})
    call["history"] = hist[-_HISTORY_TURNS:]
    call["turns"] = call.get("turns", 0) + 1
    _calls[call_sid] = call

    g = _gather(int(started or call["started"]))
    g.say(reply, voice=s.voice_tts_voice, language=s.voice_language)
    vr.append(g)
    return _twiml(vr)
