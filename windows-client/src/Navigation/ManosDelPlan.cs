using System.Diagnostics;
using System.Runtime.InteropServices;
using U.Ciclo;
using U.WindowsClient.Diagnostics;

namespace U.WindowsClient.Navigation;

/// <summary>
/// LOS GESTOS DEL PLAN (spec 062): abrir, escribir, pulsar una tecla, desplazar y esperar, sobre la ventana de delante,
/// con las esperas que u/ midió (spec 052). Es el comportamiento de <c>U.Ciclo.Asistente</c>, no una copia de su archivo:
/// allí son privados y su mano no mira bajo el punto (510), que en U.exe es obligatorio.
/// </summary>
public sealed class ManosDelPlan
{
    private readonly LectorUia _lector;

    public ManosDelPlan(LectorUia lector) => _lector = lector;

    private static IntPtr Ventana() => Donde.Ahora()?.Ventana ?? IntPtr.Zero;

    /// <summary>
    /// ABRIR INCLUYE QUE SE PUEDA LEER (u/, promesa 456): una app recién abierta da 4 de sus 59 botones a medio pintar.
    /// Con el navegador delante, una dirección va en la misma pestaña (u/, promesa 473).
    /// </summary>
    public bool Abrir(string app)
    {
        var aqui = Donde.Ahora();
        if (aqui != null && Apps.EnLaMismaPestana(app, aqui.Proceso))
        {
            var rp = Stopwatch.StartNew();
            string antes = _lector.Leer(aqui.Ventana).Huella;
            if (_lector.EscribirEnLaBarra(aqui.Ventana, app) && Raton.Tecla("Enter"))
            {
                var a = Asentado.Esperar(() => _lector.Leer(aqui.Ventana).Huella, antes, 3000, () => rp.ElapsedMilliseconds);
                LogBus.Log("plan", $"   abrir «{app}» en la misma pestaña: {(a.Cambio ? "cargó" : "sin cambio visible")} en {rp.ElapsedMilliseconds} ms");
                return true;
            }
            LogBus.Log("plan", $"   abrir «{app}»: no encontré la barra de direcciones; la abro aparte");
        }
        var (llego, ms) = Apps.Abrir(app);
        if (!llego) { LogBus.Log("plan", $"   abrir «{app}»: no llegó delante en {ms} ms"); return false; }
        var r = Stopwatch.StartNew();
        int n = 0;
        var q = Asentado.Quieta(() => { var l = _lector.Leer(Ventana()); n = l.Accionables.Count; return l; }, 3000, () => r.ElapsedMilliseconds);
        LogBus.Log("plan", $"   abrir «{app}»: delante en {ms} ms, {(q.Cambio ? "quieta" : "todavía moviéndose")} en {q.Ms} ms más ({n} accionables)");
        return true;
    }

    /// <summary>Teclear y esperar a que la app termine de consumirlo (u/, promesa 459).</summary>
    public void Escribir(string texto)
    {
        Raton.Escribir(texto);
        var reloj = Stopwatch.StartNew();
        var q = Asentado.Quieta(() => _lector.Leer(Ventana()), Ejecutor.EsperaTrasEscribir(texto), () => reloj.ElapsedMilliseconds);
        LogBus.Log("plan", $"   escribir {texto.Length} caracteres: {(q.Cambio ? "quieta" : "todavía tecleando")} en {q.Ms} ms");
    }

    /// <summary>Una tecla, y salir en cuanto la pantalla cambie (u/, promesa 453: Enter espera hasta 1,5 s).</summary>
    public bool Tecla(string tecla)
    {
        string antes = _lector.Leer(Ventana()).Huella;
        if (!Raton.Tecla(tecla)) return false;
        var reloj = Stopwatch.StartNew();
        var a = Asentado.Esperar(() => _lector.Leer(Ventana()).Huella, antes, Ejecutor.EsperaTrasTecla(tecla), () => reloj.ElapsedMilliseconds);
        LogBus.Log("plan", $"   tecla «{tecla}»: {(a.Cambio ? "la pantalla cambió" : "la pantalla no cambió")} en {a.Ms} ms");
        return true;
    }

    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out Rect r);
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int L, T, R, B; }

    /// <summary>La rueda sobre el centro de la ventana de delante (u/, promesa 462), y la misma espera que tras un clic.</summary>
    public bool Desplazar(int muescas)
    {
        var v = Ventana();
        if (v == IntPtr.Zero || !GetWindowRect(v, out var r)) return false;
        string antes = _lector.Leer(v).Huella;
        var reloj = Stopwatch.StartNew();
        Raton.Desplazar((r.L + r.R) / 2, (r.T + r.B) / 2, muescas);
        var a = Asentado.Esperar(() => _lector.Leer(v).Huella, antes, Asentado.TechoMs, () => reloj.ElapsedMilliseconds);
        LogBus.Log("plan", $"   desplazar {muescas}: {(a.Cambio ? "la pantalla cambió" : "la pantalla no cambió")} en {a.Ms} ms");
        return true;
    }

    /// <summary>«esperar» (u/, promesa 467): hasta dos lecturas iguales, techo 3 s. No pulsa nada.</summary>
    public bool EsperarQuieta()
    {
        var reloj = Stopwatch.StartNew();
        var q = Asentado.Quieta(() => _lector.Leer(Ventana()), 3000, () => reloj.ElapsedMilliseconds);
        LogBus.Log("plan", $"   esperar: {(q.Cambio ? "quieta" : "todavía moviéndose")} en {q.Ms} ms ({q.Lecturas} lecturas)");
        return true;
    }
}
