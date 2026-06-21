import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://miracle.health"),
  title: {
    default: "Miracle · Inteligencia clínica-operativa para hospitales",
    template: "%s · Miracle",
  },
  description:
    "Miracle convierte cada consulta en una historia clínica estructurada, codificada y auditable, sobre los sistemas que su institución ya usa. Con revisión médica y control humano.",
  applicationName: "Miracle",
  authors: [{ name: "Miracle" }],
  keywords: [
    "inteligencia clínica",
    "documentación médica",
    "CIE-10",
    "CUPS",
    "RIPS",
    "ambient scribe",
    "hospitales Colombia",
    "auditoría clínica",
  ],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Miracle · Inteligencia clínica-operativa para hospitales",
    description:
      "Convierta cada consulta en una historia clínica estructurada, codificada y auditable. Con revisión médica y sin cambiar el sistema que ya usa.",
    type: "website",
    siteName: "Miracle",
    locale: "es_CO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miracle · Inteligencia clínica-operativa para hospitales",
    description:
      "Convierta cada consulta en una historia clínica estructurada, codificada y auditable.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
