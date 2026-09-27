import SwiftUI
import UMac

struct MemoryView: View {
    @ObservedObject var memory: DesktopMemory
    @State private var error = ""
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Lo que me has enseñado").font(.title2.weight(.semibold))
                Text("Los recuerdos se conservan al cerrar Ü. Recordar un control no significa que esté visible ahora.")
                    .font(.callout).foregroundStyle(.secondary)
                if memory.graph.knownSurfaces.allSatisfy({ memory.graph.entries(surface: $0).allSatisfy { $0.meaning == nil } }) {
                    Text("Todavía no hay recuerdos. Puedes decir: «Recuerda que este botón abre los informes».")
                        .padding(.vertical, 24)
                }
                ForEach(memory.graph.knownSurfaces, id: \.self) { surface in
                    ForEach(memory.graph.entries(surface: surface).filter { $0.meaning != nil }, id: \.selector) { entry in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(entry.element.label).font(.headline)
                            Text(entry.meaning ?? "")
                            HStack {
                                Text(surface).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                Spacer()
                                Button("Olvidar") {
                                    Task { do { try await memory.forget(surface: surface, selector: entry.selector) } catch { self.error = error.localizedDescription } }
                                }
                            }
                        }.padding(16).background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                if !error.isEmpty { Text(error).foregroundStyle(.red) }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(20)
        }.task { do { try await memory.prepare() } catch { self.error = "No se pudo cargar la memoria. El archivo original se conserva. " + error.localizedDescription } }
    }
}
