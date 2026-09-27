import SwiftUI
import AppKit
import AVFoundation
import Speech
import UMac
import UCore

struct Face: View {
    @ObservedObject var model: AppModel
    @AppStorage("faceDark") private var dark = false
    @State private var blink = false
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 16, paused: !model.liveConnected && model.mode != .speaking)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            let halo = VoiceHalo(active: model.liveConnected, level: model.voiceLevel, time: time)
            ZStack {
                Circle().fill(Color(red: 168 / 255, green: 168 / 255, blue: 174 / 255))
                    .frame(width: halo.diameter, height: halo.diameter).opacity(halo.opacity)
                    .allowsHitTesting(false)
                FaceArtwork(mode: model.mode, dark: dark, blink: blink, eyeShift: model.faceEyeShift,
                            mouthOpen: model.mode == .speaking ? min(1, pow(model.voiceLevel, 0.55) * 2) : 0,
                            mouthRound: (sin(time * 3.7) + 1) / 2)
                    .frame(width: VoiceHalo.faceSize, height: VoiceHalo.faceSize)
            }.frame(width: VoiceHalo.panelSize, height: VoiceHalo.panelSize)
        }
        .contentShape(Rectangle())
        .task {
            do {
                while !Task.isCancelled {
                    try await Task.sleep(for: .seconds(Double.random(in: 8...18)))
                    blink = true
                    try await Task.sleep(for: .milliseconds(110))
                    blink = false
                }
            } catch { blink = false }
        }
        .onTapGesture { model.toggleLiveFromFace() }
        .contextMenu {
            Button(model.microphone ? "Cerrar conversación" : "Hablar con Live 1") { model.toggleLiveFromFace() }
            Button("Abrir chat del notch") { model.setNotchExpanded(true) }
            Button("Detener tarea") { model.stop() }
            Toggle("Carita oscura", isOn: $dark)
            Button("Configuración") { model.selectedTab = 1; model.showWindow?() }
            Divider()
            Button("Salir de Ü") { NSApp.terminate(nil) }
        }
        .help("\(model.mode.rawValue): \(model.status)")
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Ü, \(model.microphone ? "cerrar conversación" : "hablar con Live 1"), \(model.mode.rawValue)")
        .accessibilityAction { model.toggleLiveFromFace() }
        .accessibilityAddTraits(.isButton)
    }
}

