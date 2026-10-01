using System.IO;
using System.Text.Json;

namespace U.WindowsClient;

/// <summary>
/// Configuración del cliente: dónde está el cerebro (Graph), quién es la persona y cómo usa Ü (spec
/// 078), y sus preferencias. La credencial de Graph no vive aquí sino en graph.json (GraphConfig): el
/// token del backend viejo que había aquí se fue con él (2026-10-01). Ninguna key de modelo, ningún
/// prompt, ningún parámetro del cerebro vive aquí — todo
/// eso es del servidor, incluida la key de Gemini que usa la enseñanza por video (🎓): el backend
/// firma las subidas y hace las llamadas al modelo, así el usuario no configura nada y no hay ninguna
/// key que extraer del .exe. Se persiste en %APPDATA%\U\config.json.
/// </summary>
public sealed class Config
{
    /// <summary>
    /// El cerebro: Graph, el backend central, que expone el turno y la enseñanza bajo /api/v1 con la
    /// X-API-Key de <c>graph.json</c> (ver <see cref="Backend.BackendClient"/>).
    /// </summary>
    public const string GraphPorDefecto = "https://graph-eight-pied.vercel.app";

    /// <summary>
    /// La URL del backend viejo (u-windows-backend), que se RETIRA con la spec 078 (2026-10-01): su
    /// despliegue llevaba muerto desde septiembre y nada del cliente lo necesitaba. Queda la
    /// constante solo para la migración de <see cref="Load"/>: un config.json que todavía la traiga
    /// vuelve a Graph.
    /// </summary>
    public const string LegacyBackendUrl = "https://u-windows-backend.vercel.app";

    /// <summary>El feed viejo, en el bucket de Supabase. Ver la migración en <see cref="Load"/>.</summary>
    public const string LegacyUpdateFeedUrl =
        "https://zyvfamlhlmztliexvmej.supabase.co/storage/v1/object/public/windows";

    /// <summary>
    /// A qué Graph se habla, tal como se GUARDA en config.json. Lo que usa esta ejecución es
    /// <see cref="BackendUrlEnUso"/>: la variable de entorno U_BACKEND_URL lo pisa solo para este
    /// proceso (<c>scripts/dev-local.ps1</c> la usa para hablar con un Graph local).
    /// </summary>
    public string BackendUrl { get; set; } = GraphPorDefecto;

    /// <summary>U_BACKEND_URL de este proceso, si la hay. Campo y no propiedad: no se guarda nunca.</summary>
    private string? _backendDelEntorno;

    /// <summary>
    /// La URL con la que habla ESTA ejecución: U_BACKEND_URL si está puesta, y si no la de disco.
    /// </summary>
    /// <remarks>
    /// APARTE DE <see cref="BackendUrl"/> A PROPÓSITO (promesa 708). Antes la variable pisaba
    /// <see cref="BackendUrl"/> en memoria y el siguiente <see cref="Save"/> —la posición de la carita
    /// se guarda con un temporizador— la escribía en disco: después de un <c>dev-local.ps1</c>, la Ü
    /// de todos los días se quedaba apuntando a localhost para siempre.
    /// </remarks>
    [System.Text.Json.Serialization.JsonIgnore]
    public string BackendUrlEnUso =>
        string.IsNullOrWhiteSpace(_backendDelEntorno) ? BackendUrl : _backendDelEntorno;

    public string UserId { get; set; } = "anon";

    /// <summary>
    /// Identidad del usuario capturada al instalar (popup de nombre+correo, ver
    /// <see cref="Ui.OnboardingWindow"/>). El CORREO es la clave canónica en el backend
    /// ("Windows Live"): mismo correo = mismo usuario. <see cref="UserId"/> se fija al correo
    /// para que el scoping de workflows y la telemetría hablen de la misma persona.
    /// </summary>
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";

    /// <summary>
    /// Quién usa Ü en este equipo: <c>""</c> (todavía no lo dijo) · <c>"medico"</c> · <c>"persona"</c>
    /// (spec 078). TEXTO y no enum: config.json lo leen personas, y un enum se guardaría como número.
    /// Se lee siempre a través de <see cref="Cuenta.PerfilDeUso.Normalizar"/>, y quien decide el
    /// perfil de la sesión es <see cref="Cuenta.PerfilDeUso.Resolver"/>: si hay médico con su cuenta
    /// Miracle dentro, manda la cuenta.
    /// </summary>
    public string Perfil { get; set; } = "";

