# Automatizaciones — Semana 1: lead del agente → Google Sheets + Telegram

> **Idea en una frase:** LangGraph es el *cerebro* (entiende la conversación);
> n8n es la *fontanería* (guarda, avisa, conecta servicios). El agente solo emite
> un evento; n8n decide qué hacer con él.

```
Visitante ──► Agente LangGraph (web / Telegram / WhatsApp / voz)
                    │  ¿email, teléfono o "queremos contratarte"?
                    ▼
              POST /webhook/lead  (cabecera X-N8N-Secret)
                    ▼
                  n8n ──► Google Sheets (CRM)  ──► Telegram (aviso al móvil)
```

## Qué hace el código (backend)

| Pieza | Archivo | Qué enseña |
|---|---|---|
| `detect_lead()` | `backend/app/core/events.py` | Heurística barata (regex) antes de gastar tokens del LLM |
| `emit_event()` | `backend/app/core/events.py` | *Fire-and-forget* en un hilo: n8n caído ≠ chat roto |
| Hook en `run_agent` | `backend/app/agent/agent.py` | Un único punto cubre web, Telegram, WhatsApp y voz |
| Hook en streaming | `backend/app/main.py` (`/chat/stream`) | El streaming no pasa por el grafo → se engancha aparte |
| `N8N_WEBHOOK_URL` vacío | `backend/app/core/config.py` | *Feature flag*: sin URL, todo funciona igual que antes |

Evento que recibe n8n:

```json
{ "event": "lead", "ts": "2026-10-05T13:19:45Z", "channel": "whatsapp",
  "lang": "es", "reason": "email", "message": "Queremos contratarte…", "reply": "…" }
```

## Se monta así (≈30 min)

**1. Arranca n8n en local** (gratis, necesita Node ≥ 20):
```bash
npx n8n
```
Abre http://localhost:5678 y crea tu usuario local (solo vive en tu PC).

**2. Importa el flujo:** *Workflows → Import from file →*
`automations/n8n/lead-to-sheets-telegram.json`

**3. Configura las 3 credenciales en n8n** (los secretos se quedan en n8n, nunca en el repo):
- *Webhook* → Header Auth: nombre `X-N8N-Secret`, valor = un secreto largo.
- *Google Sheets* → OAuth2 con tu cuenta. Crea una hoja con pestaña `Leads` y columnas
  `fecha | canal | motivo | idioma | mensaje | respuesta_agente`; pega su URL en el nodo.
- *Telegram* → el token de tu bot; `chatId` = tu `ADRIAN_TELEGRAM_CHAT_ID`.

**4. Conecta el backend** — en `backend/.env`:
```
N8N_WEBHOOK_URL=http://localhost:5678/webhook-test/lead   # modo prueba (botón "Test workflow")
N8N_WEBHOOK_SECRET=el-mismo-secreto-del-paso-3
```
Cuando funcione, activa el workflow (*Active*) y cambia `webhook-test` → `webhook`.

**5. Prueba:** arranca el backend en local y escribe en el chat
*"Queremos contratarte, mi correo es prueba@empresa.com"* → fila nueva en Sheets + aviso en Telegram.

## Errores típicos

- **404 en n8n** → usas `/webhook/` con el workflow inactivo (o `/webhook-test/` sin pulsar "Test workflow").
- **403** → el secreto del `.env` no coincide con la credencial Header Auth.
- **Producción no llega a n8n** → Cloud Run no ve tu `localhost`. Siguiente paso: n8n en
  un servidor siempre encendido (p. ej. VM e2-micro del free tier de GCP) y cambiar la URL.

## Qué he aprendido (para contarlo)

1. Separar *razonamiento* (LangGraph) de *integraciones* (n8n) → cada cambio de CRM no toca el agente.
2. Eventos asíncronos y tolerantes a fallos.
3. Detección de intención en dos niveles: regex barata ahora, nodo LLM `classify` después.
