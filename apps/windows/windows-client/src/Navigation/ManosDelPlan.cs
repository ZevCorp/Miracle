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
    private readonly Func<IntPtr> _ventana;

    /// <param name="ventana">Dónde trabaja el plan: la misma ventana que el ciclo rápido (promesa 519).</param>
    public ManosDelPlan(LectorUia lector, Func<IntPtr> ventana)
    {
        _lector = lector;
        _ventana = ventana;
    }

    private IntPtr Ventana() => _ventana();

    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    /// <summary>Una ventana como la describe u/: su proceso sin «.exe» y su título.</summary>
    public static Ubicacion Describir(IntPtr h)
    {
        GetWindowThreadProcessId(h, out uint pid);
        string proceso = "";
        try { using var p = System.Diagnostics.Process.GetProcessById((int)pid); proceso = p.ProcessName; }
        catch (ArgumentException) { }   // el proceso ya no existe: se describe sin nombre
        return new Ubicacion(h, (int)pid, proceso, U.Graph.Surfaces.UiaSurface.TituloDe(h));
    }

    /// <summary>
    /// ABRIR INCLUYE QUE SE PUEDA LEER (u/, promesa 456): una app recién abierta da 4 de sus 59 botones a medio pintar.
    /// Con el navegador delante, una dirección va en la misma pestaña (u/, promesa 473).
    /// </summary>
    public bool Abrir(string app)
    {
        // La de delante TAL CUAL: una dirección va a la pestaña de delante solo si delante hay un navegador.
        var aqui = Donde.Leer();
        if (Apps.EnLaMismaPestana(app, aqui.Proceso))
        {
            var rp = Stopwatch.StartNew();
            string antes = _lector.Leer(aqui.Ventana).Huella;
            bool escrita = _lector.EscribirEnLaBarra(aqui.Ventana, app);
            if (escrita && Raton.Tecla("Enter"))
            {
                var a = Asentado.Esperar(() => _lector.Leer(aqui.Ventana).Huella, antes, 3000, () => rp.ElapsedMilliseconds);
                LogBus.Log("plan", $"   abrir «{app}» en la misma pestaña: {(a.Cambio ? "cargó" : "sin cambio visible")} en {rp.ElapsedMilliseconds} ms");
                return true;
            }
            // EL PASO QUE FALLÓ, y no una conclusión (aprendizaje nº2): escribir en la barra y pulsar Enter son dos cosas.
            LogBus.Log("plan", $"   abrir «{app}»: " + (escrita ? "escribí la dirección en la barra, pero no pude pulsar Enter"
                : $"no pude escribir en la barra de direcciones de «{aqui.Proceso}» ({_lector.PorQueNoLaBarra})") + "; la abro aparte");
        }
        var (llego, ms) = Apps.Abrir(app);
        if (!llego) { LogBus.Log("plan", $"   abrir «{app}»: no llegó delante en {ms} ms"); return false; }
        var r = Stopwatch.StartNew();
        int n = 0;
        // QUIETA Y PINTADA (promesa 523): una lectura con solo el marco de la ventana cuenta como vacía, y Quieta sigue esperando.
        var q = Asentado.Quieta(() => { var l = _lector.Leer(Ventana()); n = l.Accionables.Count; return Pintada(l) ? l : Lectura.Vacia; },
            3000, () => r.ElapsedMilliseconds);
        LogBus.Log("plan", $"   abrir «{app}»: delante en {ms} ms, {(q.Cambio ? "quieta" : "todavía moviéndose")} en {q.Ms} ms más ({n} accionables)");
        return true;
    }

    private static readonly string[] DelMarco = { "system", "sistema", "minimizar", "maximizar", "restaurar", "cerrar", "minimize", "maximize", "restore", "close" };

    /// <summary>
    /// ¿LA APP YA PINTÓ ALGO SUYO? (promesa 523): algún accionable que no sea el marco de la ventana. El 2026-09-29 (02:52)
    /// «abre: calculadora» se dio por quieta con solo «System» (MenuItem) —una app de la tienda que aún no pintaba— y lo que
    /// se tecleó después cayó en el vacío: Luna rehízo la cuenta en cinco planes.
    /// </summary>
    public static bool Pintada(Lectura l) => l.Accionables.Any(a =>
    {
        string n = (a.Nombre ?? "").Trim().ToLowerInvariant();
        return !DelMarco.Any(m => n == m || n.StartsWith(m + " ", StringComparison.Ordinal));
    });

    /// <summary>Teclear y esperar a que la app termine de consumirlo (u/, promesa 459).</summary>
    public void Escribir(string texto)
    {
        Raton.Escribir(texto);
        // La carita teclea (spec 085, promesa 698). Después de mandar las teclas y sin esperarla.
        if (Ui.LoQueUHace.AvisarDeQueEscribe(texto.Length) is { } noTeclea) LogBus.Log("plan", "   el aviso de que escribí reventó: " + noTeclea);
        var reloj = Stopwatch.StartNew();
        var q = Asentado.Quieta(() => _lector.Leer(Ventana()), Ejecutor.EsperaTrasEscribir(texto), () => reloj.ElapsedMilliseconds);
        LogBus.Log("plan", $"   escribir {texto.Length} caracteres: {(q.Cambio ? "quieta" : "todavía tecleando")} en {q.Ms} ms");
    }

    /// <summary>
    /// ELEGIR EN UNA LISTA DESPLEGABLE (spec 083, promesa 816): el foco en el campo, se teclea la opción, y se LEE lo
    /// que quedó elegido. null si quedó; si no, por qué —y entonces quien planea lo hace con dos «pulsa:»—.
    /// </summary>
    public string? Elegir(string campo, string opcion)
    {
        var reloj = Stopwatch.StartNew();
        var aqui = Donde.Leer();
        // LA PANTALLA PUEDE ESTAR LLEGANDO: tras «Guardar paciente» la lista del triage tardó en aparecer y el paso falló
        // a la primera (2026-10-02). Se la busca hasta 1,5 s antes de decir que no está.
        bool enfocada = _lector.EnfocarLista(aqui.Ventana, campo);
        for (int i = 0; i < 5 && !enfocada; i++) { Thread.Sleep(300); enfocada = _lector.EnfocarLista(aqui.Ventana, campo); }
        if (!enfocada) return _lector.PorQueNoLaLista;
        Thread.Sleep(80);
        Raton.Escribir(opcion);
        string quedo = "";
        // LO QUE CUENTA ES LO QUE LA LISTA DICE QUE TIENE: se le pregunta hasta 600 ms, que teclear no es instantáneo.
        for (int i = 0; i < 6; i++)
        {
            Thread.Sleep(100);
            quedo = _lector.ValorDeLista(aqui.Ventana, campo);
            if (Ejecutor.QuedoElegida(quedo, opcion)) break;
        }
        bool bien = Ejecutor.QuedoElegida(quedo, opcion);
        string como = "tecleando";
        if (!bien)
        {
            // POR LAS FLECHAS, LEYENDO CADA OPCIÓN. Teclear solo acierta si la opción EMPIEZA por lo tecleado: «4» no
            // elige «Triage 4 - Urgencia menor» (2026-10-02, y el plan acabó en las manos, que pulsaron «Atrás» del
            // navegador). Desde la primera, se baja de una en una hasta la que CONTIENE lo pedido; si la lista deja de
            // cambiar, se acabó y no estaba. Cada paso es una tecla y una lectura del valor: milisegundos.
            como = "por las flechas";
            Raton.Tecla("Inicio"); Thread.Sleep(60);
            string anterior = "\u0000";
            for (int i = 0; i < 80; i++)
            {
                quedo = _lector.ValorDeLista(aqui.Ventana, campo);
                if (Ejecutor.LaContiene(quedo, opcion)) { bien = true; break; }
                if (quedo == anterior) break;
                anterior = quedo;
                Raton.Tecla("Abajo"); Thread.Sleep(45);
            }
        }
        LogBus.Log("plan", $"   elegir «{opcion}» en «{campo}» ({como}): {(bien ? $"quedó elegida «{quedo}»" : $"quedó en «{quedo}»")} en {reloj.ElapsedMilliseconds} ms");
        return bien ? null : $"recorrí la lista «{campo}» y ninguna opción es ni contiene «{opcion}»; quedó en «{quedo}». Mira qué opciones tiene (map_look) y pídela con su nombre";
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
        // La carita lo desliza (spec 085, promesa 697). Después de la rueda y sin esperarla, como el aviso del pulso.
        if (Ui.LoQueUHace.AvisarDeQueDesplaza(muescas) is { } noDesliza) LogBus.Log("plan", "   el aviso de que desplacé reventó: " + noDesliza);
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