    /// <summary>
    /// La especialidad elegida en este equipo, en el formato de <c>profiles.specialty_code</c>
    /// («cardiologia», «medicina-general»). Solo significa algo con <see cref="Perfil"/> = médico.
    /// </summary>
    public string Especialidad { get; set; } = "";

    /// <summary>Su nombre legible («Cardiología»), o lo que se escribió si no está en el catálogo.</summary>
    public string EspecialidadNombre { get; set; } = "";

    /// <summary>
    /// Identificador estable de ESTA instalación (GUID, se genera una sola vez). Un usuario (correo)
    /// puede tener varias instalaciones; esto las distingue sin romper la identidad por correo.
    /// </summary>
    public string InstallId { get; set; } = "";

    /// <summary>¿Ya se capturó nombre+correo? Evita re-preguntar en cada arranque.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public bool Onboarded => !string.IsNullOrWhiteSpace(Email);

    /// <summary>
    /// Si Ü ya se presentó en voz alta en este equipo. Se marca ANTES de hablar, no después: ver
    /// <c>FaceWindow.OfrecerElPrimerEncuentro</c>.
    /// </summary>
    public bool PresentacionHecha { get; set; }

    /// <summary>
    /// Asistente mudo (botón 🔇 de la carita). Se persiste a propósito: quien lo silencia suele estar
    /// en una consulta o una reunión, y que volviera a hablar solo por reiniciar Ü sería justo el
    /// problema que el botón viene a resolver.
    /// </summary>
    public bool Muted { get; set; }


    /// <summary>
    /// Tema de la carita (claro/oscuro), que se alterna manteniéndola oprimida. Se persiste para que
    /// arranque en el modo que el usuario dejó. Valores: "Light" o "Dark" (ver <see cref="Ui.FaceTheme"/>).
    /// </summary>
    public string FaceTheme { get; set; } = "Light";

    /// <summary>
    /// Dónde dejó el usuario la barra. Se persiste porque el operador la aparta de la barra de
    /// herramientas de SAP una vez, y sin esto tendría que volver a apartarla en cada arranque.
    ///
    /// <c>double?</c> y no <c>double</c>: <c>null</c> significa «nunca la movió» y hay que poder
    /// distinguirlo de <c>0,0</c>, que es la esquina superior izquierda y una posición legítima.
    /// </summary>
    public double? WindowLeft { get; set; }
    public double? WindowTop { get; set; }

    /// <summary>
    /// El área de trabajo en la que se guardó esa posición. Sin esto, un portátil que pasa de su
    /// pantalla a un proyector de menos resolución restaura la carita fuera de la pantalla, donde no
    /// se puede ni agarrar. Si no coincide, se descarta la posición y se vuelve al sitio por defecto.
    /// </summary>
    public double? SavedWorkAreaWidth { get; set; }
    public double? SavedWorkAreaHeight { get; set; }

    /// <summary>
    /// En qué borde de la pantalla vive el panel: «derecha» o «izquierda» (promesa 629). Lo cambia el
    /// botón de lado del propio panel. Se guarda como texto y lo lee
    /// <c>Ui.ReglaDelMuelle.LadoDe</c>, que da la derecha ante cualquier valor que no entienda.
    /// </summary>
    public string LadoDelMuelle { get; set; } = "derecha";

