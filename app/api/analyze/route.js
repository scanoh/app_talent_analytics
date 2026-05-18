import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_INSTRUCTION, USER_PROMPT } from "../../../lib/prompt";

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

    if (!files || files.length < 2) {
      return Response.json(
        { error: "Debes subir los 2 archivos PDF (Genoma y Talent View 3D) de la persona." },
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
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(parts);
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
    return Response.json(
      { error: "No se pudo completar el análisis: " + (err.message || "error desconocido") },
      { status: 500 }
    );
  }
}
