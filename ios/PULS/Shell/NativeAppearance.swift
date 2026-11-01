import UIKit
import PULSCore

/// Ein Ort für Hell/Dunkel nativer Ansichten (Fenster, Hosts, präsentierte Sessions/Aktivität/Körper).
/// Gerätewunsch des Webs: `light`/`dark` → fester Stil, `system` → `.unspecified` (folgt dem iPhone, auch bei einem
/// Wechsel während einer Präsentation). Ein gerade nativ gewählter Wunsch gilt sofort, bis der Snapshot ihn bestätigt.
@MainActor
enum NativeAppearance {
    /// `system|light|dark` oder `nil` (noch unbekannt: kein Hello/Snapshot/Projektion mit Darstellung).
    static func scheme(_ store: ProfileStore) -> String? {
        store.pendingScheme?.rawValue ?? store.currentProjection?.overview.colorScheme ?? store.deviceScheme
    }

    static func style(for scheme: String?) -> UIUserInterfaceStyle? {
        switch scheme {
        case "light"?: return .light
        case "dark"?: return .dark
        case "system"?: return .unspecified
        default: return nil
        }
    }

    /// Stil für eine präsentierte Ansicht. Bekannter Wunsch → sofort; unbekannt → wie bisher `data-scheme` der Web-App
    /// (`fallback` bis zur Antwort).
    static func apply(to controller: UIViewController, store: ProfileStore, fallback: UIUserInterfaceStyle,
                      readWebScheme: (@escaping @MainActor (String?) -> Void) -> Void) {
        if let style = style(for: scheme(store)) {
            controller.overrideUserInterfaceStyle = style
            return
        }
        controller.overrideUserInterfaceStyle = fallback
        readWebScheme { [weak controller] value in
            guard let value else { return }
            controller?.overrideUserInterfaceStyle = value == "light" ? .light : .dark
        }
    }
}
