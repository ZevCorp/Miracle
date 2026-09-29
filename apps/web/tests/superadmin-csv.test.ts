import { describe, expect, it } from "vitest";
import { cabecerasCsv, nombreArchivoCsv, toCsv } from "@/lib/superadmin/csv";
import { sanitizarTermino, filtroBusqueda } from "@/lib/superadmin/filtros";

const BOM = "﻿";

describe("toCsv", () => {
  it("empieza por BOM y separa filas con CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}"a";"b"\r\n"1";"2"\r\n`);
  });

  it("usa punto y coma por defecto y coma cuando se pide", () => {
    expect(toCsv(["a", "b"], [])).toContain(`"a";"b"`);
    expect(toCsv(["a", "b"], [], { separador: "," })).toContain(`"a","b"`);
  });

  it("duplica las comillas internas y no rompe con el separador dentro del texto", () => {
    const csv = toCsv(["detalle"], [['Dijo "hola"; luego se fue']]);
    expect(csv).toContain(`"Dijo ""hola""; luego se fue"`);
  });

  it("trata null y undefined como celda vacía", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toContain(`"";""`);
  });

  it("neutraliza las fórmulas de Excel", () => {
    const peligrosos = [
      "=HYPERLINK(\"http://malo\",\"clic\")",
      "+1+1",
      "-2+3",
      "@SUM(A1)",
    ];
    const csv = toCsv(["detalle"], peligrosos.map((v) => [v]));
    for (const valor of peligrosos) {
      expect(csv).toContain(`"'${valor.replace(/"/g, '""')}"`);
    }
  });

  it("no toca un texto normal que solo contiene un igual", () => {
    expect(toCsv(["d"], [["estado = aprobada"]])).toContain(`"estado = aprobada"`);
  });

  it("anuncia el truncamiento dentro del archivo", () => {
    const csv = toCsv(["a"], [["x"]], { truncadoEn: { exportadas: 5000, total: 12345 } });
    expect(csv).toContain(`"TRUNCADO"`);
    expect(csv).toContain("Se exportaron 5000 de 12345 filas");
  });

  it("omite la fila de truncamiento cuando no hay tope", () => {
    expect(toCsv(["a"], [["x"]], { truncadoEn: null })).not.toContain("TRUNCADO");
  });
});

describe("nombreArchivoCsv y cabecerasCsv", () => {
  it("limpia caracteres que Windows rechaza en un nombre de archivo", () => {
    expect(nombreArchivoCsv("actividad", "2026-08-03")).toBe("actividad-2026-08-03.csv");
    expect(nombreArchivoCsv("consultas", "Hospital / Norte")).toBe(
      "consultas-Hospital-Norte.csv",
    );
  });

  it("marca la respuesta como descarga y sin caché", () => {
    const h = cabecerasCsv("x.csv") as Record<string, string>;
    expect(h["Content-Disposition"]).toBe('attachment; filename="x.csv"');
    expect(h["Cache-Control"]).toBe("no-store");
  });
});

describe("sanitizarTermino", () => {
  it("quita los metacaracteres que rompen el parser de PostgREST", () => {
    expect(sanitizarTermino("(hola)")).toBe("hola");
    expect(sanitizarTermino("a,b")).toBe("a b");
    expect(sanitizarTermino("100%")).toBe("100");
    expect(sanitizarTermino("  nota  ")).toBe("nota");
  });

  it("deja vacío un término que era solo metacaracteres", () => {
    expect(sanitizarTermino("%,()*\\")).toBe("");
  });
});

describe("filtroBusqueda", () => {
  it("arma el or sobre varias columnas", () => {
    expect(filtroBusqueda("nota", ["accion", "detalle"])).toBe(
      "accion.ilike.%nota%,detalle.ilike.%nota%",
    );
  });

  it("devuelve null cuando no queda término útil", () => {
    expect(filtroBusqueda("   ", ["accion"])).toBeNull();
    expect(filtroBusqueda("%%%", ["accion"])).toBeNull();
  });
});
