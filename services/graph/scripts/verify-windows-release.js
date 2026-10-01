// «Distribuir App» lanza el workflow de Windows con TODO lo que el workflow exige.
//
// Por qué importa: `windows-release.yml` declara `user_message` como input
// obligatorio (lo que Ü le cuenta a la persona sobre la versión). El servicio
// mandaba solo `version` y `request_id`, GitHub contestaba 422 «Required input
// 'user_message' not provided» y el botón de Provider Studio no podía publicar
// nada. Nadie lo vio porque las releases se sacaban a mano desde la terminal.
//
// Lo que se protege aquí:
//   1. el dispatch lleva los tres inputs obligatorios del workflow, leídos del
//      propio .yml cuando está a mano (monorepo) — si mañana el workflow exige
//      un cuarto, esto se pone rojo en vez de enterarnos por un 422;
//   2. sin mensaje no se llama a GitHub: se rechaza antes, con un 400 que dice
//      qué falta;
//   3. la ruta HTTP y el botón del estudio pasan el mensaje (lectura de fuente).
//
//   node scripts/verify-windows-release.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WindowsAppReleaseService = require('../src/application/use-cases/WindowsAppReleaseService');

const ROOT = path.join(__dirname, '..');

function fakeGithub(calls) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/releases/latest')) {
      return { ok: true, json: async () => ({ tag_name: 'v1.3.6', assets: [] }) };
    }
    if (url.endsWith('/dispatches')) {
      return { ok: true, status: 204, text: async () => '' };
    }
    throw new Error(`llamada inesperada a ${url}`);
  };
}

function service(calls) {
  return new WindowsAppReleaseService({ githubToken: 't', repo: 'ZevCorp/U-Windows-App', fetch: fakeGithub(calls) });
}

// Los inputs que el workflow declara `required: true`, leídos del .yml. En el
// despliegue de Vercel el archivo no viaja: entonces se usa la lista conocida.
function requiredInputs() {
  const yml = path.join(ROOT, '..', '..', '.github', 'workflows', 'windows-release.yml');
  if (!fs.existsSync(yml)) return ['version', 'request_id', 'user_message'];
  const text = fs.readFileSync(yml, 'utf8');
  const block = text.slice(text.indexOf('inputs:'), text.indexOf('concurrency:'));
  const names = [];
  let current = null;
  for (const line of block.split(/\r?\n/)) {
    const name = /^ {6}([a-z_]+):\s*$/.exec(line);
    if (name) current = name[1];
    if (current && /^ {8}required:\s*true\s*$/.test(line)) names.push(current);
  }
  assert.ok(names.length >= 3, `no pude leer los inputs obligatorios del workflow (leí ${names.length})`);
  return names;
}

async function testElDispatchLlevaLoQueElWorkflowExige() {
  const calls = [];
  const result = await service(calls).triggerBuild({ userMessage: '  Ahora Ü se actualiza sola.  ' });
  const dispatch = calls.find((c) => c.url.endsWith('/dispatches'));
  assert.ok(dispatch, 'no se llamó a GitHub para lanzar el workflow');
  const body = JSON.parse(dispatch.init.body);
  assert.strictEqual(body.ref, 'main');
  for (const input of requiredInputs()) {
    assert.ok(`${body.inputs[input] || ''}`.trim(), `el dispatch no lleva «${input}», que el workflow exige: GitHub contestaría 422`);
  }
  assert.strictEqual(body.inputs.user_message, 'Ahora Ü se actualiza sola.', 'el mensaje viaja sin los espacios de alrededor');
  assert.strictEqual(body.inputs.version, '1.3.7', 'la versión es la siguiente a la publicada');
  assert.strictEqual(result.version, '1.3.7');
  assert.strictEqual(body.inputs.request_id, result.requestId);
}

async function testSinMensajeNoSeLlamaAGithub() {
  for (const userMessage of [undefined, '', '   ']) {
    const calls = [];
    await assert.rejects(
      () => service(calls).triggerBuild({ userMessage }),
      (error) => error.statusCode === 400 && /qué trae esta versión/.test(error.message)
    );
    assert.strictEqual(calls.length, 0, 'sin mensaje no se gasta ni una llamada a GitHub');
  }
  const calls = [];
  await assert.rejects(() => service(calls).triggerBuild(), (error) => error.statusCode === 400);
}

function testLaRutaYElBotonPasanElMensaje() {
  const route = fs.readFileSync(path.join(ROOT, 'web', 'api', 'registerWindowsDistributionRoutes.js'), 'utf8');
  assert.ok(/triggerBuild\(\{\s*userMessage:\s*req\.body\?\.user_message\s*\}\)/.test(route),
    'la ruta POST /api/providers/windows-app/build no pasa user_message al servicio');
  const studio = fs.readFileSync(path.join(ROOT, 'web', 'public', 'provider-studio.js'), 'utf8');
  const trigger = studio.slice(studio.indexOf('async function triggerWindowsDistribute'), studio.indexOf('async function loadWindowsBuildMeta'));
  assert.ok(/user_message:\s*userMessage/.test(trigger), 'el botón «Distribuir App» no manda user_message');
}

(async () => {
  await testElDispatchLlevaLoQueElWorkflowExige();
  await testSinMensajeNoSeLlamaAGithub();
  testLaRutaYElBotonPasanElMensaje();
  console.log('verify-windows-release: OK');
})().catch((error) => {
  console.error('verify-windows-release: FALLÓ');
  console.error(error);
  process.exit(1);
});
