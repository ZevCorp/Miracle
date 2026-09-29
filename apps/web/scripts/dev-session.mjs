// Abre una sesión LOCAL con una cuenta de PRUEBA y deja lista la cookie para
// pegarla en el navegador.
//
// PARA QUÉ
// Permite revisar las pantallas de cada rol (médico, patólogo, administrador,
// super-admin, demo comercial) durante el desarrollo sin tener que iniciar
// sesión a mano cada vez.
//
// TRES CANDADOS, A PROPÓSITO
//   1. Lista blanca cerrada, escrita en el código: solo las cuentas de prueba
//      @miracle.app. El correo NO es un parámetro — se elige por alias entre
//      las de abajo. Esta herramienta NUNCA da acceso a la cuenta de un médico
//      real y nunca expone datos de pacientes de un cliente.
//   2. Se niega a correr en producción.
//   3. Cada contraseña sale de su propia variable en .env.local. Ninguna está
//      en el código ni en el repositorio (que es público).
//
//   node scripts/dev-session.mjs            → demo comercial (por defecto)
//   node scripts/dev-session.mjs medico
//   node scripts/dev-session.mjs patologo
//   node scripts/dev-session.mjs supervisor
//   node scripts/dev-session.mjs admin
//   node scripts/dev-session.mjs superadmin
//
// La primera vez de cada cuenta, para guardar su contraseña en .env.local sin
// escribirla en el archivo a mano (se pide por teclado, no se ve al teclearla
// y no queda en el historial del shell):
//
//   node scripts/dev-session.mjs medico --guardar
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

// Candado 1: la lista blanca. Añadir una entrada aquí es una decisión
// deliberada y revisable en el diff; el dominio @miracle.app se vuelve a
// verificar más abajo por si alguien pega un correo de cliente por error.
const CUENTAS = Object.freeze({
  demo: {
    email: "demo@miracle.app",
    envPassword: "DEMO_ACCOUNT_PASSWORD",
    descripcion: "Demo comercial — superficie de médico, organización aislada",
    empezarEn: "/app/dashboard",
  },
  medico: {
    email: "medico@miracle.app",
    envPassword: "TEST_MEDICO_PASSWORD",
    descripcion: "Médico general — consulta nueva y grabación en vivo",
    empezarEn: "/app/consultas/nueva",
  },
  patologo: {
    email: "patologo@miracle.app",
    envPassword: "TEST_PATOLOGO_PASSWORD",
    descripcion: "Patólogo — laboratorio y nota desde foto",
    empezarEn: "/app/laboratorio",
  },
  supervisor: {
    email: "supervisor@miracle.app",
    envPassword: "TEST_SUPERVISOR_PASSWORD",
    descripcion: "Supervisor — auditoría y reportes de toda la organización",
    empezarEn: "/app/auditoria",
  },
  admin: {
    email: "admin@miracle.app",
    envPassword: "TEST_ADMIN_PASSWORD",
    descripcion: "Administrador de hospital — usuarios, auditoría, reportes",
    empezarEn: "/app/usuarios",
  },
  superadmin: {
    email: "superadmin@miracle.app",
    envPassword: "TEST_SUPERADMIN_PASSWORD",
    descripcion: "Super-admin de plataforma — consola de Miracle",
    empezarEn: "/superadmin",
  },
});

const ALIAS_POR_DEFECTO = "demo";

function abortar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
}

function listado() {
  return Object.entries(CUENTAS)
    .map(([alias, c]) => `    ${alias.padEnd(11)} ${c.email.padEnd(24)} ${c.descripcion}`)
    .join("\n");
}

// Candado 2: nada de esto tiene sentido —ni es seguro— fuera de local.
if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  abortar("Esta herramienta es solo para desarrollo local.");
}

const argumentos = process.argv.slice(2);
const guardar = argumentos.includes("--guardar") || argumentos.includes("-g");
const posicional = argumentos.find((a) => !a.startsWith("-"));
const alias = (posicional || ALIAS_POR_DEFECTO).toLowerCase();

if (["help", "h", "--help", "-h"].some((f) => argumentos.includes(f))) {
  console.error(`\nCuentas de prueba disponibles:\n\n${listado()}\n`);
  console.error("  --guardar   pide la contraseña por teclado y la escribe en .env.local\n");
  process.exit(0);
}

const cuenta = CUENTAS[alias];
if (!cuenta) {
  abortar(
    `No existe la cuenta de prueba "${alias}".\n\n` +
      `  Solo se puede entrar con estas (la lista está fijada en el código):\n\n${listado()}`,
  );
}

