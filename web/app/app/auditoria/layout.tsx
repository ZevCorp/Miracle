import { requireRole } from "@/lib/auth/server";

export default async function AuditoriaLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "supervisor");
  return children;
}
