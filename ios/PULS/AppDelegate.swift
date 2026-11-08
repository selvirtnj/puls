import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        RestCoordinator.shared.endActivities()

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = WebViewController.background
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    // Nur neue Erinnerungen im Vordergrund zeigen. Pause und Lauf-km behalten ihr bisheriges Verhalten.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let id = notification.request.identifier
        if id.hasPrefix("puls-reminder-training-") || id.hasPrefix("puls-reminder-weight-") {
            completionHandler([.banner, .sound])
        } else {
            completionHandler([])
        }
    }
}
