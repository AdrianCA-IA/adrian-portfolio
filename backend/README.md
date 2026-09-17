# Backend — Asistente de IA del portfolio

Servicio del chatbot agéntico (LangChain → LangGraph) que responde sobre el CV de
Adrian. Es el "cerebro" único que en fases siguientes se reutiliza en web, Telegram
y WhatsApp. Ver el diseño completo en [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Estructura
```
backend/
├── app/
│   ├── main.py            # FastAPI: /health y /chat
│   ├── core/              # config, LLM (intercambiable), rate limit
│   ├── agent/             # agente + prompts (Fase 2: grafo LangGraph)
│   └── data/              # cv_context.md (grounding) + loader
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Puesta en marcha (local, Windows PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env      # y edita .env con tu API key
uvicorn app.main:app --reload --port 8000
```

Comprobar:
```bash
curl http://localhost:8000/health
```
```bash
curl -X POST http://localhost:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"¿En qué está especializado Adrian?\",\"lang\":\"es\"}"
```

## Configuración
Todas las variables están documentadas en [`.env.example`](.env.example):
proveedor y modelo de LLM (con tabla de coste), claves, CORS y guardarraíles
(límite de caracteres y rate limit por IP).

- **Modelo por defecto:** `claude-opus-5` (máxima calidad). Para un bot público
  se puede bajar a `claude-sonnet-5` o `claude-haiku-4-5` cambiando `LLM_MODEL`.
- **Proveedor:** `anthropic` por defecto; `openai` disponible cambiando `LLM_PROVIDER`
  y `LLM_MODEL`.

## Seguridad
- Las claves viven solo en `.env` (local) o en el gestor de secretos de la nube.
  Nunca en el repo ni en el frontend.
- CORS restringido a los dominios de `ALLOWED_ORIGINS`.
- Rate limit por IP + recorte de entrada como guardarraíles de coste/abuso.

## Despliegue (resumen)
Contenedor a **GCP Cloud Run** (escala a cero). El frontend sigue en Firebase
Hosting; este backend se despliega aparte. Detalle en el doc de arquitectura.
