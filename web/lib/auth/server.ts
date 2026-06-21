import "server-only";

import { redirect } from "next/navigation";
import { isAppRole, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export interface AuthenticatedProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: AppRole;
}

export async function getCurrentProfile(): Promise<AuthenticatedProfile | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || !isAppRole(profile.role)) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
  };
}

export async function requireRole(...allowedRoles: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect("/app/dashboard?error=forbidden");
  }

  return profile;
}
