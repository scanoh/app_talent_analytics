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
      updateCandidate(id, { error: "Sube los 2 PDF de la persona." });
      return;
    }

    updateCandidate(id, { status: "loading", error: null });

    const fd = new FormData();
    cand.files.forEach((f) => fd.append("files", f));
    fd.append("alias", cand.alias?.trim() || "");

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

    // Paleta Sitti
    const indigo = [46, 42, 117];
    const coral = [232, 85, 62];
    const turq = [60, 191, 180];
    const ink = [38, 38, 54];

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
      doc.setTextColor(...indigo);
      doc.text(txt.toUpperCase(), margin, y);
      y += 9;
      doc.setDrawColor(...turq);
      doc.setLineWidth(2);
      doc.line(margin, y, margin + 70, y);
      y += 20;
    }

    function paragraph(txt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...ink);
      const lines = doc.splitTextToSize(txt || "—", contentW);
      lines.forEach((ln) => {
        newPageIfNeeded(16);
        doc.text(ln, margin, y);
        y += 15.5;
      });
      y += 10;
    }

    function compBlock(name, desc) {
      newPageIfNeeded(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...coral);
      const nameLines = doc.splitTextToSize(name || "", contentW);
      nameLines.forEach((ln) => {
        newPageIfNeeded(16);
        doc.text(ln, margin, y);
        y += 16;
      });
      y += 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...ink);
      const descLines = doc.splitTextToSize(desc || "", contentW);
      descLines.forEach((ln) => {
        newPageIfNeeded(15);
        doc.text(ln, margin, y);
        y += 15;
      });
      y += 14;
    }

    // Portada / encabezado
    doc.setFillColor(...indigo);
    doc.rect(0, 0, pageW, 110, "F");
    // acentos de color Sitti
    doc.setFillColor(...coral);
    doc.rect(0, 110, pageW / 3, 5, "F");
    doc.setFillColor(...turq);
    doc.rect(pageW / 3, 110, pageW / 3, 5, "F");
    doc.setFillColor(245, 166, 35);
    doc.rect((pageW / 3) * 2, 110, pageW / 3, 5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("MANUAL DE LÍDERES", margin, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(60, 191, 180);
    doc.text("Sitti", margin, 74);

    const label = cand.alias?.trim() ? cand.alias.trim() : "Candidato " + cand.id;
    doc.setFontSize(11);
    doc.setTextColor(230, 230, 240);
    doc.text("Retrato de: " + label, margin, 96);

    y = 145;

    const r = cand.result;

    heading("Cómo se comunica y trabaja " + label);
    paragraph(r.estilo_comunicacion_y_trabajo);

    heading("Qué motiva a " + label);
    paragraph(r.motivacion);

    heading("Sus fortalezas más visibles");
    (r.competencias_desarrolladas || []).forEach((c) =>
      compBlock(c.competencia, c.descripcion)
    );

    heading("Dónde puede seguir creciendo");
    (r.competencias_a_fortalecer || []).forEach((c) =>
      compBlock(c.competencia, c.descripcion)
    );

    heading("Para ti, como líder");
    paragraph(r.conclusion_para_el_lider);

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 160);
      doc.text(
        "Manual de Líderes · Sitti · Documento confidencial · " +
          i +
          "/" +
          pageCount,
        margin,
        pageH - 24
      );
    }

    doc.save("manual_lideres_" + label.replace(/\s+/g, "_").toLowerCase() + ".pdf");
  }

  return (
    <main className="min-h-screen">
      <header className="relative overflow-hidden">
        <div className="sitti-hero">
          <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-20">
            <div className="flex items-center gap-3 mb-8">
              <SittiMark />
              <span
                className="font-display text-2xl"
                style={{ color: "var(--indigo)", letterSpacing: "-0.02em" }}
              >
                sitti
              </span>
            </div>
            <p
              className="text-xs tracking-[0.35em] uppercase mb-4"
              style={{ color: "var(--coral)" }}
            >
              Conoce a tu equipo
            </p>
            <h1
              className="font-display text-5xl md:text-7xl leading-[0.95] mb-6"
              style={{ color: "var(--indigo)" }}
            >
              Manual de
              <br />
              <span style={{ color: "var(--turq)" }}>Líderes</span>
            </h1>
            <p
              className="max-w-xl text-base md:text-lg leading-relaxed"
              style={{ color: "var(--ink)", opacity: 0.8 }}
            >
              Sube los dos documentos de evaluación de cada persona y asígnale un
              alias. Recibirás un retrato cálido y humano —sin nombres, sin
              tecnicismos— pensado para ayudarte a liderarle mejor.
            </p>
          </div>
        </div>
        <div className="sitti-bar" />
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {candidates.map((cand, idx) => (
          <section
            key={cand.id}
            className="fade-up mb-8 rounded-2xl border bg-white"
            style={{
              borderColor: "var(--line)",
              animationDelay: `${idx * 0.05}s`,
              boxShadow: "0 1px 3px rgba(46,42,117,0.06)",
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-display text-lg font-semibold"
                  style={{ background: "var(--indigo)", color: "#fff" }}
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
                    style={{ color: "var(--indigo)" }}
                  />
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--ink)", opacity: 0.5 }}
                  >
                    El retrato se escribirá usando este alias · el nombre real
                    nunca aparece
                  </p>
                </div>
              </div>
              {candidates.length > 1 && (
                <button
                  onClick={() => removeCandidate(cand.id)}
                  className="text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: "var(--coral)" }}
                >
                  Quitar
                </button>
              )}
            </div>

            <div className="px-6 py-6">
              <label
                className="block cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:bg-black/[0.015]"
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
                  style={{ color: "var(--turq)" }}
                >
                  {cand.files.length > 0
                    ? `${cand.files.length} archivo(s) seleccionado(s)`
                    : "Subir los 2 PDF"}
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--ink)", opacity: 0.6 }}
                >
                  Los dos documentos de evaluación · clic para seleccionar
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
                  style={{ background: "#fdecea", color: "var(--coral)" }}
                >
                  {cand.error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => analyzeCandidate(cand.id)}
                  disabled={cand.status === "loading"}
                  className="px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 hover:translate-y-[-1px]"
                  style={{ background: "var(--indigo)", color: "#fff" }}
                >
                  {cand.status === "loading"
                    ? "Escribiendo el retrato…"
                    : "Generar manual"}
                </button>
                {cand.status === "done" && (
                  <button
                    onClick={() => downloadPdf(cand)}
                    className="px-6 py-3 rounded-xl font-medium transition-all hover:translate-y-[-1px] border-2"
                    style={{
                      borderColor: "var(--turq)",
                      color: "var(--turq)",
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
                    Conociendo a la persona y escribiendo su retrato…
                  </p>
                </div>
              )}

              {cand.status === "done" && cand.result && (
                <ResultView result={cand.result} alias={cand.alias} id={cand.id} />
              )}
            </div>
          </section>
        ))}

        <button
          onClick={addCandidate}
          className="w-full py-5 rounded-2xl border-2 border-dashed font-display text-lg transition-colors hover:bg-black/[0.015]"
          style={{ borderColor: "var(--line)", color: "var(--indigo)" }}
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
          Manual de Líderes · Sitti — Un apoyo para liderar mejor, no una
          decisión única del proceso.
        </footer>
      </div>
    </main>
  );
}

function SittiMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path
        d="M20 3a17 17 0 0 1 12 5"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M32 8a17 17 0 0 1 5 12"
        stroke="#3CBFB4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M8 32a17 17 0 0 1-5-12"
        stroke="#3CBFB4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 37a17 17 0 0 1-12-5"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="13" y="13" width="14" height="3" rx="1.5" fill="#E8553E" />
      <rect x="18.5" y="13" width="3" height="14" rx="1.5" fill="#E8553E" />
      <circle cx="11" cy="24" r="1.6" fill="#E8553E" />
    </svg>
  );
}

