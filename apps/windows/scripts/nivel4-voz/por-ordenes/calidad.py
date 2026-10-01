"""
La misma batería de seis pedidos sobre el MISMO binario, cambiando solo el delegado por variable (promesa 686).

    python calidad.py <U.exe> por-defecto,sol-low [<carpeta de datos>]
    python analizar.py <carpeta de datos> por-defecto,sol-low

Cada pedido abre una sesión de voz de pago y OPERA EL ESCRITORIO: abre la Calculadora y Configuración, y
las cierra al terminar si las abrió ella. Solo arranca con el PC quieto. Medido el 2026-10-01 (spec 073):
gpt-6-luna en medium acertó 16 de 18 y gpt-6.1-sol en low 6 de 6, tardando el doble en lo sencillo.
"""
import os, subprocess, sys

aqui = os.path.dirname(os.path.abspath(__file__))
ORDENES = [
    "abre la calculadora y calcula 1234 por 56",
    "abre Configuración, entra en Bluetooth y dispositivos, y dime qué dispositivos aparecen",
    "abre la calculadora, calcula 25 por 4, y después abre Configuración y entra en Sistema",
    "abre Configuración y dime cuánta memoria RAM tiene este equipo",
    "dime cuántos archivos hay en mi carpeta Descargas",
    "abre la calculadora, cámbiala a modo científica y calcula la raíz cuadrada de 144",
]
CONFIG = {
    "por-defecto": {},
    "luna-low": {"U_DELEGADO": "gpt-6-luna", "U_DELEGADO_ESFUERZO": "low", "U_DELEGADO_PRISA": "0"},
    "luna-none": {"U_DELEGADO": "gpt-6-luna", "U_DELEGADO_ESFUERZO": "none", "U_DELEGADO_PRISA": "0"},
    "luna-medium": {"U_DELEGADO": "gpt-6-luna", "U_DELEGADO_ESFUERZO": "medium", "U_DELEGADO_PRISA": "0"},
    "luna-medium-prisa": {"U_DELEGADO": "gpt-6-luna", "U_DELEGADO_ESFUERZO": "medium", "U_DELEGADO_PRISA": "1"},
    "sol-low": {"U_DELEGADO": "gpt-6.1-sol", "U_DELEGADO_ESFUERZO": "low", "U_DELEGADO_PRISA": "0"},
    "sol-prisa": {"U_DELEGADO": "gpt-6.1-sol", "U_DELEGADO_ESFUERZO": "low", "U_DELEGADO_PRISA": "1"},
}
exe = sys.argv[1]
datos = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(exe), "..", "nivel4-por-ordenes")
for cfg in sys.argv[2].split(","):
    entorno = {k: v for k, v in os.environ.items() if not k.startswith("U_DELEGADO")}
    entorno.update(CONFIG[cfg], PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-u", os.path.join(aqui, "nivel4.py"), exe, os.path.join(os.path.abspath(datos), cfg), "8861", cfg] + ORDENES,
                       env=entorno, capture_output=True, text=True, encoding="utf-8", errors="replace")
    for linea in p.stdout.splitlines():
        if any(c in linea for c in ("→", "voz-turno", "Ü dijo", "NO SE PUDO", "cerrada ", "Traceback")) or linea.startswith("[" + cfg + "]"):
            print(linea[:380], flush=True)
    if p.returncode != 0:
        print(f"[{cfg}] terminó con código {p.returncode}: {p.stderr[-400:]}", flush=True)
