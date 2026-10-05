# Cumplimiento legal (España) — qué hay montado y qué revisar

> Orientación técnica, no asesoría jurídica. Cuando haya clientes o facturación, conviene una revisión profesional.

## Normas que aplican

| Norma | Qué exige aquí |
|---|---|
| **RGPD** (UE 2016/679) + **LOPDGDD** (LO 3/2018) | Informar (art. 13), base legal, minimización, plazos, derechos |
| **LSSI-CE** (Ley 34/2002) | Aviso legal con datos del titular (art. 10); consentimiento para cookies no técnicas (art. 22.2) |
| **Reglamento de IA** (UE 2024/1689, art. 50, aplicable desde 2/8/2026) | Avisar de que el usuario habla con una IA |
| **Guía de cookies AEPD** (2023) | Rechazar tan fácil como aceptar, nada activado por defecto, re-preguntar como mucho cada 24 meses |

## Qué está montado (rama `feature/legal-rgpd`)

| Pieza | Dónde |
|---|---|
| Aviso legal / Privacidad / Cookies (ES/EN) | `aviso-legal.html`, `privacidad.html`, `cookies.html` |
| Banner de cookies preparado para crecer | `assets/consent/consent.{js,css}` |
| Enlaces legales en el pie de todas las páginas | `index.html` + páginas de demo |
| Primera capa informativa + casilla en el formulario | `index.html` (`#contactForm`) |
| Aviso de IA y privacidad en el chat web | `assets/chat-widget/widget.js` |
| Aviso de IA y privacidad en Telegram, WhatsApp y voz | `backend/app/core/legal.py` (texto único) |
| Sin conexiones a terceros al cargar la web | Fuentes en `assets/fonts/`, D3 en `assets/vendor/` (antes Google Fonts / cdnjs) |

### Antes de fusionar con `master`

- [ ] Rellenar `[COMPLETAR: NIF]` y `[COMPLETAR: domicilio]` en `aviso-legal.html` y `privacidad.html`.
      Comprobación: `grep -rn "COMPLETAR" *.html` no debe devolver nada.
- [ ] Desplegar el backend (`cloudrun.ps1`) para que los avisos de Telegram, WhatsApp y voz lleguen a producción.

## Cómo funciona el banner (y cómo añadir analítica)

- **Hoy** `OPTIONAL = []`: el banner solo **informa** ("Entendido"), porque no hay nada que consentir.
- **Al añadir analítica:**
  1. Añade la categoría en `OPTIONAL` (nombre, descripción y proveedor, ES/EN). El banner pasa solo a modo
     *Aceptar / Rechazar / Configurar*, con el mismo peso visual y todo desmarcado por defecto.
  2. Carga el script **solo** dentro de `SiteConsent.onGrant('analytics', function () { /* cargar script */ })`.
  3. Añade la fila a `cookies.html` y el tratamiento a `privacidad.html`. Cambiar categorías invalida
     el consentimiento anterior y el banner vuelve a salir.
- Opción sin banner de consentimiento: analítica **sin cookies** que no guarde nada en el navegador
  ni IPs completas (GoatCounter, Umami autoalojado). Aun así, hay que mencionarla en la política de privacidad.

## Cuándo hay que actualizar las políticas (disparadores)

| Si añades… | Tienes que… |
|---|---|
| Analítica | Ver el apartado anterior |
| Memoria del chat entre visitas (`visitor_id` + checkpointer) | Consentimiento opt-in ("Recordar mi conversación"), plazo de borrado y nueva fila en privacidad y cookies |
| Reservas con Google Calendar (nombre + teléfono) | Nueva finalidad en privacidad, verificación del teléfono (OTP) y plazo de conservación |
| Base de datos (Postgres, etc.) | Actualizar plazos, proveedor y el registro de actividades de abajo |
| Newsletter o comunicaciones comerciales | Casilla de consentimiento **separada y desmarcada** (LSSI art. 21) |
| Nuevo proveedor (LLM, CRM…) | Añadirlo a "Proveedores" y comprobar su garantía de transferencia (dataprivacyframework.gov) |
| Leads de n8n en producción | Ya cubierto ("Avisos de interés", 12 meses). **Borrar las filas de Sheets con más de 12 meses.** |

## Registro de actividades de tratamiento (RAT, uso interno)

Responsable: Adrian Cajas Almachi · adriancajasalmachi@gmail.com · Sin DPO (no obligatorio).

| Actividad | Interesados | Datos | Base | Encargados | Transferencias | Conservación |
|---|---|---|---|---|---|---|
| Formulario de contacto | Visitantes, recruiters | Nombre, email, mensaje | 6.1.b | Formspree | EE. UU. (DPF o CCT) | ≤ 12 meses |
| Chat web | Visitantes | Mensajes, idioma | 6.1.b | Google Cloud (Madrid), OpenAI | EE. UU. (OpenAI) | No se guarda en el servidor |
| Telegram / WhatsApp | Usuarios del canal | ID o número, usuario, mensajes | 6.1.b, 6.1.f | Google Cloud, OpenAI; Meta y Telegram como responsables independientes | EE. UU. | En memoria; se borra al reiniciar |
| Asistente de voz | Llamantes | Número, audio en tiempo real | 6.1.b | Twilio, OpenAI, Google Cloud | EE. UU. | Sin grabación; registro de llamadas en Twilio |
| Avisos de interés (n8n) | Contactos con interés | Canal, mensaje, email o teléfono | 6.1.b | Google (Sheets), Telegram | EE. UU. | ≤ 12 meses |
| Seguridad / rate limit | Todos | IP, datos técnicos | 6.1.f | Google Cloud / Firebase | — | Memoria 24 h; logs ~30 días |

**Medidas de seguridad:** secretos solo en `.env` (fuera del repo), HTTPS, validación de firmas en los webhooks
(Twilio, Telegram, cabecera secreta en n8n), límites de uso por IP, sin base de datos de conversaciones.

**Ejercicio de derechos:** por email, con respuesta en ≤ 1 mes. Como no hay base de datos, la supresión
consiste en borrar las filas de Sheets, los envíos de Formspree y los chats de Telegram o WhatsApp de ese usuario.
