#!/usr/bin/env python3
"""Inventory → build/contracts → evidence → next gap. Never turns source presence into parity."""
import argparse
import collections
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--test', action='store_true')
args = parser.parse_args()
catalog = json.loads((HERE / 'capabilities.json').read_text())
sources = sorted(list((ROOT / 'mac-client/Sources').rglob('*.swift')) + list((ROOT / 'mac-client/Tests').rglob('*.swift')) + [ROOT / 'mac-client/Package.swift'])
fingerprint = hashlib.sha256(b''.join(str(p.relative_to(ROOT)).encode() + p.read_bytes() for p in sources)).hexdigest()
report = dict(date=datetime.datetime.now(datetime.timezone.utc).isoformat(), source_sha256=fingerprint,
              reference_commit=catalog['reference_commit'], capabilities=catalog['capabilities'], checks=[])
for cap in report['capabilities']:
    for path in cap['windows'] + cap['mac'] + cap.get('contracts', []) + cap.get('evidence', []):
        if not (ROOT / path).exists():
            raise SystemExit(f"Unknown source in {cap['id']}: {path}")
specs = []
for path in sorted((ROOT / 'docs/specs').glob('*.md')):
    text = path.read_text()
    promises = re.findall(r'^\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*(.*?)\s*\|', text, re.M)
    specs.append(dict(path=str(path.relative_to(ROOT)), title=text.splitlines()[0], promises=promises))
report['windows_specs'] = specs
windows_tools = set()
for path in (ROOT / 'windows-client/src').rglob('*.cs'):
    windows_tools.update(re.findall(r'"((?:map_|file_|voz_|leccion_)[a-z_]+)"', path.read_text(encoding='utf-8-sig')))
mac_tools = set(re.findall(r'function\("([a-z_]+)"', (ROOT / 'mac-client/Sources/UCore/LiveTools.swift').read_text()))
report['tools'] = dict(windows_references=sorted(windows_tools), mac_advertised=sorted(mac_tools),
                       missing_exact_names=sorted(windows_tools - mac_tools))
report['note'] = 'Exact-name gaps require semantic review; aliases are not automatically equivalent. Passing unit tests is not installed-app or provider evidence.'
if args.test:
    env = dict(os.environ)
    env['CLANG_MODULE_CACHE_PATH'] = '/tmp/u-mac-module-cache'
    env['SWIFTPM_MODULECACHE_OVERRIDE'] = '/tmp/u-mac-module-cache'
    for name in ('contracts', 'build'):
        command = ['swift', 'run'] if name == 'contracts' else ['swift', 'build']
        command += ['--package-path', str(ROOT / 'mac-client'), '--scratch-path', '/tmp/u-migration-build', '--disable-sandbox']
        command += ['NativeContract'] if name == 'contracts' else ['--product', 'U']
        started = time.monotonic()
        result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
        report['checks'].append(dict(name=name, passed=result.returncode == 0, seconds=round(time.monotonic()-started, 3), output=result.stdout))
        print(result.stdout)
        if result.returncode: break
counts = collections.Counter(c['implementation'] for c in report['capabilities'])
report['summary'] = dict(total=len(report['capabilities']), implementation=dict(counts),
                         installed_verified=sum(c['installed'] == 'verified' for c in report['capabilities']),
                         installed_partial=sum(c['installed'] == 'partial' for c in report['capabilities']))
output = ROOT / 'mac-client/.artifacts/migration'
output.mkdir(parents=True, exist_ok=True)
(output / 'latest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
lines = ['# Migración de experiencia Windows → Mac', '',
         'Generado por `python3 mac-client/migration/verify.py --test`. Ninguna capacidad se considera migrada por existir su archivo.', '',
         f"Referencia Windows local: `{catalog['reference_commit']}`. {len(specs)} documentos de especificación revisables; {len(windows_tools)} nombres de herramientas referenciados.", '',
         '| Capacidad | Implementación | App instalada | Criterio de aceptación |', '|---|---|---|---|']
for cap in report['capabilities']:
    lines.append(f"| {cap['id']} — {cap['title']} | {cap['implementation']} | {cap['installed']} | {cap['acceptance']} |")
lines += ['', 'Las pruebas instaladas parciales se enlazan en `capabilities.json`; no acreditan toda la fila. Sus hashes corresponden al binario probado, no necesariamente al código más reciente.', '', '## Ciclo reproducible', '',
          '1. Elegir una capacidad pendiente y escribir su contrato rojo.',
          '2. Implementar en UCore (reglas), UMac (sistema) o UApp (presentación).',
          '3. Ejecutar contratos y construcción; comprobar que una mutación de la regla rompe el contrato.',
          '4. Probar el escenario instalado con datos de prueba; registrar resultado y tiempos.',
          '5. Actualizar el catálogo solo con la evidencia obtenida y pasar a la siguiente capacidad.', '',
          'Los fallos de saldo, permisos, credenciales o plataforma permanecen visibles y no cuentan como aprobados.',
          'La evidencia reproducible, salida de pruebas y huella del código quedan en `.artifacts/migration/latest.json`.']
(HERE / 'STATUS.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(report['summary'], ensure_ascii=False))
sys.exit(1 if any(not c['passed'] for c in report['checks']) else 0)
