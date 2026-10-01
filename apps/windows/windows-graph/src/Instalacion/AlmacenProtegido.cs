using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace U.Graph;

/// <summary>
/// DÓNDE DUERME LA CREDENCIAL DE LA INSTALACIÓN: un archivo cifrado para ESTE usuario de Windows.
/// Promesa 682 (spec 076).
/// </summary>
/// <remarks>
/// POR QUÉ NO EN <c>graph.json</c>, QUE YA EXISTE. Ese archivo es JSON en claro en %APPDATA%, y la
/// credencial es lo único que distingue a esta instalación de cualquiera que tenga el instalador —que
/// es público—. En claro, la copia quien abra la carpeta o quien reciba un zip «con mis ajustes».
///
/// QUÉ PROTEGE DPAPI Y QUÉ NO. El archivo solo lo abre el mismo usuario de Windows en la misma
/// máquina: copiado a otro equipo no sirve. No protege de un programa que corra COMO ese usuario; para
/// eso está revocar la instalación en el panel, que es de una en una.
///
/// UN ARCHIVO ROTO ES «NO HAY CREDENCIAL», no una excepción: la instalación se presenta de nuevo. Lo
/// contrario dejaría a Ü sin arrancar por un corte de luz a mitad de una escritura.
/// </remarks>
public sealed class AlmacenProtegido
{
    // No es un secreto: ata el cifrado a este uso, para que otro blob DPAPI del mismo usuario no pase
    // por una credencial de Ü.
    private static readonly byte[] Sal = Encoding.UTF8.GetBytes("U.Graph.CredencialDeInstalacion/v1");

    private readonly string _ruta;

    public AlmacenProtegido(string ruta) => _ruta = ruta ?? throw new ArgumentNullException(nameof(ruta));

    /// <summary>Lo guardado, en claro, o null si no hay nada o no se puede abrir.</summary>
    public string? Leer()
    {
        try
        {
            if (!File.Exists(_ruta)) return null;
            byte[] claro = ProtectedData.Unprotect(File.ReadAllBytes(_ruta), Sal, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(claro);
        }
        catch (Exception e) when (e is CryptographicException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    /// <summary>Guarda lo que se le dé; null o vacío borra el archivo.</summary>
    public void Guardar(string? contenido)
    {
        if (string.IsNullOrEmpty(contenido))
        {
            if (File.Exists(_ruta)) File.Delete(_ruta);
            return;
        }
        Directory.CreateDirectory(Path.GetDirectoryName(_ruta)!);
        byte[] cifrado = ProtectedData.Protect(Encoding.UTF8.GetBytes(contenido), Sal, DataProtectionScope.CurrentUser);
        // A un temporal y se mueve: un corte a mitad deja el archivo anterior entero, no medio escrito.
        string temporal = _ruta + ".tmp";
        File.WriteAllBytes(temporal, cifrado);
        File.Move(temporal, _ruta, overwrite: true);
    }
}
