using System.Reflection;
using Voz.Realtime;

// VUELCA EL session.start QUE MANDA LA APP: las instrucciones del delegado y su catálogo entero, para que
// la sonda de la voz mida al servidor con lo que de verdad se distribuye.
//
//   volcar-apertura <apertura.json> [<instrucciones-del-delegado.txt>]
//
// No abre ninguna conexión: solo compone, con las mismas funciones que la app, lo que la app mandaría.
if (args.Length == 0) { Console.WriteLine("Uso: volcar-apertura <apertura.json> [<instrucciones-del-delegado.txt>]"); return 1; }

var t = typeof(U.WindowsClient.Voice.ConversacionEnVivo);
const BindingFlags f = BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public;
var herramientas = (IReadOnlyList<Utensilio>)t.GetMethod("Herramientas", f)!.Invoke(null, null)!;
var p = new ProtocoloGptLive();
string instrucciones = (string)t.GetMethod("InstruccionesPara", f)!.Invoke(null, new object[] { p })!;
string apertura = p.Apertura(instrucciones, herramientas, "").Single();
System.IO.File.WriteAllText(args[0], apertura);
if (args.Length > 1) System.IO.File.WriteAllText(args[1], instrucciones);
Console.WriteLine($"{herramientas.Count} herramientas · instrucciones de {instrucciones.Length} car. · session.start de {apertura.Length} car. · "
    + $"delegado {p.Delegado}, esfuerzo {p.Esfuerzo}, {(p.ConPrioridad ? "con" : "sin")} prisa");
return 0;
