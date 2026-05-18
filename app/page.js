"use client";

import { useState } from "react";

export default function Home() {
  const [candidates, setCandidates] = useState([
    { id: 1, alias: "", files: [], status: "idle", result: null, error: null },
  ]);

  function ensurePdfLib() {
    return new Promise((resolve) => {
      if (window.jspdf) return resolve();
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = () => resolve();
      document.body.appendChild(s);
    });
  }

  function addCandidate() {
    setCandidates((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        alias: "",
        files: [],
        status: "idle",
        result: null,
        error: null,
      },
    ]);
  }

  function removeCandidate(id) {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCandidate(id, patch) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  function handleFiles(id, fileList) {
    const arr = Array.from(fileList).slice(0, 2);
    updateCandidate(id, { files: arr, error: null });
  }

  async function analyzeCandidate(id) {
    const cand = candidates.find((c) => c.id === id);
    if (!cand) return;
    if (cand.files.length < 2) {
      updateCandidate(id, {
        error: "Sube los 2 PDF (Genoma y Talent View 3D).",
      });
      return;
    }

    updateCandidate(id, { status: "loading", error: null });

    const fd = new FormData();
    cand.files.forEach((f) => fd.append("files", f));

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        updateCandidate(id, {
          status: "error",
          error: data.error || "Error al analizar.",
        });
        return;
      }
      updateCandidate(id, { status: "done", result: data.analysis });
    } catch (e) {
      updateCandidate(id, {
        status: "error",
        error: "Error de conexión: " + e.message,
      });
    }
  }

  async function downloadPdf(cand) {
    await ensurePdfLib();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const contentW = pageW - margin * 2;
    let y = margin;

    const inkA = [26, 43, 37];
    const mossA = [45, 90, 61];
    const clayA = [196, 102, 63];
    const grayA = [110, 110, 110];

    function newPageIfNeeded(extra = 0) {
      if (y + extra > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function heading(txt) {
      newPageIfNeeded(46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...mossA);
      doc.text(txt.toUpperCase(), margin, y);
      y += 8;
      doc.setDrawColor(...mossA);
      doc.setLineWidth(1.2);
      doc.line(margin, y, margin + contentW, y);
      y += 18;
    }

    function paragraph(txt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...inkA);
      const lines = doc.splitTextToSize(txt || "—", contentW);
      lines.forEach((ln) => {
        newPageIfNeeded(16);
        doc.text(ln, margin, y);
        y += 15;
      });
      y += 10;
    }

    function compTitle(name, nivel) {
      newPageIfNeeded(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...clayA);
      doc.text("• " + (name || ""), margin, y);
      if (nivel) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...grayA);
        doc.text("[" + nivel + "]", margin + 250, y);
      }
      y += 16;
    }

    function field(label, value) {
      if (!value) return;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...mossA);
      newPageIfNeeded(15);
      doc.text(label, margin + 14, y);
      y += 13;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...inkA);
      const lines = doc.splitTextToSize(value, contentW - 14);
      lines.forEach((ln) => {
        newPageIfNeeded(14);
        doc.text(ln, margin + 14, y);
        y += 14;
      });
      y += 6;
    }

    // Encabezado del documento
    doc.setFillColor(...mossA);
    doc.rect(0, 0, pageW, 90, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(244, 241, 234);
    doc.text("Informe de Análisis de Talento", margin, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const label = cand.alias?.trim() ? cand.alias.trim() : "Candidato " + cand.id;
    doc.text(label + "  ·  Reporte anónimo · Análisis detallado", margin, 64);
    y = 120;

    const r = cand.result;

    heading("Estilo de comunicación y de trabajo");
    paragraph(r.estilo_comunicacion_y_trabajo);

    heading("Motivación");
    paragraph(r.motivacion);

    heading("Competencias más desarrolladas");
    (r.competencias_desarrolladas || []).forEach((c) => {
      compTitle(c.competencia, c.nivel);
      field("Evidencia en los tests:", c.evidencia);
      field("Cómo se manifiesta en el trabajo:", c.manifestacion_laboral);
      field("Valor para el rol:", c.valor_para_el_rol);
      y += 4;
    });

    heading("Competencias a fortalecer");
    (r.competencias_a_fortalecer || []).forEach((c) => {
      compTitle(c.competencia, c.nivel);
      field("Evidencia en los tests:", c.evidencia);
      field("Riesgo práctico:", c.riesgo_practico);
      field("Recomendación de desarrollo:", c.recomendacion);
      y += 4;
    });

    heading("Conclusión para el líder");
    paragraph(r.conclusion_para_el_lider);

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Generado con IA · Documento confidencial · " + i + "/" + pageCount,
        margin,
        pageH - 24
      );
    }

    doc.save("informe_" + label.replace(/\s+/g, "_").toLowerCase() + ".pdf");
  }

  return (
    <main className="min-h-screen">
      <header
        className="relative overflow-hidden border-b"
        style={{ borderColor: "var(--line)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--moss) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-20">
          <p
            className="text-xs tracking-[0.3em] uppercase mb-5"
            style={{ color: "var(--clay)" }}
          >
            Selección · Psicometría · IA
          </p>
          <h1
            className="font-display text-5xl md:text-7xl leading-[0.95] mb-6"
            style={{ color: "var(--ink)" }}
          >
            Análisis de
            <br />
            <span style={{ color: "var(--moss)" }}>Talento</span>
          </h1>
          <p
            className="max-w-xl text-base md:text-lg leading-relaxed"
            style={{ color: "var(--ink)", opacity: 0.75 }}
          >
            Sube los reportes <strong>Genoma</strong> y{" "}
            <strong>Talent View 3D</strong> de cada persona. La IA genera un
            informe <em>detallado por competencia</em>, anónimo y descargable en
            PDF, listo para el líder del proceso.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {candidates.map((cand, idx) => (
          <section
            key={cand.id}
            className="fade-up mb-8 rounded-2xl border bg-white/50"
            style={{
              borderColor: "var(--line)",
              animationDelay: `${idx * 0.05}s`,
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-display text-lg font-semibold"
                  style={{ background: "var(--moss)", color: "var(--paper)" }}
                >
                  {cand.id}
                </div>
                <div>
                  <input
                    value={cand.alias}
                    onChange={(e) =>
                      updateCandidate(cand.id, { alias: e.target.value })
                    }
                    placeholder={`Alias del candidato ${cand.id}`}
                    className="bg-transparent font-display text-xl outline-none border-b border-transparent focus:border-current transition-colors"
                    style={{ color: "var(--ink)" }}
                  />
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--ink)", opacity: 0.5 }}
                  >
                    Asigna un alias · el nombre real nunca aparece en el informe
                  </p>
                </div>
              </div>
              {candidates.length > 1 && (
                <button
                  onClick={() => removeCandidate(cand.id)}
                  className="text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: "var(--clay)" }}
                >
                  Quitar
                </button>
              )}
            </div>

            <div className="px-6 py-6">
              <label
                className="block cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:bg-black/[0.02]"
                style={{ borderColor: "var(--line)" }}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(cand.id, e.target.files)}
                />
                <div
                  className="font-display text-lg mb-1"
                  style={{ color: "var(--moss)" }}
                >
                  {cand.files.length > 0
                    ? `${cand.files.length} archivo(s) seleccionado(s)`
                    : "Subir los 2 PDF"}
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--ink)", opacity: 0.6 }}
                >
                  Genoma + Talent View 3D · clic para seleccionar
                </p>
                {cand.files.length > 0 && (
                  <ul
                    className="mt-4 space-y-1 text-sm"
                    style={{ color: "var(--ink)" }}
                  >
                    {cand.files.map((f, i) => (
                      <li key={i} className="opacity-70">
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </label>

              {cand.error && (
                <p
                  className="mt-4 text-sm px-4 py-3 rounded-lg"
                  style={{ background: "#fbeae3", color: "var(--clay)" }}
                >
                  {cand.error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => analyzeCandidate(cand.id)}
                  disabled={cand.status === "loading"}
                  className="px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 hover:translate-y-[-1px]"
                  style={{ background: "var(--moss)", color: "var(--paper)" }}
                >
                  {cand.status === "loading"
                    ? "Analizando…"
                    : "Analizar candidato"}
                </button>
                {cand.status === "done" && (
                  <button
                    onClick={() => downloadPdf(cand)}
                    className="px-6 py-3 rounded-xl font-medium transition-all hover:translate-y-[-1px] border"
                    style={{
                      borderColor: "var(--moss)",
                      color: "var(--moss)",
                    }}
                  >
                    ↓ Descargar PDF
                  </button>
                )}
              </div>

              {cand.status === "loading" && (
                <div className="mt-8 flex items-center gap-4">
                  <div className="spinner" />
                  <p style={{ color: "var(--ink)", opacity: 0.6 }}>
                    Leyendo los reportes y construyendo el análisis detallado…
                  </p>
                </div>
              )}

              {cand.status === "done" && cand.result && (
                <ResultView result={cand.result} />
              )}
            </div>
          </section>
        ))}

        <button
          onClick={addCandidate}
          className="w-full py-5 rounded-2xl border-2 border-dashed font-display text-lg transition-colors hover:bg-black/[0.02]"
          style={{ borderColor: "var(--line)", color: "var(--moss)" }}
        >
          + Añadir otro candidato
        </button>

        <footer
          className="mt-16 pt-8 border-t text-center text-sm"
          style={{
            borderColor: "var(--line)",
            color: "var(--ink)",
            opacity: 0.5,
          }}
        >
          Los informes se generan con IA y no exponen datos personales. Úsalos
          como apoyo, no como decisión única del proceso.
        </footer>
      </div>
    </main>
  );
}

function ResultView({ result }) {
  const Section = ({ title, children }) => (
    <div className="mb-8">
      <h3
        className="font-display text-xl mb-3 pb-2 border-b"
        style={{ color: "var(--moss)", borderColor: "var(--line)" }}
      >
        {title}
      </h3>
      <div
        style={{ color: "var(--ink)", opacity: 0.85 }}
        className="leading-relaxed"
      >
        {children}
      </div>
    </div>
  );

  const Field = ({ label, value }) =>
    value ? (
      <p className="mt-2">
        <span
          className="font-semibold"
          style={{ color: "var(--moss)" }}
        >
          {label}{" "}
        </span>
        {value}
      </p>
    ) : null;

  const CompCard = ({ c, kind }) => (
    <div
      className="rounded-xl p-5 border bg-white/60"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span
          className="font-display text-lg"
          style={{ color: "var(--clay)" }}
        >
          {c.competencia}
        </span>
        {c.nivel && (
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: "var(--sand)", color: "var(--ink)" }}
          >
            {c.nivel}
          </span>
        )}
      </div>
      <Field label="Evidencia en los tests:" value={c.evidencia} />
      {kind === "strong" ? (
        <>
          <Field
            label="Cómo se manifiesta en el trabajo:"
            value={c.manifestacion_laboral}
          />
          <Field label="Valor para el rol:" value={c.valor_para_el_rol} />
        </>
      ) : (
        <>
          <Field label="Riesgo práctico:" value={c.riesgo_practico} />
          <Field
            label="Recomendación de desarrollo:"
            value={c.recomendacion}
          />
        </>
      )}
    </div>
  );

  return (
    <div
      className="fade-up mt-8 rounded-xl p-6 md:p-8"
      style={{ background: "var(--sand)" }}
    >
      <Section title="Estilo de comunicación y de trabajo">
        <p>{result.estilo_comunicacion_y_trabajo}</p>
      </Section>

      <Section title="Motivación">
        <p>{result.motivacion}</p>
      </Section>

      <Section title="Competencias más desarrolladas">
        <div className="space-y-4">
          {(result.competencias_desarrolladas || []).map((c, i) => (
            <CompCard key={i} c={c} kind="strong" />
          ))}
        </div>
      </Section>

      <Section title="Competencias a fortalecer">
        <div className="space-y-4">
          {(result.competencias_a_fortalecer || []).map((c, i) => (
            <CompCard key={i} c={c} kind="weak" />
          ))}
        </div>
      </Section>

      <Section title="Conclusión para el líder">
        <p>{result.conclusion_para_el_lider}</p>
      </Section>
    </div>
  );
}
