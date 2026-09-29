import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

/**
 * Invariantes del Resumen de la consola.
 *
 * Son afirmaciones sobre el CÓDIGO, no sobre la base: el repo todavía no tiene
 * DOM en las pruebas, así que estas cubren lo que sí se puede comprobar sin
 * montar componentes — y cubren justo lo que se rompe en silencio, que es una
 * tarjeta enseñando el número de otra métrica.
 */
describe("resumen de la consola de plataforma", () => {
  const page = source("app/superadmin/page.tsx");
  const rpc = source("supabase/migrations/20260808000000_superadmin_dashboard_serie_medicos.sql");

  it("la microtendencia de médicos sale de la serie de médicos, no de la del asistente", () => {
    // El fallo original: `sparkAsistente = serie.map(d => d.encounters)` alimentaba
    // la tarjeta "Médicos trabajando". El titular contaba médicos y la línea de
    // debajo contaba encuentros del asistente clínico.
    expect(page).not.toContain("sparkAsistente");
    expect(page).toContain("sparkMedicos");
    expect(page).toMatch(/sparkMedicos[\s\S]{0,200}d\.medicos/);

    // Y si la base todavía no devuelve la serie, la tarjeta se queda sin
    // sparkline en vez de dibujar otra cosa.
    expect(page).toMatch(/every\(\(d\) => typeof d\.medicos === "number"\)/);
    expect(page).toContain(": undefined");
  });

  it("la RPC emite la serie diaria de médicos y el nombre honesto de activos", () => {
    expect(rpc).toContain("'medicos', coalesce(c.medicos, 0)");
    expect(rpc).toContain("count(distinct medico_id) as medicos");
    expect(rpc).toContain("'members_active_rango'");
    // El nombre viejo sobrevive con el mismo valor: /organizaciones y el detalle
    // siguen leyéndolo mientras migran.
    expect(rpc).toContain("'members_active_30d'");
  });

  it("las cifras por organización responden al selector de periodo", () => {
    // La tabla mostraba `consultas_total` (histórico) justo debajo del selector
    // de rango, así que el número no obedecía al control que tenía encima.
    expect(page).toContain("org.consultas_rango");
    expect(page).toMatch(/consultas_total\)\}\s*en total/);
    // Y la lista de volumen filtra por el periodo, no por el histórico.
    expect(page).toContain("(o) => o.consultas_rango > 0");
  });

  it("las incidencias se ven antes que las métricas y no tapan el historial", () => {
    expect(page).toContain("BandaOperativa");
    // Las notas fallidas se cuentan dentro del rango: una banda alimentada por el
    // acumulado histórico no se apagaría nunca y dejaría de leerse.
    expect(page).toMatch(/fallidasEnRango=\{kpis\.exito_notas\.fallidos\}/);
    // El enlace al explorador de actividad ya no se sustituye por el aviso.
    expect(page).toContain('href="/superadmin/actividad"');
  });

  it("la gráfica se puede usar sin ratón y expone sus datos", () => {
    const chart = source("components/superadmin/charts/TrendChart.tsx");

    expect(chart).toContain("onPointerMove");
    expect(chart).toContain("onPointerDown");
    expect(chart).toContain("tabIndex={0}");
    expect(chart).toContain("ArrowRight");
    expect(chart).toContain("ArrowLeft");
    expect(chart).toContain('aria-live="polite"');
    expect(chart).toContain("<table className=\"sr-only\">");
    // La rejilla de rectángulos con onMouseEnter solo servía para el ratón. Se
    // busca el atributo JSX y no la palabra suelta: el comentario de cabecera la
    // menciona justo para explicar por qué ya no está.
    expect(chart).not.toContain("onMouseEnter={");
  });
});
