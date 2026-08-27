import Foundation
import HealthKit

@MainActor
final class HealthKitSampleReader: HealthPageReading {
    private let store = HKHealthStore()
    static let pageSize = 250

    func checkPermissionRequest() async throws {
        let read = Set<HKObjectType>(HealthMetricCatalog.expanded.map { $0.type })
        let status: HKAuthorizationRequestStatus = try await withCheckedThrowingContinuation { continuation in
            store.getRequestStatusForAuthorization(toShare: [], read: read) { status, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: status)
                }
            }
        }
        if status != .unnecessary { throw HealthIngestionError.permissionRequestNeeded }
        // .unnecessary does NOT establish read authorization; empty reads remain ambiguous.
    }

    func read(kind: HealthSampleKind, anchor data: Data?) async throws -> HealthSamplePage {
        let anchor: HKQueryAnchor?
        if let data {
            guard let decoded = try NSKeyedUnarchiver.unarchivedObject(
                ofClass: HKQueryAnchor.self, from: data
            ) else { throw HealthIngestionError.corruptCursor }
            anchor = decoded
        } else {
            anchor = nil
        }
        return try await withCheckedThrowingContinuation { continuation in
            // No moving date predicate: the same anchor sees late imports and old deletions.
            let query = HKAnchoredObjectQuery(type: HealthMetricCatalog.sampleType(for: kind),
                predicate: nil, anchor: anchor, limit: Self.pageSize) {
                _, samples, deleted, nextAnchor, error in
                Task { @MainActor in
                    do {
                        if let error { throw error }
                        guard let nextAnchor else { throw HealthIngestionError.missingAnchor }
                        let records = try (samples ?? []).map { try self.normalize($0, kind: kind) }
                        let encoded = try NSKeyedArchiver.archivedData(
                            withRootObject: nextAnchor, requiringSecureCoding: true
                        )
                        continuation.resume(returning: HealthSamplePage(samples: records,
                            deletedIds: (deleted ?? []).map(\.uuid), nextAnchor: encoded))
                    } catch { continuation.resume(throwing: error) }
                }
            }
            store.execute(query)
        }
    }

    private func normalize(_ sample: HKSample, kind: HealthSampleKind) throws -> HealthSampleRecord {
        guard sample.sampleType == HealthMetricCatalog.sampleType(for: kind) else {
            throw HealthIngestionError.invalidSample
        }
        let value: Double?
        let stage: String?
        let category: Int?
        if kind == .sleep {
            guard let sample = sample as? HKCategorySample else { throw HealthIngestionError.invalidSample }
            value = nil
            category = sample.value
            stage = HealthSampleRecord.stage(for: sample.value)
        } else {
            guard let sample = sample as? HKQuantitySample,
                  let unit = HealthMetricCatalog.unit(for: kind) else {
                throw HealthIngestionError.invalidSample
            }
            // HKUnit.percent is a fraction (0.25); ATLES stores percentage points (25).
            let raw = sample.quantity.doubleValue(for: unit)
            value = kind == .bodyFat ? raw * 100 : raw
            stage = nil
            category = nil
        }
        let record = HealthSampleRecord(externalId: sample.uuid,
            startedAt: sample.startDate, endedAt: sample.endDate,
            value: value, unit: kind.unit, sleepStage: stage, categoryValue: category,
            sourceBundleId: sample.sourceRevision.source.bundleIdentifier,
            sourceVersion: sample.sourceRevision.version, sourceDevice: sample.device?.name,
            timezone: sample.metadata?[HKMetadataKeyTimeZone] as? String,
            importTimezone: TimeZone.current.identifier,
            wasUserEntered: (sample.metadata?[HKMetadataKeyWasUserEntered] as? NSNumber)?.boolValue)
        try record.validate(for: kind)
        return record
    }
}

@MainActor
final class HealthAnchorStore: HealthCursorStoring {
    private let defaults: UserDefaults
    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    private func key(scope: String, kind: HealthSampleKind) -> String {
        "atles.healthkit.samples.v1.\(scope).\(kind.rawValue)"
    }

    func load(scope: String, kind: HealthSampleKind) throws -> Data? {
        let key = key(scope: scope, kind: kind)
        guard defaults.object(forKey: key) != nil else { return nil }
        guard let data = defaults.data(forKey: key), !data.isEmpty else {
            throw HealthIngestionError.corruptCursor
        }
        return data
    }

    func save(_ anchor: Data, scope: String, kind: HealthSampleKind) throws {
        defaults.set(anchor, forKey: key(scope: scope, kind: kind))
    }
}
