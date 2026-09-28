"""Canal Voz — Twilio Voice (Fase 5), bilingüe ES/EN.

Cualquiera llama al número de Twilio → Twilio manda un webhook aquí. Primero un
breve MENÚ DE IDIOMA (español / English); a partir de ahí toda la llamada sigue
en el idioma elegido: escuchamos con reconocimiento de voz (<Gather input="speech">),
pasamos al MISMO agente LangGraph (channel="voice", respuestas cortas y habladas)
y contestamos en voz alta (<Say> con Amazon Polly). Bucle hasta que cuelguen o
lleguemos al límite de la demo (5 min por defecto).

Rutas:
  POST /webhook/voice          → entrada: menú de idioma (DTMF o voz).
  POST /webhook/voice/lang     → fija idioma, saluda y empieza a escuchar.
  POST /webhook/voice/gather   → cada turno: transcribe → agente → responde → escucha.

Requiere en .env: TWILIO_AUTH_TOKEN (para validar la firma). Voces, idiomas y
límites son configurables (VOICE_* / TWILIO_* en config.py).
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

# Locuciones fijas por idioma. El resto lo genera el agente.
GREET = {
    "es": ("Hola, soy el asistente de voz de Adrián Cajas. Puedes preguntarme por su "
           "experiencia, sus proyectos o su stack. ¿Qué te gustaría saber?"),
    "en": ("Hi, I'm Adrián Cajas' voice assistant. You can ask me about his experience, "
           "his projects or his tech stack. What would you like to know?"),
}
BYE = {
    "es": ("Se nos acaba el tiempo de la demo. Gracias por llamar. Si quieres seguir, "
           "escríbele por WhatsApp o visita su web. ¡Hasta pronto!"),
    "en": ("We're running out of demo time. Thanks for calling. If you'd like to continue, "
           "message him on WhatsApp or visit his website. Talk soon!"),
}
NOINPUT = {
    "es": "Perdona, no te he oído bien. ¿Puedes repetirlo?",
    "en": "Sorry, I didn't catch that. Could you say it again?",
}
NOINPUT_BYE = {
    "es": "No consigo oírte bien. Vuelve a llamar cuando quieras. ¡Un saludo!",
    "en": "I can't hear you well. Call again anytime. Take care!",
}
ERROR = {
    "es": "Uy, ha habido un problema por aquí. ¿Puedes repetir la pregunta?",
    "en": "Oops, something went wrong on my end. Could you repeat the question?",
}
FALLBACK = {
    "es": "Perdona, ¿puedes reformular la pregunta?",
    "en": "Sorry, could you rephrase the question?",
}


def _twiml(vr: VoiceResponse) -> Response:
    return Response(content=str(vr), media_type="application/xml")


def _tts(lang: str) -> str:
    s = get_settings()
    return s.voice_tts_voice_en if lang == "en" else s.voice_tts_voice


def _asr(lang: str) -> str:
    s = get_settings()
    return s.voice_language_en if lang == "en" else s.voice_language


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


def _gather(started: int, lang: str) -> Gather:
    """Un <Gather> que escucha voz y postea el resultado al endpoint de turno."""
    return Gather(
        input="speech",
        language=_asr(lang),
        speech_timeout="auto",
        timeout=6,
        action=f"/webhook/voice/gather?started={started}&lang={lang}",
        method="POST",
        action_on_empty_result=True,
    )


@router.post("/webhook/voice")
async def incoming_call(request: Request):
    """Entrada de la llamada: menú de idioma (DTMF o voz)."""
    form = dict(await request.form())
    if not _valid_signature(request, form):
        return Response(status_code=403, content="forbidden")

    s = get_settings()
    call_sid = form.get("CallSid", "")
    caller = form.get("From", "anon")

    # Límite de abuso: nº de llamadas por número (no por turno).
    allowed, _ = check_rate_limit(f"voice:{caller}")
    vr = VoiceResponse()
    if not allowed:
        vr.say("Has llamado muchas veces en poco tiempo. Prueba de nuevo más tarde. Gracias.",
               voice=_tts("es"), language=_asr("es"))
        vr.say("You've called many times recently. Please try again later. Thank you.",
               voice=_tts("en"), language=_asr("en"))
        vr.hangup()
        return _twiml(vr)

    started = int(time.time())
    if call_sid:
        _calls[call_sid] = {"history": [], "turns": 0, "noinput": 0, "started": started}

    g = Gather(
        input="dtmf speech",
        num_digits=1,
        speech_timeout="auto",
        timeout=6,
        action=f"/webhook/voice/lang?started={started}",
        method="POST",
        action_on_empty_result=True,
    )
    g.say("Para español, pulse uno o diga español.", voice=_tts("es"), language=_asr("es"))
    g.say("For English, press two, or say English.", voice=_tts("en"), language=_asr("en"))
    vr.append(g)
    return _twiml(vr)


@router.post("/webhook/voice/lang")
async def choose_language(request: Request, started: int = 0):
    """Fija el idioma según DTMF/voz, saluda y empieza la conversación."""
    form = dict(await request.form())
    if not _valid_signature(request, form):
        return Response(status_code=403, content="forbidden")

    digits = (form.get("Digits") or "").strip()
    speech = (form.get("SpeechResult") or "").lower()
    if digits == "2" or "english" in speech or "ingl" in speech:
        lang = "en"
    else:  # 1, "español"/"spanish", o sin respuesta → español por defecto
        lang = "es"

    started = started or int(time.time())
    vr = VoiceResponse()
    g = _gather(started, lang)
    g.say(GREET[lang], voice=_tts(lang), language=_asr(lang))
    vr.append(g)
    return _twiml(vr)


@router.post("/webhook/voice/gather")
async def handle_turn(request: Request, started: int = 0, lang: str = "es"):
    """Un turno: transcribe lo dicho → agente → responde → vuelve a escuchar."""
    form = dict(await request.form())
    if not _valid_signature(request, form):
        return Response(status_code=403, content="forbidden")

    lang = "en" if lang == "en" else "es"
    s = get_settings()
    call_sid = form.get("CallSid", "")
    speech = (form.get("SpeechResult") or "").strip()
    call = _calls.get(call_sid) or {"history": [], "turns": 0, "noinput": 0, "started": started or int(time.time())}

    vr = VoiceResponse()
    elapsed = time.time() - (started or call.get("started", time.time()))

    # ── Corte por tiempo o por nº de turnos ────────────────────────────
    if elapsed >= s.voice_max_seconds or call.get("turns", 0) >= s.voice_max_turns:
        vr.say(BYE[lang], voice=_tts(lang), language=_asr(lang))
        vr.hangup()
        _calls.pop(call_sid, None)
        return _twiml(vr)

    # ── Sin voz reconocida: reintenta, y tras 2 intentos se despide ─────
    if not speech:
        call["noinput"] = call.get("noinput", 0) + 1
        _calls[call_sid] = call
        if call["noinput"] >= 3:
            vr.say(NOINPUT_BYE[lang], voice=_tts(lang), language=_asr(lang))
            vr.hangup()
            _calls.pop(call_sid, None)
            return _twiml(vr)
        g = _gather(int(started or call["started"]), lang)
        g.say(NOINPUT[lang], voice=_tts(lang), language=_asr(lang))
        vr.append(g)
        return _twiml(vr)

    call["noinput"] = 0

    # ── Turno normal: agente en modo voz ───────────────────────────────
    try:
        result = run_agent(speech, list(call.get("history", [])), lang=lang, channel="voice")
        reply = (result.get("reply") or "").strip() or FALLBACK[lang]
    except Exception:
        log.exception("Error del agente en el canal de voz")
        reply = ERROR[lang]

    hist = call.get("history", [])
    hist.append({"role": "user", "content": speech})
    hist.append({"role": "assistant", "content": reply})
    call["history"] = hist[-_HISTORY_TURNS:]
    call["turns"] = call.get("turns", 0) + 1
    _calls[call_sid] = call

    g = _gather(int(started or call["started"]), lang)
    g.say(reply, voice=_tts(lang), language=_asr(lang))
    vr.append(g)
    return _twiml(vr)
