import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const display = Schibsted_Grotesk({
  variable: "--ff-display",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--ff-mono",
  subsets: ["latin"],
  display: "swap",
});

const sans = Inter({
  variable: "--ff-sans",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#08111f" },
  ],
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
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=null;try{s=localStorage.getItem('miracle-theme')}catch(e){}var d=s==='dark'||(s!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light'})()`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
