import Foundation

/// Una especialidad del catálogo de Graph: su código y su nombre con tildes.
public struct Especialidad: Hashable, Sendable {
    public let codigo: String
    public let nombre: String
    public init(codigo: String, nombre: String) { self.codigo = codigo; self.nombre = nombre }
}

/// EL CATÁLOGO DE ESPECIALIDADES, el de Graph: los mismos códigos (en snake_case) y los mismos nombres, en
/// su orden, que `services/graph/src/domain/clinical/specialtyNames.js`.
///
/// ES UNA COPIA, hecha el 2026-10-01 para la spec 001 del Mac. Copia y no import porque la regla 3 del
/// monorepo no deja leer archivos de otro proyecto, y `packages/` todavía no existe. Si Graph añade una
/// especialidad, se añade aquí también (la promesa 102 fija los códigos y su orden).
///
/// LO QUE NO ESTÁ EN EL CATÁLOGO NO ES UNA ESPECIALIDAD. A diferencia de Windows, que acepta una escrita a
/// mano, aquí el nombre que llega a un prompt sale siempre del catálogo: es lo mismo que hace Graph
/// (`profile.js`), que descarta lo que no reconoce. Quien trabaja en salud con algo que no está en la lista
/// (enfermería, fisioterapia) es «un médico o una médica» sin especialidad, y la constitución lo sabe tratar.
public enum Especialidades {
    public static let todas: [Especialidad] = [
        Especialidad(codigo: "medicina_general", nombre: "Medicina general"),
        Especialidad(codigo: "medicina_familiar", nombre: "Medicina familiar"),
        Especialidad(codigo: "medicina_interna", nombre: "Medicina interna"),
        Especialidad(codigo: "pediatria", nombre: "Pediatría"),
        Especialidad(codigo: "neonatologia", nombre: "Neonatología"),
        Especialidad(codigo: "ginecologia_obstetricia", nombre: "Ginecología y obstetricia"),
        Especialidad(codigo: "urgencias", nombre: "Medicina de urgencias"),
        Especialidad(codigo: "cardiologia", nombre: "Cardiología"),
        Especialidad(codigo: "dermatologia", nombre: "Dermatología"),
        Especialidad(codigo: "endocrinologia", nombre: "Endocrinología"),
        Especialidad(codigo: "gastroenterologia", nombre: "Gastroenterología"),
        Especialidad(codigo: "geriatria", nombre: "Geriatría"),
        Especialidad(codigo: "hematologia", nombre: "Hematología"),
        Especialidad(codigo: "infectologia", nombre: "Infectología"),
        Especialidad(codigo: "nefrologia", nombre: "Nefrología"),
        Especialidad(codigo: "neumologia", nombre: "Neumología"),
        Especialidad(codigo: "neurologia", nombre: "Neurología"),
        Especialidad(codigo: "oncologia", nombre: "Oncología clínica"),
        Especialidad(codigo: "psiquiatria", nombre: "Psiquiatría"),
        Especialidad(codigo: "psicologia", nombre: "Psicología clínica"),
        Especialidad(codigo: "reumatologia", nombre: "Reumatología"),
        Especialidad(codigo: "alergologia", nombre: "Alergología e inmunología"),
        Especialidad(codigo: "dolor_paliativos", nombre: "Dolor y cuidados paliativos"),
        Especialidad(codigo: "rehabilitacion", nombre: "Medicina física y rehabilitación"),
        Especialidad(codigo: "medicina_laboral", nombre: "Medicina laboral"),
        Especialidad(codigo: "medicina_legal", nombre: "Medicina legal"),
        Especialidad(codigo: "anestesiologia", nombre: "Anestesiología"),
        Especialidad(codigo: "cirugia_general", nombre: "Cirugía general"),
        Especialidad(codigo: "cirugia_cardiovascular", nombre: "Cirugía cardiovascular"),
        Especialidad(codigo: "cirugia_torax", nombre: "Cirugía de tórax"),
        Especialidad(codigo: "cirugia_vascular", nombre: "Cirugía vascular"),
        Especialidad(codigo: "neurocirugia", nombre: "Neurocirugía"),
        Especialidad(codigo: "cirugia_plastica", nombre: "Cirugía plástica"),
        Especialidad(codigo: "cirugia_pediatrica", nombre: "Cirugía pediátrica"),
        Especialidad(codigo: "coloproctologia", nombre: "Coloproctología"),
        Especialidad(codigo: "ortopedia", nombre: "Ortopedia y traumatología"),
        Especialidad(codigo: "oftalmologia", nombre: "Oftalmología"),
        Especialidad(codigo: "otorrinolaringologia", nombre: "Otorrinolaringología"),
        Especialidad(codigo: "urologia", nombre: "Urología"),
        Especialidad(codigo: "cirugia_maxilofacial", nombre: "Cirugía oral y maxilofacial"),
        Especialidad(codigo: "radiologia", nombre: "Radiología e imágenes diagnósticas"),
        Especialidad(codigo: "patologia", nombre: "Patología"),
        Especialidad(codigo: "medicina_nuclear", nombre: "Medicina nuclear"),
        Especialidad(codigo: "genetica", nombre: "Genética médica"),
        Especialidad(codigo: "odontologia_general", nombre: "Odontología general"),
        Especialidad(codigo: "endodoncia", nombre: "Endodoncia"),
        Especialidad(codigo: "periodoncia", nombre: "Periodoncia"),
        Especialidad(codigo: "ortodoncia", nombre: "Ortodoncia"),
        Especialidad(codigo: "rehabilitacion_oral", nombre: "Rehabilitación oral")
    ]

