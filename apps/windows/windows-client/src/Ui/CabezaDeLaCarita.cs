using System;

namespace U.WindowsClient.Ui;

/// <summary>
/// Dónde cae cada rasgo cuando la carita gira la cabeza (spec 052, promesa 441).
///
/// Hasta el 2026-09-30 mirar a un lado era <c>EyeShift</c>: los dos ojos se corrían 3,5 unidades,
/// iguales, y cejas y boca se quedaban quietas. El dueño: «solo mira con los ojos hacia los lados,
/// quiero que se sienta que gira un poco la cabeza».
///
/// Lo que hace Coucou (<c>mochi/engine.ts</c>, <c>drawEyes</c>) y que aquí se copia como técnica, no
/// como dibujo: los rasgos no se DESPLAZAN, se PROYECTAN. Viven en una superficie curva de radio
/// <see cref="Radio"/>; girar suma un ángulo, el seno dice dónde cae el rasgo y el coseno cuánto se
/// estrecha. El ojo que se acerca al borde se aplana, los dos se juntan porque se ven de lado, y el
/// que viene hacia el frente se ensancha un poco. Eso, y nada más, es la ilusión de la cabeza.
///
/// Pura a propósito: la geometría se juzga sin pantalla, y <c>FaceControl</c> solo la usa.
/// </summary>
public static class CabezaDeLaCarita
{
    /// <summary>
    /// Radio de la superficie, en unidades del viewBox (la cara llega a ±74). Algo menor que la cara:
    /// con uno mayor los rasgos apenas se estrechan; con uno menor, las cejas (a ±40) se aplastarían
    /// contra el borde antes de llegar al giro máximo.
    /// </summary>
    public const double Radio = 70;

    /// <summary>
    /// Ángulo del giro máximo (giro = ±1), en radianes. 0,5 ≈ 29°: «ligeramente 3D», que es lo que se
    /// pidió. Con 0,55 la ceja exterior pasaba de ±66 y se comía el borde.
    /// </summary>
    public const double AnguloMaximo = 0.5;

    /// <summary>
    /// Proyecta el rasgo que sin giro está en <paramref name="x"/> (unidades del viewBox, 0 = centro)
    /// para un <paramref name="giro"/> entre −1 (izquierda) y 1 (derecha). Devuelve dónde cae y su
    /// escala horizontal respecto a la de frente (1 = sin cambio).
    /// </summary>
    public static (double X, double Escala) Proyectar(double x, double giro)
    {
        double g = Math.Clamp(giro, -1, 1) * AnguloMaximo;
        double a0 = Math.Asin(Math.Clamp(x / Radio, -1, 1));
        if (g == 0) return (x, 1);   // exactamente donde siempre, sin el ruido de ida y vuelta del seno
        double a = a0 + g;
        return (Radio * Math.Sin(a), Math.Cos(a) / Math.Cos(a0));
    }
}
