import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath, isAppRole } from "@/lib/auth/roles";

function redirectWithSession(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Keep this immediately after createServerClient: getClaims validates the JWT.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithSession(url, supabaseResponse);
  }

  // Rol desde el JWT (custom access token hook), para no leer profiles en cada
  // request. Fallback a la BD si el token aún no trae el claim (hook sin habilitar
  // o sesión sin refrescar). Los chequeos autoritativos (layout, server actions)
  // siguen leyendo la BD, así que la revocación de rol es inmediata pese al claim.
  let role: unknown = claimsData?.claims?.app_role;
  if (!isAppRole(role)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    role = profile?.role;
  }

  if (!isAppRole(role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "account-not-ready");
    return redirectWithSession(url, supabaseResponse);
  }

  const pathname = request.nextUrl.pathname;

  // El superadmin vive en su propia consola. Si entra a /app o /onboarding, se le
  // manda a /superadmin; dentro de /superadmin/* tiene paso libre.
  if (role === "superadmin") {
    if (!pathname.startsWith("/superadmin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/superadmin";
      url.search = "";
      return redirectWithSession(url, supabaseResponse);
    }
    return supabaseResponse;
  }

  // Cualquier otro rol que intente entrar a la consola de plataforma → dashboard.
  if (pathname.startsWith("/superadmin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.searchParams.set("error", "forbidden");
    return redirectWithSession(url, supabaseResponse);
  }

  if (!canAccessPath(role, request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.searchParams.set("error", "forbidden");
    return redirectWithSession(url, supabaseResponse);
  }

  return supabaseResponse;
}
