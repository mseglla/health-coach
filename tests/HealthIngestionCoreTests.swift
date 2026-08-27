import Foundation

enum TestFailure: Error { case simulated }

@MainActor final class FakeReader: HealthPageReading {
    var pages: [HealthSamplePage]
    var anchors: [Data?] = []
    var afterRead: (() -> Void)?
    init(_ pages: [HealthSamplePage]) { self.pages = pages }
    func read(kind: HealthSampleKind, anchor: Data?) async throws -> HealthSamplePage {
        anchors.append(anchor)
        afterRead?()
        guard !pages.isEmpty else { throw TestFailure.simulated }
        return pages.removeFirst()
    }
}

@MainActor final class FakeWriter: HealthPageWriting {
    var pages: [HealthSamplePage] = []
    var failAt = -1
    var afterWrite: (() -> Void)?
    func write(page: HealthSamplePage, kind: HealthSampleKind, userId: String) async throws {
        if pages.count == failAt { throw TestFailure.simulated }
        pages.append(page)
        afterWrite?()
    }
}

@MainActor final class FakeCursors: HealthCursorStoring {
    var storage: [String: Data] = [:]
    var fail = false
    func load(scope: String, kind: HealthSampleKind) -> Data? { storage[scope + kind.rawValue] }
    func save(_ anchor: Data, scope: String, kind: HealthSampleKind) throws {
        if fail { throw TestFailure.simulated }
        storage[scope + kind.rawValue] = anchor
    }
}

