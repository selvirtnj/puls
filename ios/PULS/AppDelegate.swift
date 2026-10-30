import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?
    /// Genau ein ProfileStore für Zustandsbrücke und native Bereiche.
    private(set) var environment: AppEnvironment?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        RestCoordinator.shared.endActivities()

        let environment = AppEnvironment()
        self.environment = environment
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = WebViewController.background
        window.rootViewController = WebViewController(environment: environment)
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    // In der offenen App meldet die Web-App das Pausenende selbst (Hinweis, Ton, Vibration).
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }
}