    /// Un código como lo normaliza Graph (`normalizeSpecialtyCode`): sin tildes, en minúsculas, y lo que no
    /// sea letra o número de la a a la z se vuelve un «_» entre palabras. «Cardiología» → «cardiologia»,
    /// «medicina-general» → «medicina_general», « MÉDICA » → «medica».
    public static func normalizarCodigo(_ texto: String?) -> String {
        let plano = (texto ?? "").folding(options: [.diacriticInsensitive], locale: nil).lowercased()
        var codigo = ""
        var separar = false
        for escalar in plano.unicodeScalars {
            let valor = escalar.value
            if (valor >= 97 && valor <= 122) || (valor >= 48 && valor <= 57) {
                if separar && !codigo.isEmpty { codigo.append("_") }
                codigo.append(Character(escalar))
                separar = false
            } else {
                separar = true
            }
        }
        return codigo
    }

    /// La especialidad del catálogo que corresponde a un código o a un nombre, sin distinguir mayúsculas ni
    /// tildes; nil si no está en el catálogo. Se mira solo el comienzo (80 caracteres), como Graph.
    public static func buscar(_ texto: String?) -> Especialidad? {
        let clave = normalizarCodigo(texto.map { String($0.prefix(80)) })
        guard !clave.isEmpty else { return nil }
        if let porCodigo = todas.first(where: { $0.codigo == clave }) { return porCodigo }
        return todas.first(where: { normalizarCodigo($0.nombre) == clave })
    }
}

/// CON QUIÉN HABLA Ü EN ESTE MAC: alguien que trabaja en salud (un médico, con su especialidad si la dijo),
/// una persona que lo usa en su día a día, o todavía nadie lo dijo. Es puro: no lee disco ni red salvo los
/// `UserDefaults` que se le pasan, y por eso el contrato lo juzga entero (spec 001, promesas 101 a 108).
///
/// NACE DE LO QUE PIDIÓ EL DUEÑO el 2026-10-01: que Ü pregunte al empezar si quien lo usa trabaja en salud o
/// lo usa para su día a día, que eso viaje a Graph y que los prompts del Mac digan lo mismo que la
/// constitución. Windows lo hizo primero (su spec 078); esto es su comportamiento reescrito, no su código.
///
/// LO NUNCA ELEGIDO ES `sinElegir`, y se porta EXACTAMENTE como la Ü de antes: no viaja nada a Graph y las
/// instrucciones van sin «QUIÉN TE HABLA». Un valor que esta versión no conoce también es «sin elegir», y no
/// un perfil por defecto: adivinar le hablaría a un médico como a un paciente, o al revés.
public struct PerfilDeUso: Codable, Sendable, Equatable {
    /// El valor guardado y el de `profile.kind` para quien trabaja en salud.
    public static let medico = "medico"
    /// El valor guardado y el de `profile.kind` para el uso personal.
    public static let persona = "persona"
    /// Nadie lo dijo todavía: lo de antes.
    public static let sinElegir = PerfilDeUso(tipo: "")

    /// `medico`, `persona` o "" (sin elegir).
    public let tipo: String
    /// El código de la especialidad en el catálogo, o "". Una persona nunca tiene.
    public let especialidad: String

