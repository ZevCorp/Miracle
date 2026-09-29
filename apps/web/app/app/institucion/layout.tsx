import { requireRole } from "@/lib/auth/server";

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return children;
}
