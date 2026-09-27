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
        HStack(spacing: 12) {
            Image(systemName: symbol).font(.system(size: 19, weight: .medium)).frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(model.presentation.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                Text(model.status).font(.system(size: 11)).foregroundStyle(.white.opacity(0.72)).lineLimit(1)
            }.frame(maxWidth: .infinity, alignment: .leading)
            Button { model.toggleMicrophone() } label: {
                Image(systemName: model.microphone ? "mic.fill" : "mic.slash")
            }.help(model.microphone ? "Silenciar" : "Hablar")
            Button { model.stop() } label: { Image(systemName: "stop.fill") }
                .disabled(!model.busy && !model.microphone).help("Detener")
        }
        .buttonStyle(.plain).foregroundStyle(.white)
        .padding(.horizontal, 16).padding(.vertical, 13)
        .background(.black, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.14), lineWidth: 0.5))
        .contentShape(Rectangle()).onTapGesture { model.showWindow?() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Ü: tarea y paso actual")
    }
}