    /// Lo que la persona eligió, en su forma canónica. La especialidad solo cuenta para un médico y solo si
    /// está en el catálogo, por código o por nombre.
    public init(tipo: String?, especialidad: String? = nil) {
        let canonico = PerfilDeUso.normalizar(tipo)
        self.tipo = canonico
        self.especialidad = canonico == PerfilDeUso.medico ? (Especialidades.buscar(especialidad)?.codigo ?? "") : ""
    }

    private enum CodingKeys: String, CodingKey { case tipo, especialidad }

    /// Decodificar también normaliza: lo que venga de fuera pasa por la misma puerta que lo elegido.
    public init(from decoder: Decoder) throws {
        let valores = try decoder.container(keyedBy: CodingKeys.self)
        let tipo = try valores.decodeIfPresent(String.self, forKey: .tipo)
        let especialidad = try valores.decodeIfPresent(String.self, forKey: .especialidad)
        self.init(tipo: tipo, especialidad: especialidad)
    }

    public var elegido: Bool { !tipo.isEmpty }
    public var esMedico: Bool { tipo == Self.medico }
    public var esPersona: Bool { tipo == Self.persona }
    /// El nombre de la especialidad, sacado del catálogo: nunca de texto libre.
    public var especialidadNombre: String { Especialidades.buscar(especialidad)?.nombre ?? "" }

    /// «Médico», «médica » y «MEDICO» son `medico`; «Persona» es `persona`; cualquier otra cosa es "".
    public static func normalizar(_ tipo: String?) -> String {
        switch Especialidades.normalizarCodigo(tipo) {
        case "medico", "medica": return Self.medico
        case "persona": return Self.persona
        default: return ""
        }
    }

    /// Lo que viaja a Graph en `profile` del primer turno; nil sin elegir, y entonces el campo no viaja.
    public var paraElCable: PerfilEnElCable? {
        guard elegido else { return nil }
        return PerfilEnElCable(kind: tipo, specialty: esMedico ? especialidad : "", specialtyName: esMedico ? especialidadNombre : "")
    }

    /// El bloque «QUIÉN TE HABLA» de la constitución, el mismo que arma Graph: el del médico con
    /// «, especialista en <Nombre>» o nada en `{ESPECIALIDAD}`, el de la persona tal cual, y "" sin elegir.
    public var bloqueDelPrompt: String {
        if esMedico {
            let nombre = especialidadNombre
            return ConstitucionDeU.perfilMedico.replacingOccurrences(of: "{ESPECIALIDAD}", with: nombre.isEmpty ? "" : ", especialista en " + nombre)
        }
        return esPersona ? ConstitucionDeU.perfilPersona : ""
    }

    /// Cómo se ve en Configuración: «Trabajo en salud · Cardiología», «Uso personal», «Sin elegir».
    public var paraElMenu: String {
        if esMedico { return especialidadNombre.isEmpty ? "Trabajo en salud" : "Trabajo en salud · " + especialidadNombre }
        return esPersona ? "Uso personal" : "Sin elegir"
    }

    /// Dónde se guarda en este Mac. Dos cadenas y no un JSON: un valor dañado o de otra versión se lee igual,
    /// normalizado, en vez de fallar.
    public static let claveTipo = "perfilDeUso"
    public static let claveEspecialidad = "perfilDeUsoEspecialidad"

    /// El perfil guardado, normalizado; `sinElegir` si no hay ninguno.
    public static func guardado(en defaults: UserDefaults) -> PerfilDeUso {
        PerfilDeUso(tipo: defaults.string(forKey: claveTipo), especialidad: defaults.string(forKey: claveEspecialidad))
    }

    public func guardar(en defaults: UserDefaults) {
        defaults.set(tipo, forKey: Self.claveTipo)
        defaults.set(especialidad, forKey: Self.claveEspecialidad)
    }

    /// Ü pregunta al empezar mientras no se haya elegido nada que esta versión entienda.
    public static func hayQuePreguntar(en defaults: UserDefaults) -> Bool { !guardado(en: defaults).elegido }
}

public extension ConstitucionDeU {
    /// Lo que va primero en las instrucciones de la voz y de Luna: quién es Ü, quién le habla (si se sabe) y
    /// obedecer, separados por un párrafo. Es el orden de Graph y de Windows: el perfil, entre quién es Ü y
    /// lo que hace cuando le piden algo. Sin perfil, quién es Ü y obedecer, nada más.
    static func instrucciones(perfil: PerfilDeUso) -> String {
        [quien, perfil.bloqueDelPrompt, obedece].filter { !$0.isEmpty }.joined(separator: "\n\n")
    }
}
