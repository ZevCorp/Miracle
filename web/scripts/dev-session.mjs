// Abre una sesión LOCAL con la cuenta de demostración y deja lista la cookie
// para pegarla en el navegador.
//
// PARA QUÉ
// Permite revisar las pantallas del médico (dashboard, consultas, laboratorio)
// durante el desarrollo sin tener que iniciar sesión a mano cada vez.
//
// TRES CANDADOS, A PROPÓSITO
//   1. Solo acepta la cuenta demo. Cualquier otro correo se rechaza, así que
//      esta herramienta NUNCA da acceso a la cuenta de un médico real y nunca
//      expone datos de pacientes.
//   2. Se niega a correr en producción.
//   3. La contraseña sale de DEMO_ACCOUNT_PASSWORD (.env.local). No está en el
//      código ni en el repositorio.
//
//   node scripts/dev-session.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@miracle.app";

function abortar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
}

// Candado 2: nada de esto tiene sentido —ni es seguro— fuera de local.
if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  abortar("Esta herramienta es solo para desarrollo local.");
}

// .env.local no se carga solo en un script suelto: se lee a mano.
function cargarEnvLocal() {
  const env = {};
  try {
    const contenido = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const linea of contenido.split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;
      const separador = limpia.indexOf("=");
      if (separador === -1) continue;
      env[limpia.slice(0, separador).trim()] = limpia
        .slice(separador + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    // Sin .env.local se sigue con las variables del entorno.
  }
  return env;
}

const envLocal = cargarEnvLocal();
const leer = (clave) => process.env[clave] || envLocal[clave] || "";

const supabaseUrl = leer("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey =
  leer("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || leer("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const password = leer("DEMO_ACCOUNT_PASSWORD");

if (!supabaseUrl || !supabaseKey) {
  abortar("Faltan NEXT_PUBLIC_SUPABASE_URL o la clave pública en .env.local");
}
if (!password) {
  abortar(
    "Falta DEMO_ACCOUNT_PASSWORD en .env.local.\n" +
      "  Es la contraseña de la cuenta demo (está en supabase/seed/demo-account.sql,\n" +
      "  que vive fuera del repositorio). Agrégala así:\n\n" +
      "    DEMO_ACCOUNT_PASSWORD=la-contraseña-de-la-cuenta-demo",
  );
}

// Candado 1: la identidad no es configurable. Está fijada en el código.
const email = DEMO_EMAIL;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  abortar(`No se pudo iniciar sesión como ${email}: ${error.message}`);
}

const { session, user } = data;
if (!session) {
  abortar("Supabase no devolvió sesión.");
}

// @supabase/ssr guarda la sesión en una cookie por proyecto, con el JSON de la
// sesión codificado en base64 y el prefijo "base64-".
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

const salida = {
  email: user?.email,
  expiresAt: session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null,
  cookieName,
  cookieValue,
};

console.log(JSON.stringify(salida, null, 2));
console.error(`\n✓ Sesión abierta como ${user?.email}`);
console.error(`  Pegar en la consola del navegador (en el origen de la app):\n`);
console.error(
  `  document.cookie = "${cookieName}=" + encodeURIComponent(${JSON.stringify(cookieValue)}) + "; path=/; max-age=3600";\n`,
);
