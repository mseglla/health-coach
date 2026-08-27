import Foundation
import Combine

@MainActor
final class HealthSampleIngestionCoordinator: ObservableObject {
    static let shared = HealthSampleIngestionCoordinator()
    @Published private(set) var isSyncing = false
    @Published private(set) var statusByKind: [HealthSampleKind: String] = [:]
    @Published private(set) var errorMessage: String?
    private let auth = SupabaseAuthManager.shared
    private let reader = HealthKitSampleReader()
    private let writer = SupabaseHealthSyncManager()
    private let cursors = HealthAnchorStore()
    private var running: Task<Void, Never>?
    private var statusUserId: String?

    func resetStatusForSession() {
        if statusUserId != auth.userId {
            statusByKind = [:]
            errorMessage = nil
            statusUserId = auth.userId
        }
    }

    func synchronize(kinds: [HealthSampleKind] = HealthSampleKind.allCases,
                     maxPages: Int = 100) async {
        guard HealthMetricCatalog.expandedImportEnabled else { return }
        // Do not drop an observer's event while a foreground sync owns the cursor.
        while let previous = running { await previous.value }
        let task = Task { @MainActor in
            await self.perform(kinds: kinds, maxPages: maxPages)
            self.running = nil
        }
        running = task
        await task.value
    }

    private func perform(kinds: [HealthSampleKind], maxPages: Int) async {
        isSyncing = true
        errorMessage = nil
        defer { isSyncing = false }
        await auth.restoreSession()
        resetStatusForSession()
        guard let userId = auth.userId, auth.accessToken != nil else {
            errorMessage = "Inicia sessió abans d'importar."
            return
        }
        do { try await reader.checkPermissionRequest() }
        catch { errorMessage = error.localizedDescription; return }

        let runner = HealthIngestionRunner(reader: reader, writer: writer, cursors: cursors)
        let scope = "\(writer.ingestionBackendScope)/\(userId)"
        for kind in kinds {
            guard auth.userId == userId else {
                errorMessage = HealthIngestionError.sessionChanged.localizedDescription
                break
            }
            statusByKind[kind] = "Important…"
            do {
                let result = try await runner.run(kind: kind, userId: userId, scope: scope,
                    maxPages: maxPages, sessionIsCurrent: {
                        self.auth.userId == userId && self.auth.accessToken != nil
                    })
                guard auth.userId == userId else { resetStatusForSession(); break }
                if result.needsContinuation {
                    statusByKind[kind] = "\(result.samples) mostres · pendent de continuar"
                } else if result.noAccessibleSamples {
                    statusByKind[kind] = "Sense dades accessibles; comprova dades i permisos a Salut"
                } else if result.samples == 0 && result.deletions == 0 {
                    statusByKind[kind] = "Cap canvi accessible; els permisos poden limitar la lectura"
                } else {
                    statusByKind[kind] = "Processades: \(result.samples) mostres, \(result.deletions) baixes"
                }
            } catch {
                guard auth.userId == userId else { resetStatusForSession(); break }
                // One type's failure must not block the six other types.
                statusByKind[kind] = "Error · \(error.localizedDescription)"
                errorMessage = "Importació parcial. Revisa els tipus amb error i torna-ho a provar."
            }
        }
    }
}
