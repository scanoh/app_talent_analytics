import "./globals.css";

export const metadata = {
  title: "Manual de Líderes — Sitti",
  description: "Retratos cálidos y anónimos para liderar mejor a tu equipo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
