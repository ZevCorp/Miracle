import SwiftUI
import UMac

/// One conversation model in both the main window and expanded notch.
struct ConversationView: View {
    @ObservedObject var model: AppModel
    var monochrome = false
    var body: some View {
        VStack(spacing: 0) {
            if model.messages.isEmpty && monochrome {
                VStack(spacing: 8) {
                    Text("¿Qué hacemos?").font(.headline)
                    Text("Escribe aquí o toca la carita para hablar.").font(.caption).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.messages.isEmpty {
                VStack(spacing: 14) {
                    Image(systemName: "waveform.circle").font(.system(size: 48, weight: .ultraLight)).foregroundStyle(monochrome ? Color.white : Color.purple)
                    Text("¿Qué hacemos?").font(.title2.weight(.medium))
                    Text("Abre una aplicación, busca algo en el navegador o trabaja con lo que tienes en pantalla.")
                        .multilineTextAlignment(.center).foregroundStyle(.secondary).padding(.horizontal, 35)
                    Text("Toca la carita para hablar con Live 1. Vuelve a tocarla para cerrar la conversación.")
                        .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ConversationTranscript(entries: model.messages.map {
                    ChatTranscriptEntry(id: $0.id, text: $0.text, user: $0.user)
                }, monochrome: monochrome)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            VStack(alignment: .leading, spacing: 10) {
                if model.busy { HStack { ProgressView().controlSize(.small); Text(model.status).font(.caption).lineLimit(2) } }
                if !model.partial.isEmpty { Text(model.partial).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
                HStack(spacing: 10) {
                    Button { model.toggleLiveFromFace() } label: { Image(systemName: model.microphone ? "mic.fill" : "mic").foregroundStyle(model.microphone ? (monochrome ? Color.white : Color.purple) : Color.secondary).frame(width: 24, height: 24) }.help("Hablar / silenciar")
                    TextField(model.mode == .question ? "Tu respuesta…" : "Pídele algo a Ü…", text: $model.draft).textFieldStyle(.plain).onSubmit { model.submitDraft() }
                    Button { model.submitDraft() } label: { Image(systemName: "arrow.up.circle.fill").font(.title2).foregroundStyle(monochrome ? Color.white : Color.purple) }.buttonStyle(.plain).disabled(model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }.padding(12).background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                Text("Esc detiene la tarea · La carita sigue disponible al cerrar esta ventana")
                    .font(.system(size: 10)).foregroundStyle(.secondary)
            }.padding(16)
        }
    }
}


private struct ConversationTranscript: NSViewRepresentable {
    let entries: [ChatTranscriptEntry]
    let monochrome: Bool
    func makeNSView(context: Context) -> ChatTranscriptView { ChatTranscriptView(frame: .zero) }
    func updateNSView(_ view: ChatTranscriptView, context: Context) {
        view.update(entries: entries, monochrome: monochrome)
    }
}
