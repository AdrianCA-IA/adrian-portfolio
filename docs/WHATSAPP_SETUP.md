# WhatsApp Business — Guía de onboarding (Cloud API)

> Objetivo: tener el número (tu nuevo prepago) dado de alta en la **WhatsApp Business
> Platform (Cloud API)** de Meta, para que en la Fase 4 el agente demo también funcione
> por WhatsApp. Marcado: 🧑 = lo haces tú (cuentas/verificación) · 🤝 = lo montamos juntos.

## Antes de empezar
- **Número:** el nuevo prepago — móvil real que reciba SMS/llamada y que **NO esté ya
  registrado en WhatsApp** (ni normal ni Business app). Si lo usaste en WhatsApp, bórralo de ahí primero.
- Necesitas una **cuenta personal de Facebook/Meta** para acceder a las herramientas.
- Montar la Cloud API es **gratis**; el coste es por mensajes (hay capa gratuita de
  conversaciones de servicio). La interfaz de Meta cambia a menudo: si un nombre no
  coincide exactamente, dime en qué paso estás y te guío.

## Pasos
1. 🧑 **Cuenta de Meta Business** — entra en [business.facebook.com](https://business.facebook.com)
   y crea tu negocio/portfolio (nombre, tu info).
2. 🧑 **Meta for Developers** — en [developers.facebook.com](https://developers.facebook.com)
   registra tu cuenta de desarrollador (verifica email/teléfono).
3. 🧑 **Crear App** → tipo **"Business"** → añade el producto **WhatsApp**.
4. 🤝 **API Setup (WhatsApp):** Meta te da un **número de test gratis** + un **token temporal
   (24 h)** + tus IDs (**WABA ID** y **Phone Number ID**). Con esto ya se puede probar el envío
   mientras completas la verificación.
5. 🧑 **Añade tu número real** (el prepago) → "Add phone number" → verifícalo con el **código
   por SMS/llamada**. ⚠️ No debe estar en WhatsApp.
6. 🧑 ⭐ **Verificación de negocio (Business Verification)** — en *Business Settings →
   Security Center*. **EMPIÉZALA YA**: es lo que más tarda (Meta revisa tu identidad/negocio;
   como autónomo puede pedirte algún dato). Sin verificar hay límites de mensajes, pero para
   la demo inicial suele bastar.
7. 🤝 **Token permanente** — creamos un **System User** en *Business Settings* con permisos
   `whatsapp_business_messaging` + `whatsapp_business_management` y generamos un token que **no
   caduca** (el de 24 h es solo para probar).
8. 🤝 **Webhook** — en la Fase 4 conectamos el webhook de WhatsApp a nuestro backend para
   recibir los mensajes (mismo core LangGraph).

## Qué necesito de ti (para el `.env`, cuando los tengas)
- `WHATSAPP_NUMBER` → tu número en formato **E.164 sin '+'** (p. ej. `34XXXXXXXXX`). *(No es secreto.)*
- (Fase 4) **Phone Number ID**, **WABA ID** y el **token permanente** → al `.env`, **no al chat**
  (el token es secreto).

## Atajo para practicar sin esperar a Meta
Si quieres probar el flujo de WhatsApp en minutos mientras Meta verifica, existe el
**sandbox de WhatsApp de Twilio** (mensajes de prueba inmediatos). Luego se migra a la Cloud
API oficial para producción.

## Recordatorio de diseño (ver ARCHITECTURE.md §8)
- El primer mensaje del negocio en frío requiere **plantilla aprobada**. El MVP sin plantilla
  es el enlace **`wa.me/<num>?text=…`** (el visitante envía y se abre la ventana de 24 h).
- El "te escribo a tu número primero" (plantilla) queda como upgrade una vez verificado.