struct MainView: View {
    @ObservedObject var model: AppModel
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("Ü").font(.system(size: 30, weight: .semibold, design: .rounded)).foregroundStyle(.purple)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Tu asistente en Mac").font(.headline)
                    Text(model.mode.rawValue).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button { model.stop() } label: { Label("Detener", systemImage: "stop.fill") }.disabled(!model.busy && !model.microphone)
            }.padding(20)
            Picker("Sección", selection: $model.selectedTab) {
                Text("Conversación").tag(0)
                Text("Configuración").tag(1)
                Text("Memoria").tag(2)
            }.pickerStyle(.segmented).padding(.horizontal, 20).padding(.bottom, 16)
            if model.selectedTab == 0 { conversation }
            else if model.selectedTab == 2 { MemoryView(memory: model.desktop.memory) }
            else { configuration }
        }.frame(minWidth: 480, minHeight: 550)
    }
    var conversation: some View { ConversationView(model: model) }
    var configuration: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Conexión").font(.headline)
                Text("Usa tu credencial de Graph, la misma cuenta del asistente de Windows. Se guarda en el Llavero de este Mac.").font(.callout).foregroundStyle(.secondary)
                TextField("Dirección de Graph", text: $model.graphURL).textFieldStyle(.roundedBorder)
                SecureField(model.hasCredential ? "Nueva credencial (ya hay una guardada)" : "Credencial de Graph", text: $model.credential).textFieldStyle(.roundedBorder)
                SecureField("Clave de OpenAI para Live 1 (opcional; se guarda en el Llavero)", text: $model.openAICredential).textFieldStyle(.roundedBorder)
                HStack {
                    Button("Guardar") { Task { await model.saveConfiguration() } }
                    Button("Comprobar conexión") { model.checkConnection() }
                }
                if model.checkingCredential { Text("Consultando el Llavero… Si macOS solicita acceso, autoriza a Ü.").font(.caption) }
                if !model.configurationMessage.isEmpty { Text(model.configurationMessage).font(.caption).foregroundStyle(.secondary) }
                Toggle("Usar dictado y voz de macOS como respaldo", isOn: $model.nativeDictation)
                    .onChange(of: model.nativeDictation) { UserDefaults.standard.set(model.nativeDictation, forKey: "nativeDictation") }
                Text("La voz en vivo permite conversar e interrumpir. El dictado nativo envía cada petición a Graph; tras 45 segundos, vuelve a llamarme «oye U».").font(.caption).foregroundStyle(.secondary)
                HStack {
                    Button(model.checkingVoice ? "Comprobando Live 1…" : "Comprobar Live 1") { model.checkVoice() }
                        .disabled(model.checkingVoice || model.microphone || model.busy)
                    Button(model.microphone ? "Cerrar voz" : "Hablar con Live 1") {
                        if !model.microphone { model.nativeDictation = false }
                        model.toggleMicrophone()
                    }.disabled(model.checkingVoice || model.busy)
                }
                if !model.voiceCheckMessage.isEmpty { Text(model.voiceCheckMessage).font(.caption).textSelection(.enabled) }
                Text("La comprobación abre una sesión breve con el proveedor; no usa el micrófono ni controla el Mac.").font(.caption).foregroundStyle(.secondary)
                Divider()
                Text("Cómo debe ayudarte Ü").font(.headline)
                TextEditor(text: $model.assistantContext)
                    .font(.callout)
                    .frame(minHeight: 110)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(.quaternary))
                    .accessibilityLabel("Contexto personal de Ü")
                Button("Guardar contexto") { model.saveAssistantContext() }
                Text("Se guarda solo en este Mac y se añade a la siguiente conversación con Live 1 y a las tareas enviadas a Graph.").font(.caption).foregroundStyle(.secondary)
                Divider()
                Text("Permisos del Mac").font(.headline)
                permission("Accesibilidad", detail: "Leer controles y usar teclado y ratón.", state: model.permissionSnapshot.accessibility) { model.permissions.request(.accessibility) }
                permission("Grabación de pantalla", detail: "Ver imágenes cuando una aplicación no expone sus controles.", state: model.permissionSnapshot.screenCapture) { model.permissions.request(.screenCapture) }
                permission(model.nativeDictation ? "Micrófono y dictado" : "Micrófono", detail: "Entender lo que le pides. El indicador verde muestra cuándo escucha.", state: model.nativeDictation ? model.permissionSnapshot.voice : model.permissionSnapshot.microphone) { model.permissions.request(model.nativeDictation ? .speech : .microphone) }
                HStack(spacing: 10) {
                    Button("Revisar permisos") { model.refreshPermissions() }
                    Button("Reiniciar Ü para aplicar") { model.permissions.relaunchApp() }
                }
                Divider()
                Text("Live 1 · Luna · \(model.jevStatus)").font(.caption).foregroundStyle(.secondary)
                Text("Control y privacidad").font(.headline)
                Text("La voz en vivo transmite el micrófono al proveedor mientras está conectada y termina a los 15 minutos. Graph recibe el texto de la pantalla durante una tarea. Las imágenes se envían solo cuando las solicita. Los campos protegidos se ocultan del árbol de accesibilidad. La conversación se mantiene en memoria y se borra al salir.")
                    .font(.caption).foregroundStyle(.secondary)
                Text("Autoriza siempre la entrada «Ü para Mac» que aparece desde esta app. Al volver de Ajustes, el estado se revisa automáticamente. Grabación de pantalla y algunos cambios de TCC pueden exigir reiniciar Ü; el botón anterior relanza exactamente este bundle instalado.")
                    .font(.caption).foregroundStyle(.secondary)
                Text("Bundle: \(Bundle.main.bundleIdentifier ?? "desconocido")\nRuta: \(Bundle.main.bundleURL.path)")
                    .font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary).textSelection(.enabled)
                Text("Firma: \(Bundle.main.object(forInfoDictionaryKey: "USigningMode") as? String ?? "desconocida"). Esta identidad no cambia al actualizar la app.")
                    .font(.caption).foregroundStyle(.secondary)
            }.padding(20)
        }
    }
    func permission(_ title: String, detail: String, state: PermissionState, action: @escaping () -> Void) -> some View {
        HStack(alignment: .top) {
            Image(systemName: state.isGranted ? "checkmark.circle.fill" : "circle").foregroundStyle(state.isGranted ? .green : .secondary).padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) { Text(title); Text(detail).font(.caption).foregroundStyle(.secondary) }
            Spacer()
            if !state.isGranted { Button(state == .denied ? "Abrir Ajustes" : "Permitir", action: action) }
        }
    }
}
