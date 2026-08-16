import UIKit

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    private let backgroundSync = BackgroundSyncCoordinator()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions:
            [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        backgroundSync.start()

        Task {
            await backgroundSync.enableBackgroundDelivery()
        }

        return true
    }
}
