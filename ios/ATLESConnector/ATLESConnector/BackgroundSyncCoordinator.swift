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
                await self?.syncSteps()
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

    private func syncSteps() async {
        guard let session = await prepareSession() else {
            return
        }

        do {
            let metrics =
                try await healthKit.loadRecentStepHistory(
                    days: 7
                )

            await sync.syncStepHistory(
                metrics: metrics,
                userId: session.userId,
                accessToken: session.accessToken
            )

            // Mantenim també l'estat publicat
            // que utilitza la UI del connector.
            await healthKit.loadTodaySteps()

        } catch {
            print(
                "ATLES step background sync failed:",
                error.localizedDescription
            )
        }
    }

    private func syncWorkouts() async {
        guard let session = await prepareSession() else {
            return
        }

        await healthKit.loadRecentWorkouts()

        let metrics = await healthKit.loadWorkoutMetrics(
            for: healthKit.workouts
        )

        await sync.syncWorkouts(
            workouts: healthKit.workouts,
            metricsByWorkout: metrics,
            userId: session.userId,
            accessToken: session.accessToken
        )
    }
}
