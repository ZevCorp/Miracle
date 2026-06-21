import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { MiracleProvider } from "./providers";

export const metadata: Metadata = {
  title: "Plataforma",
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MiracleProvider>
      <AppShell>{children}</AppShell>
    </MiracleProvider>
  );
}
