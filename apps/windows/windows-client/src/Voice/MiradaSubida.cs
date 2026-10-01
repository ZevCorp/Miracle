using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

namespace U.WindowsClient.Voice;

/// <summary>
/// LAS MIRADAS DE UNA CONVERSACIÓN: se suben, se miran, y se retiran todas al cerrarla. Promesa 250 (spec 027).
/// </summary>
/// <remarks>
/// LA COPIA DURA LO QUE DURA LA CONVERSACIÓN QUE PUEDE LEERLA, y eso sigue cumpliendo la condición del
/// dueño dicha en mayúsculas: «QUE NO DUREN MUCHO TIEMPO EN OPENAI» (2026-09-16) — duran una llamada,
/// no días. Lo que se queda es la foto LOCAL, en el álbum de Ü; lo que viaja es una copia efímera.
///
/// NO SE BORRA AL RATO, Y ESTO SE APRENDIÓ ROMPIÉNDOLO. La primera versión solía una espera de ocho
/// segundos y borraba. Medido en la app el 2026-09-16: subida a las 20:26:55, borrada a las 20:27:03, y el
/// servidor contestando «Files [file-XPZ…] were not found» a las 20:27:04, 20:27:10 y 20:27:28. Con ningún
/// temporizador habría funcionado: la REFERENCIA se queda en el historial de la sesión, así que cualquier
/// respuesta posterior vuelve a pedir el archivo. Mientras la sesión viva, la copia tiene que estar.
///
/// Y POR ESO SE GUARDAN TODAS: mirar dos veces deja dos referencias vivas en el historial, y quedarse solo
/// con la última dejaba la primera colgada para siempre en la cuenta —basura— o borrada en falso.
///
/// POR QUÉ SUBIR Y NO INCRUSTAR: el buzón de la sesión admite 32.768 bytes para la conversación
/// entera y una captura pesa 118.000 codificada, así que dentro del mensaje no cabía ninguna — de ahí
/// venía que Ü fuera ciega. Subida aparte, en la sesión solo entra su identificador, unos treinta
/// bytes, y mirar deja de tener tope.
///
/// SE SUELTA PASE LO QUE PASE, salga bien la mirada o falle: un fallo no puede dejar basura en la
/// cuenta de nadie. Soltar dos veces no borra dos veces, y soltar sin haber subido no llama a nada.
/// </remarks>
public sealed class MiradaSubida
{
    private readonly Func<byte[], Task<string>> _subir;
    private readonly Func<string, Task<bool>> _borrar;
    private readonly CopiasPorBorrar? _apuntes;
    private readonly List<string> _subidas = new();

    /// <param name="subir">Deja la foto en OpenAI y devuelve su identificador.</param>
    /// <param name="borrar">Borra esa copia.</param>
    public MiradaSubida(Func<byte[], Task<string>> subir, Func<string, Task> borrar)
    {
        _subir = subir;
        _borrar = async id => { await borrar(id); return true; };
    }

    /// <summary>
    /// Con apuntes en disco (spec 079, promesa 785): cada copia queda apuntada desde que se sube hasta que
    /// <paramref name="borrar"/> contesta que ya no está. Lo que quede apuntado se reintenta más tarde.
    /// </summary>
    public MiradaSubida(Func<byte[], Task<string>> subir, Func<string, Task<bool>> borrar, CopiasPorBorrar apuntes)
    {
        _subir = subir;
        _borrar = borrar;
        _apuntes = apuntes;
    }

    /// <summary>La que habla con OpenAI de verdad.</summary>
    public static MiradaSubida Real(Func<string> clave, Action<string>? anotar = null)
        => new(jpeg => SubirAOpenAI(jpeg, clave(), anotar), id => BorrarDeOpenAI(id, clave(), anotar), new CopiasPorBorrar());

    /// <summary>
    /// Vuelve a intentar borrar lo que quedó apuntado de otras veces: un borrado que falló por la red, o una app
    /// que se cerró con la sesión abierta. Devuelve cuántas se borraron.
    /// </summary>
    /// <remarks>
    /// LO QUE ESTÁ EN USO NO SE TOCA: una copia de una conversación que sigue abierta en este proceso —puede haber
    /// más de un asistente— todavía la puede pedir el servidor. Esa se borra cuando su conversación cierre.
    /// </remarks>
    public static Task<int> ReintentarLoPendienteAsync(Func<string> clave, Action<string>? anotar = null)
        => new CopiasPorBorrar().ReintentarAsync(id =>
        {
            lock (EnUso) if (EnUso.Contains(id)) return Task.FromResult(false);
            return BorrarDeOpenAI(id, clave(), anotar);
        });

