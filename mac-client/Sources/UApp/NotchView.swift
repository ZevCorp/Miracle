import SwiftUI

struct NotchView: View {
    @ObservedObject var model: AppModel
    private var symbol: String {
        switch model.mode {
        case .ready: return "sparkle"
        case .listening: return "mic"
        case .working: return "cursorarrow"
        case .speaking: return "waveform"
        case .question: return "questionmark.circle"
        case .error: return "exclamationmark.circle"
        case .stopped: return "stop.circle"
        }
    }
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button { model.setNotchExpanded(!model.notchExpanded) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: symbol).font(.system(size: 19, weight: .medium)).frame(width: 24)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(model.presentation.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                            Text(model.wakeListening && !model.microphone ? model.wakeStatus : model.status).font(.system(size: 11)).foregroundStyle(.white.opacity(0.72)).lineLimit(1)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    }.contentShape(Rectangle())
                }.accessibilityLabel(model.notchExpanded ? "Cerrar chat del notch" : "Abrir chat del notch")
                Button { model.toggleLiveFromFace() } label: {
                    Image(systemName: model.microphone ? "mic.fill" : "mic.slash")
                }.accessibilityLabel(model.microphone ? "Cerrar conversación de voz" : "Hablar con Live 1")
                Button { model.stop() } label: { Image(systemName: "stop.fill") }
                    .disabled(!model.busy && !model.microphone).accessibilityLabel("Detener tarea")
            }.padding(.horizontal, 16).frame(height: 66)
            if model.notchExpanded {
                Divider().overlay(.white.opacity(0.15))
                ConversationView(model: model, monochrome: true)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                HStack {
                    Button("Memoria") { model.selectedTab = 2; model.showWindow?() }
                    Spacer()
                    Button("Configuración") { model.selectedTab = 1; model.showWindow?() }
                    Button("Cerrar chat") { model.setNotchExpanded(false) }
                }.font(.caption).padding(.horizontal, 16).padding(.bottom, 12)
            }
        }
        .buttonStyle(.plain).foregroundStyle(.white)
        .background(.black, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.14), lineWidth: 0.5))
        .environment(\.colorScheme, .dark)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Ü: tarea, conversación y controles")
    }
}
