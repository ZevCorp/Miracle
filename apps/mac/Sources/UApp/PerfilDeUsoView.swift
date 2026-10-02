import SwiftUI
import UCore

/// LA BIENVENIDA QUE PREGUNTA CON QUIÉN HABLA Ü (spec 001, 2026-10-01): «Trabajo en salud» o «Uso personal», y la
/// especialidad si es salud. La misma vista sirve para la primera vez y para cambiarlo después («Cómo me usas»,
/// en el menú de Ü y en Configuración).
///
/// Es el comportamiento de la bienvenida de Windows (`OnboardingWindow`), reescrito: las mismas dos tarjetas y la
/// misma promesa de que se puede cambiar. Lo que no copia: aquí la especialidad sale solo del catálogo (no se
/// escribe a mano), y no pide nombre ni correo, porque el Mac no tiene cuenta Miracle.
///
/// Se puede aplazar («Ahora no»): sin elegir, Ü es la de antes, y la pregunta vuelve al abrir la app.
struct PerfilDeUsoView: View {
    @ObservedObject var model: AppModel
    @State private var tipo = ""
    @State private var especialidad = ""
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(model.perfil.elegido ? "Cómo me usas" : "¡Hola! Soy Ü").font(.title2.weight(.semibold))
                Text(model.perfil.elegido ? "Cámbialo cuando quieras: me ajusto desde la próxima tarea." : "Antes de empezar, cuéntame para qué me vas a usar y te hablo como te sirve.")
                    .foregroundStyle(.secondary)
                Text("¿Para qué me vas a usar?").font(.headline).padding(.top, 6)
                opcion("Trabajo en salud", detalle: "Soy médico u otro profesional de la salud: consultas, historias clínicas.", valor: PerfilDeUso.medico)
                opcion("Uso personal", detalle: "Para mi día a día: archivos, internet, correos, documentos y lo que se me ocurra.", valor: PerfilDeUso.persona)
                if tipo == PerfilDeUso.medico {
                    Picker("Tu especialidad", selection: $especialidad) {
                        Text("Otra, o prefiero no decirla").tag("")
                        ForEach(Especialidades.todas, id: \.codigo) { item in
                            Text(item.nombre).tag(item.codigo)
                        }
                    }
                }
                HStack {
                    Button(model.perfil.elegido ? "Cancelar" : "Ahora no") { model.eligiendoPerfil = false }
                    Spacer()
                    Button(model.perfil.elegido ? "Guardar" : "Empezar") { model.elegirPerfil(tipo: tipo, especialidad: especialidad) }
                        .keyboardShortcut(.defaultAction)
                        .disabled(tipo.isEmpty)
                }.padding(.top, 6)
                Text("Lo puedes cambiar cuando quieras en «Cómo me usas…», en el menú de Ü, o en Configuración.")
                    .font(.caption).foregroundStyle(.secondary)
            }.padding(24)
        }
        .onAppear {
            tipo = model.perfil.tipo
            especialidad = model.perfil.especialidad
        }
    }
    private func opcion(_ titulo: String, detalle: String, valor: String) -> some View {
        Button { tipo = valor } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: tipo == valor ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(tipo == valor ? Color.purple : Color.secondary).padding(.top, 2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(titulo).font(.body.weight(.medium))
                    Text(detalle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(12)
            .contentShape(Rectangle())
            .background(Color.secondary.opacity(tipo == valor ? 0.14 : 0.06), in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}
