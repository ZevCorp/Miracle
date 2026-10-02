import SwiftUI
import UCore
import UMac

@MainActor
final class ClinicalViewModel: ObservableObject {
    @Published var consultationState: ConsultationState = .idle
    @Published var transcript = ""
    @Published var note: ClinicalNote?
    @Published var status = "Preparando…"
    @Published var tab = 1
    @Published var email = ""
    @Published var password = ""
    @Published var signedIn = false
    @Published var signingIn = false
    @Published var consultations: [ClinicalEncounter] = []
    private let account = MiracleSession()
    private let dictation = Speech()
    private var api: ClinicalAPI?
    private var portal: PortalClient?
    private var template: ClinicalTemplate?
    private var session: ConsultationSession?
    private var buffer = ""
    private let graphURL: String

    init(graphURL: String) {
        self.graphURL = graphURL
        dictation.onText = { [weak self] text in
            guard let self else { return }
            self.buffer = [self.buffer, text].filter { !$0.isEmpty }.joined(separator: " ")
            self.transcript = self.buffer
        }
        dictation.onPartial = { [weak self] text in self?.transcript = [self?.buffer, text].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ") }
        dictation.onError = { [weak self] text in self?.status = text }
        Task { [weak self] in
            guard let self, let token = await self.account.restore() else { return }
            await self.configure(token: token)
        }
    }

    func signIn() {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !password.isEmpty else { status = "Escribe tu correo y contraseña de Miracle."; return }
        signingIn = true; status = "Entrando a Miracle…"
        Task { [weak self] in
            guard let self else { return }
            do {
                let token = try await account.login(email: email, password: password)
                await self.configure(token: token)
                self.password = ""
            } catch { self.status = error.localizedDescription }
            self.signingIn = false
        }
    }

    private func configure(token: MiracleSessionToken) async {
        do {
            let client = try ClinicalHTTPClient(baseURL: URL(string: graphURL)!, bearerToken: token.accessToken)
            let portal = PortalClient(accessToken: token.accessToken)
            let all = try await client.templates(specialty: nil)
            let open: ClinicalTemplate
            if let existing = OpenClinicalTemplate.find(in: all) { open = existing }
            else { open = try await client.createTemplate(name: OpenClinicalTemplate.name, specialty: OpenClinicalTemplate.specialty) }
            self.api = client; self.portal = portal; self.template = open; self.signedIn = true; self.status = "Listo."; self.consultations = await portal.recent(); self.session = self.makeSession(api: client, template: open, portal: portal)
        } catch { self.status = error.localizedDescription }
    }

    func toggleRecording() {
        if consultationState == .recording { Task { await session?.stop() }; return }
        guard signedIn, let session, let template else { status = "Inicia sesión para abrir una consulta."; return }
        buffer = ""; transcript = ""; note = nil; status = "Abriendo la consulta…"
        Task { _ = await session.start(templateID: template.id) }
    }

    func reset() { session?.reset(); consultationState = .idle; transcript = ""; note = nil; status = "Listo." }

    private func makeSession(api: ClinicalAPI, template: ClinicalTemplate, portal: PortalClient) -> ConsultationSession {
        let result = ConsultationSession(api: api, authenticated: { [weak self] in self?.signedIn == true }, beginDictation: { [weak self] in
            guard let self else { return false }; await self.dictation.start(); return true
        }, stopDictation: { [weak self] in
            guard let self else { return "" }; self.dictation.stop(); return self.buffer
        }, mirror: { encounterID, note, transcript in await portal.mirror(encounterID: encounterID, note: note, transcript: transcript, template: template.name, specialty: template.specialty) })
        result.onChange = { [weak self] state in
            Task { @MainActor in
                self?.consultationState = state
                switch state {
                case .idle: self?.status = "Listo."
                case .recording: self?.status = "Escuchando…"
                case .savingTranscript: self?.status = "Guardando y organizando la nota…"
                case .generatingNote: self?.status = "Organizando la nota…"
                case .noteReady:
                    self?.note = result.note; self?.status = result.portalVisible ? "Nota lista. Ya se ve en el portal." : "Nota lista. No se pudo espejar al portal."; if result.portalVisible { self?.consultations = await portal.recent() }
                case .failed(let message): self?.status = message
                }
            }
        }
        return result
    }
}

struct ClinicalView: View {
    @ObservedObject var model: AppModel
    @StateObject private var clinical: ClinicalViewModel
    init(model: AppModel) { self.model = model; _clinical = StateObject(wrappedValue: ClinicalViewModel(graphURL: model.graphURL)) }
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button { } label: { Label(model.perfil.especialidadNombre.isEmpty ? "Médico" : model.perfil.especialidadNombre, systemImage: "chevron.down") }.buttonStyle(.bordered)
                Button { } label: { Image(systemName: "mic") }.buttonStyle(.plain).foregroundStyle(clinical.consultationState == .recording ? .red : .secondary)
                Spacer()
                Button { model.selectedTab = 1 } label: { Image(systemName: "brain.head.profile") }.buttonStyle(.plain)
                Button { NSApp.keyWindow?.miniaturize(nil) } label: { Image(systemName: "minus") }.buttonStyle(.plain)
                Button { NSApp.keyWindow?.close() } label: { Image(systemName: "xmark") }.buttonStyle(.plain)
            }.padding(.horizontal, 24).padding(.top, 18).padding(.bottom, 16)
            Picker("Sección", selection: $clinical.tab) { Text("Consultas").tag(0); Text("Nota").tag(1) }.pickerStyle(.segmented).padding(.horizontal, 24).padding(.bottom, 18)
            if clinical.tab == 0 { history } else { noteSurface }
            Text(clinical.status).font(.system(size: 12)).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 10)
            Button { clinical.toggleRecording() } label: {
                HStack(spacing: 10) { Text(clinical.consultationState == .recording ? "■" : "●").foregroundStyle(clinical.consultationState == .recording ? .red : .primary); Text(clinical.consultationState == .recording ? "Parar" : "Escuchar").font(.system(size: 17, weight: .semibold)) }
                    .frame(width: 178, height: 74).background(.white, in: Capsule()).overlay(Capsule().stroke(.gray.opacity(0.22))).shadow(radius: 11, y: 4)
            }.buttonStyle(.plain).padding(.bottom, 20)
        }.frame(minWidth: 400, minHeight: 540).background(.white)
        .sheet(isPresented: Binding(get: { !clinical.signedIn }, set: { _ in })) { login }
        .onAppear { if !clinical.signedIn { clinical.status = "Inicia sesión con tu cuenta de Miracle." } }
    }
    private var login: some View {
        VStack(alignment: .leading, spacing: 14) { Text("Cuenta de Miracle").font(.title2.weight(.semibold)); Text("La sesión se usa para guardar la consulta en tu portal.").foregroundStyle(.secondary); TextField("Correo", text: $clinical.email).textFieldStyle(.roundedBorder); SecureField("Contraseña", text: $clinical.password).textFieldStyle(.roundedBorder); Button(clinical.signingIn ? "Entrando…" : "Entrar") { clinical.signIn() }.keyboardShortcut(.defaultAction).disabled(clinical.signingIn); Text(clinical.status).font(.caption).foregroundStyle(.secondary) }.padding(28).frame(width: 360)
    }
    private var noteSurface: some View {
        ScrollView { VStack(alignment: .leading, spacing: 12) {
            if clinical.transcript.isEmpty && clinical.note == nil { VStack(alignment: .leading, spacing: 8) { Text("Pulsa Escuchar y habla con normalidad.").font(.headline); Text("La nota se organiza al parar la consulta.").foregroundStyle(.secondary); Text("Suelta aquí la historia clínica —fotos o PDF— y te digo por qué vino a cardiología.").font(.caption).foregroundStyle(.secondary) }.padding(20).background(.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 20)) }
            if !clinical.transcript.isEmpty { Text(clinical.transcript).font(.system(size: 15)).lineSpacing(8) }
            if let note = clinical.note { Text("RESUMEN").font(.caption).foregroundStyle(.secondary); Text(note.summary).font(.system(size: 15, weight: .medium)); ForEach(note.sections) { section in VStack(alignment: .leading, spacing: 6) { Text(section.title.uppercased()).font(.caption).foregroundStyle(.secondary); Text(section.text).font(.system(size: 13.5)) }.padding(16).background(.blue.opacity(0.04), in: RoundedRectangle(cornerRadius: 18)) }; ForEach(note.warnings, id: \.self) { Text($0).font(.caption).foregroundStyle(.orange) } }
        }.padding(.horizontal, 24) }
    }
    private var history: some View {
        ScrollView { VStack(alignment: .leading, spacing: 10) {
            if clinical.consultations.isEmpty { Text("Todavía no hay consultas.").font(.headline); Text("La primera que grabes aparece aquí y en el portal.").foregroundStyle(.secondary) }
            else { ForEach(clinical.consultations, id: \.id) { item in HStack { VStack(alignment: .leading, spacing: 4) { Text(item.note?.summary.isEmpty == false ? item.note!.summary : "Consulta").font(.system(size: 14)); Text(item.status.capitalized).font(.caption).foregroundStyle(.secondary) }; Spacer(); Text("✓").foregroundStyle(.blue) }.padding(14).background(.blue.opacity(0.04), in: RoundedRectangle(cornerRadius: 18)) } }
        }.padding(24) }
    }
}
