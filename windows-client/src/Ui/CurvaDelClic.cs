using System.Windows.Media.Animation;

namespace U.WindowsClient.Ui;

/// <summary>
/// La curva del viaje al clic, envuelta para WPF. Era la promesa 240 (spec 022), retirada en la 054: se queda para
/// cuando la carita vuelva a viajar.
/// </summary>
/// <remarks>
/// Envoltorio y no una copia: la curva se juzgaba en el contrato sobre
/// <see cref="U.Graph.Surfaces.ComoViajaLaCarita.Curva"/>, así que si aquí se escribiera otra vez la
/// misma fórmula, el día que una cambie la promesa seguiría verde sobre la que nadie usa. Un solo
/// sitio donde vive la forma del movimiento.
/// </remarks>
public sealed class CurvaDelClic : IEasingFunction
{
    public double Ease(double t) => U.Graph.Surfaces.ComoViajaLaCarita.Curva(t);
}
