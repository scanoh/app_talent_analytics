import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSystemInstruction, USER_PROMPT } from "../../../lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("files");
    const alias = formData.get("alias") || "";

    if (!files || files.length < 2) {
      return Response.json(
        { error: "Debes subir los 2 archivos PDF de la persona." },
        { status: 400 }
      );
    }

    // Convertir los PDF a base64 para enviarlos a Gemini
    const parts = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      parts.push({
        inlineData: {
          mimeType: file.type || "application/pdf",
          data: base64,
        },
      });
    }
    parts.push({ text: USER_PROMPT });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemInstruction(alias),
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    // Llamada a Gemini con reintento automático si choca con el límite
    // de solicitudes por minuto (error 429). Reintenta hasta 2 veces.
    async function callWithRetry(maxRetries = 2) {
      let attempt = 0;
      while (true) {
        try {
          return await model.generateContent(parts);
        } catch (e) {
          const msg = String(e?.message || "");
          const is429 = msg.includes("429") || msg.includes("Too Many Requests");
          if (!is429 || attempt >= maxRetries) throw e;
          // Intentar leer el retryDelay sugerido por Google; si no, usar 20s
          const match = msg.match(/retry in (\d+(\.\d+)?)s/i);
          const waitSec = match ? Math.ceil(parseFloat(match[1])) + 1 : 20;
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          attempt++;
        }
      }
    }

    const result = await callWithRetry();
    const raw = result.response.text();

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (e) {
      // Reintento: limpiar posibles cercas de código
      const cleaned = raw.replace(/```json|```/g, "").trim();
      analysis = JSON.parse(cleaned);
    }

    return Response.json({ analysis });
  } catch (err) {
    console.error("Error en análisis:", err);
    const m = String(err?.message || "");
    let friendly = "No se pudo completar el análisis: " + (m || "error desconocido");
    if (m.includes("429") || m.includes("Too Many Requests")) {
      friendly =
        "Límite de uso de la API alcanzado. Si analizaste varios candidatos seguidos, espera un minuto y reintenta. Si el error persiste, revisa la cuota de tu API key en Google AI Studio.";
    } else if (m.includes("API key") || m.includes("API_KEY") || m.includes("PERMISSION")) {
      friendly =
        "Problema con la API key. Verifica que GEMINI_API_KEY esté bien configurada en Vercel y que sea válida en Google AI Studio.";
    }
    return Response.json({ error: friendly }, { status: 500 });
  }
}
