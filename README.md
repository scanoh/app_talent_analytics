# Análisis de Talento — Genoma & Talent View 3D

App web para analizar con IA los reportes psicométricos **Genoma** y **Talent View 3D** de candidatos en procesos de selección, generando un informe ejecutivo **anónimo** y descargable en **PDF**.

## ¿Qué hace?

Por cada candidato subes 2 PDF (Genoma + Talent View 3D). La app usa un LLM gratuito (Google Gemini) para producir un informe con:

1. Estilo de comunicación y estilo de trabajo
2. Motivación de la persona
3. Competencias más desarrolladas
4. Competencias a fortalecer
5. Conclusión para el líder

El informe **nunca incluye el nombre** ni datos personales. Puedes añadir tantos candidatos como necesites y descargar el PDF de cada uno.

---

## Paso 1 — Conseguir la API key gratuita (Google Gemini)

1. Entra a https://aistudio.google.com/apikey
2. Inicia sesión con una cuenta de Google.
3. Clic en **"Create API key"** y copia la clave.

El free tier de Gemini es suficiente para uso normal de selección (lectura de PDF incluida, sin costo).

## Paso 2 — Subir el proyecto a GitHub

1. Crea un repositorio nuevo en GitHub.
2. Sube todos estos archivos al repositorio.

## Paso 3 — Desplegar en Vercel

1. Entra a https://vercel.com e inicia sesión (puedes usar tu cuenta de GitHub).
2. Clic en **"Add New… → Project"** e importa el repositorio.
3. En **Environment Variables** agrega:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** la clave que copiaste de Google AI Studio
4. Clic en **Deploy**. En ~1 minuto tendrás la URL pública.

## Desarrollo local (opcional)

```bash
npm install
cp .env.example .env.local   # y pon tu GEMINI_API_KEY dentro
npm run dev
```

Abre http://localhost:3000

---

## Notas técnicas

- **Framework:** Next.js 14 (App Router) — 100% compatible con Vercel.
- **LLM:** `gemini-2.0-flash` (free tier). Lee los PDF de forma nativa, sin librerías de extracción que se rompen con tablas/gráficos.
- **PDF:** se genera en el navegador con jsPDF (sin carga al servidor).
- **Privacidad:** los PDF se envían a Gemini solo para el análisis; el prompt instruye explícitamente NO devolver datos identificables.

## Cambiar de LLM

Si más adelante quieres usar Groq u OpenRouter en vez de Gemini, solo hay que cambiar `app/api/analyze/route.js`. El resto de la app no cambia.