@main struct HealthIngestionCoreTests {
    @MainActor static func main() async throws {
        let a = Data([1]), b = Data([2]), c = Data([3])
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        func record(value: Double? = 55, unit: String? = "bpm",
                    stage: String? = nil, category: Int? = nil,
                    start: Date? = nil, end: Date? = nil) -> HealthSampleRecord {
            HealthSampleRecord(externalId: UUID(), startedAt: start ?? date, endedAt: end ?? date,
                value: value, unit: unit, sleepStage: stage, categoryValue: category,
                sourceBundleId: "atles.test", sourceVersion: nil, sourceDevice: nil,
                timezone: nil, importTimezone: "Europe/Madrid", wasUserEntered: nil)
        }
        func page(_ anchor: Data, records: [HealthSampleRecord] = [],
                  deletes: [UUID] = []) -> HealthSamplePage {
            HealthSamplePage(samples: records, deletedIds: deletes, nextAnchor: anchor)
        }
        func expectError(_ operation: () async throws -> Void) async {
            do { try await operation(); fatalError("Expected an error") } catch {}
        }
        let sample = record()
        try sample.validate(for: .restingHeartRate)
        for kind in HealthSampleKind.allCases where kind != .sleep {
            try record(value: 25, unit: kind.unit).validate(for: kind)
        }
        for (raw, stage) in [(0, "in_bed"), (1, "asleep_unspecified"), (2, "awake"),
                             (3, "core"), (4, "deep"), (5, "rem"), (99, "unknown")] {
            try record(value: nil, unit: nil, stage: stage, category: raw).validate(for: .sleep)
        }
        for invalid in [record(value: -Double.infinity), record(value: .nan), record(value: -1),
                        record(unit: "kg"), record(end: date.addingTimeInterval(-1))] {
            await expectError { try invalid.validate(for: .restingHeartRate) }
        }
        await expectError { try record(value: 101, unit: "%").validate(for: .bodyFat) }
        await expectError { try record(value: nil, unit: nil, stage: "deep", category: 5).validate(for: .sleep) }
        // Crossing midnight is retained exactly; no summation or date truncation here.
        let night = record(value: nil, unit: nil, stage: "core", category: 3,
            start: date, end: date.addingTimeInterval(8 * 3600))
        let encoder = JSONEncoder()
        let decoded = try JSONDecoder().decode(HealthSampleRecord.self, from: encoder.encode(night))
        precondition(decoded == night)

        do {
            let reader = FakeReader([page(a, records: [sample]), page(b, deletes: [sample.externalId]), page(c)])
            let writer = FakeWriter(), store = FakeCursors()
            let runner = HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
            let result = try await runner.run(kind: .restingHeartRate, userId: "A", scope: "dev/A",
                maxPages: 10, sessionIsCurrent: { true })
            precondition(result.samples == 1 && result.deletions == 1 && !result.needsContinuation)
            precondition(reader.anchors == [nil, a, b] && writer.pages.count == 3)
            precondition(store.load(scope: "dev/A", kind: .restingHeartRate) == b)
            precondition(store.load(scope: "dev/B", kind: .restingHeartRate) == nil)
            precondition(store.load(scope: "prod/A", kind: .restingHeartRate) == nil)
            precondition(store.load(scope: "dev/A", kind: .hrv) == nil)
        }
        do {
            // A server failure on page two leaves page one's acknowledged cursor intact.
            let reader = FakeReader([page(a, records: [sample]), page(b, records: [sample])])
            let writer = FakeWriter(), store = FakeCursors()
            writer.failAt = 1
            let runner = HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
            await expectError {
                _ = try await runner.run(kind: .restingHeartRate, userId: "A", scope: "dev/A",
                    maxPages: 10, sessionIsCurrent: { true })
            }
            precondition(store.load(scope: "dev/A", kind: .restingHeartRate) == a)
            writer.failAt = -1
            reader.pages = [page(b, records: [sample]), page(c)]
            let retry = try await runner.run(kind: .restingHeartRate, userId: "A", scope: "dev/A",
                maxPages: 10, sessionIsCurrent: { true })
            precondition(!retry.needsContinuation && reader.anchors[2] == a)
        }
        do {
            let reader = FakeReader([page(a, records: [sample]), page(a, records: [sample])])
            let writer = FakeWriter(), store = FakeCursors()
            let runner = HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
            await expectError {
                _ = try await runner.run(kind: .restingHeartRate, userId: "A", scope: "A",
                    maxPages: 10, sessionIsCurrent: { true })
            }
            precondition(writer.pages.count == 1)
        }
        do {
            let reader = FakeReader([page(a, records: [sample])]), writer = FakeWriter(), store = FakeCursors()
            let runner = HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
            let result = try await runner.run(kind: .restingHeartRate, userId: "A", scope: "A",
                maxPages: 1, sessionIsCurrent: { true })
            precondition(result.needsContinuation)
        }
        do {
            let reader = FakeReader([page(a)]), writer = FakeWriter(), store = FakeCursors()
            let result = try await HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
                .run(kind: .sleep, userId: "A", scope: "A", maxPages: 10, sessionIsCurrent: { true })
            precondition(result.noAccessibleSamples && writer.pages.count == 1)
            precondition(store.storage.isEmpty)
        }
        for switchAfterWrite in [false, true] {
            let reader = FakeReader([page(a, records: [sample])]), writer = FakeWriter(), store = FakeCursors()
            var current = true
            if switchAfterWrite { writer.afterWrite = { current = false } }
            else { reader.afterRead = { current = false } }
            await expectError {
                _ = try await HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
                    .run(kind: .restingHeartRate, userId: "A", scope: "A", maxPages: 10,
                         sessionIsCurrent: { current })
            }
            precondition(store.storage.isEmpty)
            precondition(writer.pages.count == (switchAfterWrite ? 1 : 0))
        }
        do {
            // Local persistence failure after server acknowledgement is safe to replay.
            let reader = FakeReader([page(a, records: [sample])]), writer = FakeWriter(), store = FakeCursors()
            store.fail = true
            await expectError {
                _ = try await HealthIngestionRunner(reader: reader, writer: writer, cursors: store)
                    .run(kind: .restingHeartRate, userId: "A", scope: "A", maxPages: 10,
                         sessionIsCurrent: { true })
            }
            precondition(store.storage.isEmpty && writer.pages.count == 1)
        }
        print("PASS — ingestion core: types, sleep, paging, retry, scoped cursors and session isolation")
    }
}
