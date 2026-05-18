import "./globals.css";

export const metadata = {
  title: "Análisis de Talento — Genoma & Talent View 3D",
  description: "Informes ejecutivos anónimos para procesos de selección",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