    /// <summary>Las copias de las conversaciones abiertas en este proceso.</summary>
    private static readonly HashSet<string> EnUso = new(StringComparer.Ordinal);

    /// <summary>Sube la foto y devuelve con qué referirse a ella. Vacío si no se pudo.</summary>
    public async Task<string> SubirAsync(byte[] jpeg)
    {
        if (jpeg == null || jpeg.Length == 0) return "";
        string id = await _subir(jpeg);
        // La anterior NO se toca: su referencia sigue viva en el historial de la sesión.
        if (id.Length > 0)
        {
            lock (_subidas) _subidas.Add(id);
            lock (EnUso) EnUso.Add(id);
            _apuntes?.Apuntar(id);   // desde YA: si la app se cae con la sesión abierta, se sabe qué hay allí
        }
        return id;
    }

    /// <summary>
    /// Retira TODAS las copias de esta conversación. Se llama al cerrarla, que es cuando ya nadie puede
    /// leerlas. Sin nada subido no hace nada; dos veces tampoco.
    /// </summary>
    public async Task SoltarAsync()
    {
        string[] pendientes;
        lock (_subidas) { pendientes = _subidas.ToArray(); _subidas.Clear(); }
        foreach (string id in pendientes)
        {
            lock (EnUso) EnUso.Remove(id);                 // su conversación cerró: ya nadie puede pedirla
            if (await _borrar(id)) _apuntes?.Quitar(id);   // la que no se pudo borrar sigue apuntada (785)
        }
    }

    private static readonly HttpClient Red = new() { Timeout = TimeSpan.FromSeconds(30) };

    private static async Task<string> SubirAOpenAI(byte[] jpeg, string clave, Action<string>? anotar)
    {
        try
        {
            using var cuerpo = new MultipartFormDataContent();
            cuerpo.Add(new StringContent("vision"), "purpose");
            var foto = new ByteArrayContent(jpeg);
            foto.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            cuerpo.Add(foto, "file", "pantalla.jpg");

            using var peticion = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/files") { Content = cuerpo };
            peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", clave);
            using var r = await Red.SendAsync(peticion);
            string texto = await r.Content.ReadAsStringAsync();
            if (!r.IsSuccessStatusCode) { anotar?.Invoke($"no pude subir la mirada: {(int)r.StatusCode} {Corto(texto)}"); return ""; }

            string id = JsonDocument.Parse(texto).RootElement.TryGetProperty("id", out var i) ? i.GetString() ?? "" : "";
            anotar?.Invoke($"mirada subida: {jpeg.Length} bytes → {id}");
            return id;
        }
        catch (Exception e) { anotar?.Invoke($"no pude subir la mirada: {e.Message}"); return ""; }
    }

    /// <summary>Si la copia ya no está en OpenAI: porque se borró ahora, o porque ya no existía (404).</summary>
    private static async Task<bool> BorrarDeOpenAI(string id, string clave, Action<string>? anotar)
    {
        try
        {
            using var peticion = new HttpRequestMessage(HttpMethod.Delete, $"https://api.openai.com/v1/files/{id}");
            peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", clave);
            using var r = await Red.SendAsync(peticion);
            bool yaNoExistia = r.StatusCode == System.Net.HttpStatusCode.NotFound;
            anotar?.Invoke(r.IsSuccessStatusCode ? $"mirada borrada de OpenAI: {id}"
                : yaNoExistia ? $"la mirada {id} ya no estaba en OpenAI"
                : $"no pude borrar la mirada {id}: {(int)r.StatusCode}. Queda apuntada para reintentarlo");
            return r.IsSuccessStatusCode || yaNoExistia;
        }
        catch (Exception e) { anotar?.Invoke($"no pude borrar la mirada {id}: {e.Message}. Queda apuntada para reintentarlo"); return false; }
    }

    private static string Corto(string t) => t.Length <= 160 ? t : t[..160];
}
