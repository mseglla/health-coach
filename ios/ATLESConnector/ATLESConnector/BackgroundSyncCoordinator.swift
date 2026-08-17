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

        await healthKit.loadTodaySteps()

        await sync.syncTodaySteps(
            steps: healthKit.todaySteps,
            userId: session.userId,
            accessToken: session.accessToken
        )
    }

    private func syncWorkouts() async {
        guard let session = await prepareSession() else {
            return
        }

        await healthKit.loadRecentWorkouts()

        await sync.syncWorkouts(
            workouts: healthKit.workouts,
            userId: session.userId,
            accessToken: session.accessToken
        )
    }
}
