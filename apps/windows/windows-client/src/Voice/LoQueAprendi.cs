namespace U.WindowsClient.Voice;

/// <summary>
/// LO QUE SE VE CUANDO Ü APRENDE (spec 084): un cargando mientras repasa la sesión y, al terminar, la lista de lo
/// que aprendió. Esto es el ESTADO; quien lo pinta es <c>Ui.AprendiendoWindow</c>.
/// </summary>
/// <remarks>
/// EL HUECO QUE TAPA (dicho por el dueño, 2026-10-02): al apagar la voz, un modelo repasaba la sesión en segundo
/// plano y NADA en pantalla decía «esto ya quedó». Quien enseñaba no sabía si esperar, ni si había servido.
/// SIEMPRE SE CIERRA CON ALGO: si el repaso no dejó nada y en la sesión no se guardó nada, se dice «nada nuevo», que
/// es distinto de seguir cargando para siempre (patrón nº10: lo que no pasó deja rastro).
/// </remarks>
public sealed class LoQueAprendi
{
    /// <param name="Cargando">Ü está repasando: se pinta el icono de cargar.</param>
    /// <param name="Titulo">Lo que encabeza la tarjeta.</param>
    /// <param name="Lineas">Lo aprendido, una línea por cosa. Vacío mientras carga.</param>
    public sealed record Vista(bool Cargando, string Titulo, IReadOnlyList<string> Lineas);

    public const string TituloCargando = "Repasando lo que me enseñaste…";
    public const string TituloDeLaLista = "Esto aprendí";
    public const string TituloDeNada = "Nada nuevo que aprender esta vez";

    private readonly object _candado = new();
    private readonly List<string> _deLaSesion = new();
    private int _repasos;

    /// <summary>Cada cambio de lo que hay que pintar. Llega en el hilo de quien avisó: quien pinta se pasa al suyo.</summary>
    public event Action<Vista>? Cambio;

    /// <summary>Algo quedó guardado —durante la clase o en el repaso—. Fuera de un repaso se enseña en el acto.</summary>
    public void Anotar(string que)
    {
        que = (que ?? "").Trim();
        if (que.Length == 0) return;
        Vista? vista = null;
        lock (_candado)
        {
            // La misma habilidad reconstruida tres veces en una clase es UNA cosa aprendida, con su última forma.
            string clave = Clave(que);
            _deLaSesion.RemoveAll(x => Clave(x) == clave);
            _deLaSesion.Add(que);
            if (_repasos == 0) vista = new Vista(false, TituloDeLaLista, new[] { que });
        }
        if (vista != null) Cambio?.Invoke(vista);
    }

    /// <summary>Empieza un repaso: a cargar.</summary>
    public void Empieza()
    {
        lock (_candado) _repasos++;
        Cambio?.Invoke(new Vista(true, TituloCargando, Array.Empty<string>()));
    }

    /// <summary>Terminó un repaso. Si era el último en marcha, se despliega TODO lo aprendido en la sesión, y se vacía.</summary>
    public void Termina()
    {
        Vista vista;
        lock (_candado)
        {
            if (_repasos > 0) _repasos--;
            if (_repasos > 0) return;
            vista = _deLaSesion.Count > 0
                ? new Vista(false, TituloDeLaLista, _deLaSesion.ToList())
                : new Vista(false, TituloDeNada, Array.Empty<string>());
            _deLaSesion.Clear();
        }
        Cambio?.Invoke(vista);
    }

    /// <summary>Hasta los dos puntos: «Habilidad «X»: 5 pasos» y «Habilidad «X»: 7 pasos» son la misma.</summary>
    private static string Clave(string que)
    {
        int i = que.IndexOf("»", StringComparison.Ordinal);
        return (i > 0 ? que[..(i + 1)] : que).ToLowerInvariant();
    }
}
