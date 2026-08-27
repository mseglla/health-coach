import Foundation

// Foundation-only contract: also compiled by scripts/test-health-ingestion-core.sh.
enum HealthSampleKind: String, CaseIterable, Codable, Hashable, Sendable {
    case restingHeartRate = "resting_heart_rate_bpm"
    case hrv = "hrv_sdnn_ms"
    case vo2Max = "vo2_max_ml_kg_min"
    case bodyMass = "body_mass_kg"
    case bodyFat = "body_fat_percent"
    case leanBodyMass = "lean_body_mass_kg"
    case sleep = "sleep_stage"

    var label: String {
        switch self {
        case .restingHeartRate: return "Pols en repòs"
        case .hrv: return "HRV (SDNN)"
        case .vo2Max: return "VO₂max"
        case .bodyMass: return "Pes"
        case .bodyFat: return "Greix corporal"
        case .leanBodyMass: return "Massa magra"
        case .sleep: return "Son"
        }
    }

    var unit: String? {
        switch self {
        case .restingHeartRate: return "bpm"
        case .hrv: return "ms"
        case .vo2Max: return "ml/kg/min"
        case .bodyMass, .leanBodyMass: return "kg"
        case .bodyFat: return "%"
        case .sleep: return nil
        }
    }
}

struct HealthSampleRecord: Codable, Equatable, Sendable {
    let externalId: UUID
    let startedAt: Date
    let endedAt: Date
    let value: Double?
    let unit: String?
    let sleepStage: String?
    let categoryValue: Int?
    let sourceBundleId: String
    let sourceVersion: String?
    let sourceDevice: String?
    let timezone: String?
    let importTimezone: String
    let wasUserEntered: Bool?

    enum CodingKeys: String, CodingKey {
        case externalId = "external_id", startedAt = "started_at", endedAt = "ended_at"
        case value, unit, timezone
        case sleepStage = "sleep_stage", categoryValue = "category_value"
        case sourceBundleId = "source_bundle_id", sourceVersion = "source_version"
        case sourceDevice = "source_device", importTimezone = "import_timezone"
        case wasUserEntered = "was_user_entered"
    }

    func validate(for kind: HealthSampleKind) throws {
        guard endedAt >= startedAt, !sourceBundleId.isEmpty,
              !importTimezone.isEmpty else {
            throw HealthIngestionError.invalidSample
        }
        if kind == .sleep {
            guard value == nil, unit == nil, let categoryValue,
                  categoryValue >= 0, sleepStage == Self.stage(for: categoryValue) else {
                throw HealthIngestionError.invalidSample
            }
        } else {
            guard let value, value.isFinite, value >= 0, unit == kind.unit,
                  sleepStage == nil, categoryValue == nil else {
                throw HealthIngestionError.invalidSample
            }
            if kind == .bodyFat && value > 100 { throw HealthIngestionError.invalidSample }
        }
    }

    static func stage(for rawValue: Int) -> String {
        // Preserve future HealthKit values rather than silently discard them.
        switch rawValue {
        case 0: return "in_bed"
        case 1: return "asleep_unspecified"
        case 2: return "awake"
        case 3: return "core"
        case 4: return "deep"
        case 5: return "rem"
        default: return "unknown"
        }
    }
}

struct HealthSamplePage: Sendable {
    let samples: [HealthSampleRecord]
    let deletedIds: [UUID]
    let nextAnchor: Data
    var isEmpty: Bool { samples.isEmpty && deletedIds.isEmpty }
}

enum HealthIngestionError: LocalizedError {
    case invalidSample, stalledCursor, missingAnchor, sessionChanged, disabled
    case permissionRequestNeeded, invalidResponse, serverRejected(Int), corruptCursor

    var errorDescription: String? {
        switch self {
        case .invalidSample: return "Mostra de salut no vàlida; cursor conservat."
        case .stalledCursor: return "HealthKit no ha avançat el cursor; importació aturada."
        case .missingAnchor: return "HealthKit no ha retornat un cursor vàlid."
        case .sessionChanged: return "La sessió ha canviat; torna a iniciar la sincronització."
        case .disabled: return "La importació ampliada encara no està activada."
        case .permissionRequestNeeded: return "Prem Connectar Apple Health per revisar els permisos nous."
        case .invalidResponse: return "Resposta de sincronització no vàlida."
        case .serverRejected(let code): return "Supabase ha rebutjat el bloc (HTTP \(code)); cursor conservat."
        case .corruptCursor: return "Cursor local il·legible; cal revisar-lo abans de continuar."
        }
    }
}

@MainActor protocol HealthPageReading {
    func read(kind: HealthSampleKind, anchor: Data?) async throws -> HealthSamplePage
}

@MainActor protocol HealthPageWriting {
    func write(page: HealthSamplePage, kind: HealthSampleKind, userId: String) async throws
}

@MainActor protocol HealthCursorStoring {
    func load(scope: String, kind: HealthSampleKind) throws -> Data?
    func save(_ anchor: Data, scope: String, kind: HealthSampleKind) throws
}

struct HealthIngestionResult: Sendable {
    let samples: Int
    let deletions: Int
    let needsContinuation: Bool
    let noAccessibleSamples: Bool
}

@MainActor
struct HealthIngestionRunner {
    let reader: any HealthPageReading
    let writer: any HealthPageWriting
    let cursors: any HealthCursorStoring

    func run(kind: HealthSampleKind, userId: String, scope: String,
             maxPages: Int, sessionIsCurrent: () -> Bool) async throws -> HealthIngestionResult {
        var anchor = try cursors.load(scope: scope, kind: kind)
        let wasInitial = anchor == nil
        var samples = 0
        var deletions = 0
        for _ in 0..<max(1, maxPages) {
            try Task.checkCancellation()
            guard sessionIsCurrent() else { throw HealthIngestionError.sessionChanged }
            let page = try await reader.read(kind: kind, anchor: anchor)
            try Task.checkCancellation()
            guard sessionIsCurrent() else { throw HealthIngestionError.sessionChanged }
            guard !page.nextAnchor.isEmpty else { throw HealthIngestionError.missingAnchor }
            if !page.isEmpty && page.nextAnchor == anchor { throw HealthIngestionError.stalledCursor }
            for record in page.samples { try record.validate(for: kind) }
            // Including empty pages: verify server/auth/schema before acknowledging an anchor.
            try await writer.write(page: page, kind: kind, userId: userId)
            guard sessionIsCurrent() else { throw HealthIngestionError.sessionChanged }
            samples += page.samples.count
            deletions += page.deletedIds.count
            if page.isEmpty {
                // No data may mean no read permission. Never advance a cursor on absence alone.
                return HealthIngestionResult(samples: samples, deletions: deletions,
                    needsContinuation: false,
                    noAccessibleSamples: wasInitial && samples == 0 && deletions == 0)
            }
            try cursors.save(page.nextAnchor, scope: scope, kind: kind)
            anchor = page.nextAnchor
        }
        return HealthIngestionResult(samples: samples, deletions: deletions,
            needsContinuation: true, noAccessibleSamples: false)
    }
}