// Refuerzo del candado 1: aunque alguien edite CUENTAS, un correo que no sea de
// prueba no pasa de aquí. Dos verificaciones independientes en vez de una.
if (!cuenta.email.endsWith("@miracle.app")) {
  abortar(
    `"${cuenta.email}" no es una cuenta de prueba.\n` +
      "  Este script solo abre sesión con cuentas @miracle.app: las de clientes\n" +
      "  reales tienen datos de pacientes y no se tocan desde aquí.",
  );
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

if (!supabaseUrl || !supabaseKey) {
  abortar("Faltan NEXT_PUBLIC_SUPABASE_URL o la clave pública en .env.local");
}

// Pide la contraseña por teclado SIN mostrarla y sin que quede en el historial
// del shell (que es lo que pasaría con `TEST_X_PASSWORD=... node ...`).
function preguntarOculto(mensaje) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("SIN_TTY"));
      return;
    }
    process.stdout.write(mensaje);
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Sin eco: ni la contraseña ni asteriscos. El prompt ya se imprimió arriba.
    rl._writeToOutput = () => {};
    rl.question("", (respuesta) => {
      rl.close();
      process.stdout.write("\n");
      resolve(respuesta.trim());
    });
  });
}

// Escribe (o reemplaza) una variable en .env.local conservando el resto.
function guardarEnEnvLocal(clave, valor) {
  const ruta = new URL("../.env.local", import.meta.url);
  let contenido = "";
  try {
    contenido = readFileSync(ruta, "utf8");
  } catch {
    // .env.local todavía no existe: se crea con esta sola variable.
  }
  const patron = new RegExp(`^${clave}=.*$`, "m");
  // El reemplazo va como función a propósito: una contraseña con "$&" o "$1"
  // se corrompería si se pasara como cadena.
  contenido = patron.test(contenido)
    ? contenido.replace(patron, () => `${clave}=${valor}`)
    : `${contenido.replace(/\s*$/, "")}\n${clave}=${valor}\n`;
  writeFileSync(ruta, contenido, "utf8");
}

// Candado 3: la contraseña vive en .env.local, una variable por cuenta. Así el
// alcance de cada secreto es exactamente una cuenta de prueba.
let password = leer(cuenta.envPassword);
// Solo se escribe en .env.local una contraseña que ya demostró funcionar.
let debeGuardar = false;

if (!password || guardar) {
  try {
    password = await preguntarOculto(
      `\n  Contraseña de ${cuenta.email} (no se verá al teclearla): `,
    );
  } catch (e) {
    if (e.message !== "SIN_TTY") throw e;
    abortar(
      `Falta ${cuenta.envPassword} en .env.local.\n` +
        `  Es la contraseña de ${cuenta.email} (${cuenta.descripcion}).\n\n` +
        "  Corre esto TÚ en tu terminal y te la pide por teclado:\n\n" +
        `    node scripts/dev-session.mjs ${alias} --guardar\n\n` +
        "  (Aquí no se puede: este proceso no tiene teclado conectado.)\n" +
        "  Si no la recuerdas: Supabase → Authentication → Users → esa cuenta →\n" +
        "  Reset password. Son cuentas de prueba, no las de ningún cliente.",
    );
  }

  if (!password) {
    abortar("No escribiste ninguna contraseña.");
  }

  debeGuardar = true;
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email: cuenta.email,
  password,
});

if (error) {
  abortar(
    `No se pudo iniciar sesión como ${cuenta.email}: ${error.message}\n` +
      `  Revisa el valor de ${cuenta.envPassword} en .env.local.`,
  );
}

const { session, user } = data;
if (!session) {
  abortar("Supabase no devolvió sesión.");
}

// Ya sabemos que la contraseña sirve: recién ahora se guarda.
if (debeGuardar) {
  guardarEnEnvLocal(cuenta.envPassword, password);
  console.error(`\n✓ ${cuenta.envPassword} guardada en .env.local (gitignored).`);
}

// @supabase/ssr guarda la sesión en una cookie por proyecto, con el JSON de la
// sesión codificado en base64 y el prefijo "base64-".
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

const salida = {
  alias,
  email: user?.email,
  expiresAt: session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null,
  empezarEn: cuenta.empezarEn,
  cookieName,
  cookieValue,
};

console.log(JSON.stringify(salida, null, 2));
console.error(`\n✓ Sesión abierta como ${user?.email} (${cuenta.descripcion})`);
console.error(`  Empieza en: ${cuenta.empezarEn}`);
console.error(`  Pegar en la consola del navegador (en el origen de la app):\n`);
console.error(
  `  document.cookie = "${cookieName}=" + encodeURIComponent(${JSON.stringify(cookieValue)}) + "; path=/; max-age=3600";\n`,
);
