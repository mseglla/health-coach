import Foundation

@MainActor
final class BackgroundSyncCoordinator {
    private let healthKit = HealthKitManager()
    private let auth = SupabaseAuthManager.shared
    private let sync = SupabaseHealthSyncManager()

    func enableBackgroundDelivery() async {
        await healthKit.enableBackgroundDelivery()
    }

    func start() {
        healthKit.startObservers(
            onStepsChanged: { [weak self] in
                await self?.syncDailyMetrics()
            },
            onHeartRateChanged: { [weak self] in
                await self?.syncDailyMetrics()
            },
            onWorkoutsChanged: { [weak self] in
                await self?.syncWorkouts()
            }
        )
    }

    private func prepareSession() async -> (
        userId: String,
        accessToken: String
    )? {
        await auth.restoreSession()

        guard let userId = auth.userId,
              let accessToken = auth.accessToken
        else {
            return nil
        }

        return (userId, accessToken)
    }

    private func syncDailyMetrics() async {
        guard let session = await prepareSession() else {
            return
        }

        do {
            let metrics =
                try await healthKit.loadRecentDailyHistory(
                    days: 7,
                    baselineDays: 30
                )

            await sync.syncDailyMetrics(
                metrics: metrics,
                userId: session.userId,
                accessToken: session.accessToken
            )

            // Mantenim també l'estat publicat
            // que utilitza la UI del connector.
            await healthKit.loadTodaySteps()

        } catch {
            print(
                "ATLES daily background sync failed:",
                error.localizedDescription
            )
        }
    }

    private func syncWorkouts() async {
        guard let session = await prepareSession() else {
            return
        }

        do {
            let workouts =
                try await healthKit.loadRecentWorkoutHistory(
                    days: 14
                )

            let metrics =
                await healthKit.loadWorkoutMetrics(
                    for: workouts
                )

            await sync.syncWorkouts(
                workouts: workouts,
                metricsByWorkout: metrics,
                userId: session.userId,
                accessToken: session.accessToken
            )
        } catch {
            print(
                "ATLES workout background sync failed:",
                error.localizedDescription
            )
        }
    }
}
