// "superadmin" es el rol de plataforma (Miracle), por encima de un hospital.
// Vive en su propia consola (/superadmin); no usa el panel /app.
//
// "secretaria": cuenta de solo lectura acotada a médicos específicos (ver
// supabase/migrations/20260722010000_secretaria_role.sql). A diferencia de
// "supervisor" (que ve TODA la organización), una secretaria solo ve las
// consultas de los médicos que tenga asignados en secretary_doctor_access.
export const APP_ROLES = ["superadmin", "admin", "supervisor", "medico", "secretaria"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Super-admin",
  admin: "Administrador",
  supervisor: "Supervisor",
  medico: "Médico",
  secretaria: "Secretaría",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

/**
 * Secciones que ve la cuenta de demostración comercial: exactamente las de un
 * médico, ni una más.
 *
 * La demo se enseña a médicos (venta B2C), no a instituciones: auditoría,
 * reportes, usuarios y la configuración institucional son lo que vería un
 * administrador de hospital, cargan la pantalla y muestran un producto que el
 * comprador no va a usar. Patología es de otra división de cuenta, tampoco va.
 *
 * Por eso `is_demo` ya no DESTAPA secciones: ahora ACOTA. La cuenta sigue
 * teniendo rol `admin` por debajo (así la RLS le deja leer las consultas de su
 * organización demo), pero de cara a la interfaz es un médico.
 */
export const DEMO_SECTIONS = [
  "/app/dashboard",
  // Incluye /nueva y /en-vivo — el corazón de la demo, y son de rol `medico`.
  "/app/consultas",
  "/app/pacientes",
  "/app/notas",
  // El catálogo completo: la demo no tiene specialty_code, así que ve las
  // plantillas de todas las áreas médicas.
  "/app/plantillas",
] as const;

/** true si la ruta pertenece a la superficie de la cuenta demo. */
export function isDemoSection(pathname: string): boolean {
  return DEMO_SECTIONS.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
}

/**
 * ¿Puede este usuario abrir esta ruta?
 *
 * `isDemo` no otorga acceso a datos en ningún caso: la RLS sigue siendo la
 * autoridad y sigue acotando todo a la organización del usuario. Tampoco abre
 * /superadmin — la consola de plataforma se decide solo por rol. Solo un
 * superadmin puede activar el flag (trigger en la migración
 * 20260731000000_demo_account_flag.sql).
 */
export function canAccessPath(
  role: AppRole,
  pathname: string,
  isDemo = false,
): boolean {
  // La consola de plataforma es exclusiva del superadmin. Se evalúa antes que
  // el flag demo: `is_demo` nunca abre esta puerta.
  if (pathname.startsWith("/superadmin")) {
    return role === "superadmin";
  }

  // El superadmin no usa /app (el proxy lo redirige a su consola). Devolvemos
  // true para no marcar "forbidden" en chequeos secundarios.
  if (role === "superadmin") {
    return true;
  }

  // Lista blanca estricta (al revés del resto de reglas, que son permisivas
  // por defecto): una secretaria solo puede ver el listado de consultas y el
  // detalle de una consulta (de solo lectura por rol, ver [id]/page.tsx).
  // Nunca /nueva ni /en-vivo, aunque intente navegar ahí directo por URL.
  if (role === "secretaria") {
    return (
      pathname === "/app/dashboard" ||
      pathname === "/app/consultas" ||
      (pathname.startsWith("/app/consultas/") &&
        !pathname.startsWith("/app/consultas/nueva") &&
        !pathname.startsWith("/app/consultas/en-vivo"))
    );
  }

  // La demo es un médico de cara a la interfaz: lista blanca, aunque su rol
  // `admin` alcance más. Va después de la secretaría a propósito — entre dos
  // listas blancas manda la más estricta, el flag nunca asciende a nadie.
  if (isDemo) {
    return isDemoSection(pathname);
  }

  if (
    pathname.startsWith("/app/consultas/nueva") ||
    pathname.startsWith("/app/consultas/en-vivo")
  ) {
    return role === "medico";
  }

  // /app/laboratorio no se decide aquí: lo gobierna el professional_type en la
  // propia página (canUsePhotoNotes).
  //
  // OJO con el parecido de nombres: la ruta acotada a admin es
  // /app/institucion (membrete, servicios, valores por defecto del hospital).
  // /app/configuracion es la pantalla de ajustes PERSONALES y la alcanza
  // cualquier rol clínico por la regla permisiva del final — un supervisor
  // también tiene nombre, cédula y micrófono. La secretaría sigue fuera por su
  // lista blanca de arriba, y la demo por la suya.
  if (pathname.startsWith("/app/usuarios") || pathname.startsWith("/app/institucion")) {
    return role === "admin";
  }

  if (pathname.startsWith("/app/auditoria") || pathname.startsWith("/app/reportes")) {
    return role === "admin" || role === "supervisor";
  }

  return true;
}
