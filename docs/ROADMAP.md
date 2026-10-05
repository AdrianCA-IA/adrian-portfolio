# Hoja de ruta — portfolio + agentes

> Documento vivo: qué está hecho, qué está en curso y qué viene. Cada bloque de trabajo va en su propia rama.

## Estado actual (5/10/2026)

| Rama / PR | Qué | Estado |
|---|---|---|
| `feature/legal-rgpd` → [PR #1](https://github.com/AdrianCA-IA/adrian-portfolio/pull/1) | Aviso legal, privacidad, cookies, banner, avisos de IA, fuentes propias | Listo para fusionar. Después: redesplegar el backend |
| `feature/chat-markdown` | El chat web muestra listas, negritas y código en las respuestas | Listo para PR |
| `feature/n8n-leads` | El agente emite eventos `lead` → n8n → Google Sheets + Telegram | Código listo; falta configurar n8n (ver abajo) |

Ya en producción: web en Firebase y agente LangGraph en Cloud Run con 4 canales (web, Telegram, WhatsApp, voz).

## Semana 1 — Automatizaciones con n8n (en curso)

Guía paso a paso: [`automations/README.md`](../automations/README.md).

- [x] Backend: `detect_lead` + `emit_event` (`backend/app/core/events.py`), sin bloquear el chat
- [x] Flujo importable: `automations/n8n/lead-to-sheets-telegram.json`
- [ ] Arrancar n8n en local (`npx n8n`) y configurar las credenciales: webhook, Google Sheets, Telegram
- [ ] Prueba completa: mensaje con email en el chat → fila en Sheets + aviso en Telegram
- [ ] Llevar n8n a un servidor siempre encendido (p. ej. VM e2-micro gratuita de GCP) para que Cloud Run llegue a él
- [ ] Borrado automático de las filas de leads con más de 12 meses (lo exige la política de privacidad)

## Semana 2 — Memoria del chat entre visitas (nivel 2)

Concepto LangGraph: **checkpointer**.

- `visitor_id` aleatorio en `localStorage` → `thread_id = "web:{visitor_id}"`; en WhatsApp `"wa:{número}"`
- `PostgresSaver` sobre un Postgres gratuito (Neon / Supabase). SQLite no sirve en Cloud Run (disco efímero)
- El historial deja de enviarse desde el navegador: lo guarda LangGraph
- Esto también arregla que el historial de WhatsApp y Telegram se pierda al reiniciar
- **Legal:** consentimiento opt-in ("Recordar mi conversación"), plazo de borrado y actualizar privacidad + cookies.
  Ver [`docs/legal/README.md`](legal/README.md)

## Más adelante — Reservas con Google Calendar (nivel 3)

Conceptos LangGraph: **Store** (memoria a largo plazo por `user_id`) + **`interrupt`** (confirmar antes de reservar).

- Identificación con nombre + teléfono, **verificado con un código por WhatsApp** antes de mostrar datos anteriores
- Unificar la identidad entre canales (el mismo teléfono en la web y en WhatsApp)
- **Legal:** nueva finalidad en la política de privacidad y plazos de conservación

## Más adelante — Analítica de visitas

- Preferencia: analítica **sin cookies** (GoatCounter / Umami autoalojado): no necesita consentimiento
- Si se usa Google Analytics: añadir la categoría en `assets/consent/consent.js` → el banner pasa solo a Aceptar/Rechazar

## Ideas aparcadas (micro apps / negocio)

| Idea | Base existente | Nota |
|---|---|---|
| Bot de WhatsApp para pymes | Agente multicanal actual | Opción de negocio más fuerte. **Requiere alta como autónomo → NIF + domicilio en el aviso legal** |
| Demo para la frutería (pedidos por WhatsApp + RAG del catálogo) | `C:\Users\Jason\Fruteria` | Caso de éxito para vender lo anterior |
| CV adaptado a cada oferta | `C:\Users\Jason\cv-generator` | Escaparate de LangGraph multiagente + human-in-the-loop |
| Predicción solar para instaladores | `prediccion-solar-proyecto`, `ProyectoElectricidad` | Nicho B2B |
| Sección "Lab / Cómo se hizo" en la web | Guías de `automations/` y `docs/` | Enfoque de enseñanza: diagrama + 5 pasos + demo |

## Convenciones

- Una rama por tema (`feature/…`) → PR → fusionar en `master` (`master` despliega la web automáticamente).
- Backend: tras fusionar, `C:\Users\Jason\gc\cloudrun.ps1`.
- Cualquier dato personal nuevo → revisar antes [`docs/legal/README.md`](legal/README.md).