function ResultView({ result, alias }) {
  const name = alias && alias.trim() ? alias.trim() : "esta persona";

  const Section = ({ title, children }) => (
    <div className="mb-9">
      <h3
        className="font-display text-xl mb-1"
        style={{ color: "var(--indigo)" }}
      >
        {title}
      </h3>
      <div
        className="w-14 h-[3px] rounded-full mb-4"
        style={{ background: "var(--turq)" }}
      />
      <div
        style={{ color: "var(--ink)", opacity: 0.9 }}
        className="leading-relaxed space-y-3"
      >
        {children}
      </div>
    </div>
  );

  const paragraphs = (txt) =>
    String(txt || "")
      .split(/\n{2,}|\n/)
      .filter((p) => p.trim())
      .map((p, i) => <p key={i}>{p.trim()}</p>);

  return (
    <div
      className="fade-up mt-8 rounded-xl p-6 md:p-9"
      style={{ background: "#f7f6fb" }}
    >
      <Section title={`Cómo se comunica y trabaja ${name}`}>
        {paragraphs(result.estilo_comunicacion_y_trabajo)}
      </Section>

      <Section title={`Qué motiva a ${name}`}>
        {paragraphs(result.motivacion)}
      </Section>

      <Section title="Sus fortalezas más visibles">
        <div className="space-y-5">
          {(result.competencias_desarrolladas || []).map((c, i) => (
            <div key={i}>
              <p
                className="font-display text-lg mb-1"
                style={{ color: "var(--coral)" }}
              >
                {c.competencia}
              </p>
              <p>{c.descripcion}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Dónde puede seguir creciendo">
        <div className="space-y-5">
          {(result.competencias_a_fortalecer || []).map((c, i) => (
            <div key={i}>
              <p
                className="font-display text-lg mb-1"
                style={{ color: "var(--coral)" }}
              >
                {c.competencia}
              </p>
              <p>{c.descripcion}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Para ti, como líder">
        {paragraphs(result.conclusion_para_el_lider)}
      </Section>
    </div>
  );
}