    /// <summary>
    /// De dónde baja la carita sus propias actualizaciones (ver <see cref="Update.Updater"/> y
    /// RELEASING-WINDOWS.md). Son las *releases* de este repositorio.
    ///
    /// ANTES ERA EL BUCKET PÚBLICO DE SUPABASE, y se cambió porque no podía funcionar: el plan
    /// gratuito corta las subidas en 50 MB —tope global, que manda sobre el 1 GB configurado en el
    /// bucket— y el paquete pesa 80. El .nupkg no llegó a subir ni una sola vez en siete intentos
    /// desde el 2026-07-22, así que el botón de actualizar solo podía contestar «ya estás al día»:
    /// no mentía, es que al otro lado no había nada que encontrar (2026-08-16).
    ///
    /// El repositorio es público desde el monorepo, así que se lee sin credenciales; el build de
    /// distribución lleva además un token de solo lectura (WindowsClient.csproj → UpdateGithubToken)
    /// que le da 5000 consultas por hora en vez de las 60 por IP de quien pregunta sin identificarse.
    ///
    /// Sigue admitiendo una URL de carpeta estática: cualquier valor que no apunte a github.com se
    /// trata como antes.
    /// </summary>
    public string UpdateFeedUrl { get; set; } = Update.Updater.RepoDeHoy;

    private static string Path =>
        System.IO.Path.Combine(U.Graph.UserPaths.Roaming, "U", "config.json");

    /// <summary>Dónde vive este archivo, para quien tenga que contarlo sin cargarlo (la Memoria, spec 071).</summary>
    public static string Archivo => Path;

    public static Config Load()
    {
        Config cfg;
        try
        {
            cfg = File.Exists(Path)
                ? JsonSerializer.Deserialize<Config>(File.ReadAllText(Path)) ?? new Config()
                : new Config();
        }
        catch
        {
            cfg = new Config();
        }

        // Migración silenciosa a Graph: los config.json guardados antes del cambio traen el backend
        // viejo persistido, y sin esto ninguna instalación existente se movería sola. Un localhost
        // guardado también vuelve: nunca lo puso nadie a mano, era la U_BACKEND_URL de un
        // dev-local.ps1 que se colaba en disco (promesa 708). Una URL puesta a mano se respeta.
        if (EsBackendQueNoSeGuarda(cfg.BackendUrl))
            cfg.BackendUrl = GraphPorDefecto;

        // Lo mismo con el feed de actualizaciones, y por una razón peor: el bucket de Supabase al
        // que apuntaban las instalaciones viejas NO PUEDE alojar el paquete —tope de 50 MB del plan
        // gratuito contra 80 MB del .nupkg—, así que sin esto se quedarían preguntando para siempre
        // a un sitio donde nunca va a haber nada. Igual que arriba, solo se migra el default exacto:
        // si alguien apuntó su propio feed a mano, se respeta.
        //
        // Y CON EL NOMBRE DEL REPOSITORIO (2026-10-01): pasó de «U-Windows-App» a «Miracle». GitHub
        // redirige el viejo, pero .NET descarta el token al seguir la redirección, y sin él el cupo es
        // de 60 consultas por hora por IP — la de un hospital entero. Lo guardado se pone al día.
        string guardado = cfg.UpdateFeedUrl?.Trim().TrimEnd('/') ?? "";
        if (guardado.Equals(LegacyUpdateFeedUrl, StringComparison.OrdinalIgnoreCase)
            || Update.Updater.NombresAnteriores.Any(n => n.Equals(guardado, StringComparison.OrdinalIgnoreCase)))
            cfg.UpdateFeedUrl = Update.Updater.RepoDeHoy;

        // `set U_BACKEND_URL=<url>` (dev-local.ps1: un Graph local) manda en ESTE proceso y no se
        // escribe nunca en disco: vive en un campo aparte que Save no ve (promesa 708).
        string? fromEnv = Environment.GetEnvironmentVariable("U_BACKEND_URL");
        cfg._backendDelEntorno = string.IsNullOrWhiteSpace(fromEnv) ? null : fromEnv.Trim();

        return cfg;
    }

    /// <summary>
    /// ¿Es una URL que no tiene que quedar guardada? El backend viejo (borrado) y cualquier
    /// localhost: los dos solo llegaban a disco por la variable de entorno.
    /// </summary>
    private static bool EsBackendQueNoSeGuarda(string? url)
    {
        string u = (url ?? "").Trim().TrimEnd('/');
        if (u.Length == 0) return true;
        if (string.Equals(u, LegacyBackendUrl, StringComparison.OrdinalIgnoreCase)) return true;
        if (!Uri.TryCreate(u, UriKind.Absolute, out var uri)) return false;
        return uri.IsLoopback
            || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase);
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Path)!);
            File.WriteAllText(Path, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch { }
    }
}
