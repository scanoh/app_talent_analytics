// Genera un PDF del informe usando jsPDF (se carga vía CDN en el cliente).
// Este endpoint devuelve un HTML imprimible como fallback robusto y simple,
// pero la generación real del PDF se hace en el cliente para no depender
// de binarios pesados en el serverless de Vercel.

export const runtime = "nodejs";

export async function POST(req) {
  // Este endpoint queda disponible por si se quiere generar server-side
  // en el futuro. Por ahora el PDF se arma en el navegador.
  return Response.json({ ok: true });
}
