import ActivityKit
import Foundation
import UserNotifications

/// Lauf außerhalb der App: Live-Aktivität (Dynamic Island, Sperrbildschirm) und eine Mitteilung je Kilometer.
/// js/running.js meldet Start, Pause, Weiter und Ende („runActivity“). Bei GPS-Läufen zählt die Distanz
/// aus RunTracker, damit Insel und Mitteilungen auch bei gesperrtem iPhone weiterlaufen.
final class RunActivityCoordinator {
    static let shared = RunActivityCoordinator()

    private var runKey = ""
    private var title = "Lauf"
    private var startedAt = Date()
    private var pausedSeconds = 0.0
    private var pausedAt: Date?
    private var gps = false
    private var routeKm: Double?
    private var webKm = 0.0
    private var nativeKm = 0.0
    private var announcedKm = 0
    private var lastSplitAt = 0.0
    private var lastSplitSeconds: Double?
    private var lastPush = Date.distantPast
    private var lastPushedKm = -1.0
    private let announcedKey = "puls-run-announced"

    private var distanceKm: Double { gps && RunTracker.shared.runKey == runKey ? max(nativeKm, webKm) : webKm }

    private func elapsed(at date: Date = Date()) -> Double {
        max(0, (pausedAt ?? date).timeIntervalSince(startedAt) - pausedSeconds)
    }

    /// Nachricht der Web-App. active=false beendet die Aktivität (finished: kurz mit Endstand stehen lassen).
    func update(_ body: [String: Any]) {
        guard body["active"] as? Bool == true, let key = body["runKey"] as? String, let started = body["startedAt"] as? Double else {
            end(finished: body["finished"] as? Bool ?? false, finalKm: body["finalKm"] as? Double, finalSeconds: body["finalSeconds"] as? Double)
            return
        }
        if key != runKey {
            runKey = key
            nativeKm = 0
            lastSplitSeconds = nil
            // Bereits gemeldete Kilometer überstehen einen App-Neustart (sonst käme „Kilometer 1“ doppelt).
            let saved = UserDefaults.standard.dictionary(forKey: announcedKey)
            if saved?["runKey"] as? String == key {
                announcedKm = saved?["km"] as? Int ?? 0
                lastSplitAt = saved?["splitAt"] as? Double ?? 0
            } else {
                announcedKm = 0
                lastSplitAt = 0
            }
            requestNotifications()
        }
        title = body["title"] as? String ?? "Lauf"
        startedAt = Date(timeIntervalSince1970: started / 1000)
        pausedSeconds = body["pausedSeconds"] as? Double ?? 0
        pausedAt = (body["pausedAt"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) }
        gps = body["gps"] as? Bool ?? false
        routeKm = body["routeKm"] as? Double
        webKm = body["distanceKm"] as? Double ?? 0
        if gps && RunTracker.shared.runKey == key { nativeKm = max(nativeKm, RunTracker.shared.meters / 1000) }
        // Schon gelaufene volle Kilometer nach einem App-Neustart nicht erneut melden; Splitbeginn anteilig schätzen.
        if announcedKm == 0 && distanceKm >= 1 {
            announcedKm = Int(distanceKm)
            lastSplitAt = elapsed() * Double(announcedKm) / distanceKm
        }
        push(force: true)
    }

    /// Neuer GPS-Punkt von RunTracker (auch im Hintergrund).
    func nativeDistanceChanged(runKey key: String, km: Double) {
        guard key == runKey, pausedAt == nil else { return }
        nativeKm = km
        announceKilometers()
        push(force: false)
    }

    private func announceKilometers() {
        let whole = Int(distanceKm)
        guard whole > announcedKm else { return }
        let now = elapsed()
        // Mehrere Kilometer auf einmal (z. B. nach langer Funkstille): Zeit gleichmäßig aufteilen.
        let split = (now - lastSplitAt) / Double(whole - announcedKm)
        announcedKm = whole
        lastSplitAt = now
        lastSplitSeconds = split
        UserDefaults.standard.set(["runKey": runKey, "km": whole, "splitAt": now], forKey: announcedKey)
        notifyKilometer(whole, split: split, total: now)
        push(force: true)
    }

    private func content() -> RunActivityAttributes.ContentState {
        let km = distanceKm, time = elapsed()
        return RunActivityAttributes.ContentState(
            timerStart: startedAt.addingTimeInterval(pausedSeconds),
            pausedElapsed: pausedAt == nil ? nil : time,
            distanceKm: km,
            paceSeconds: km >= 0.05 ? time / km : nil,
            lastSplitSeconds: lastSplitSeconds,
            routeKm: routeKm,
            gps: gps
        )
    }

    /// Höchstens alle 8 s bzw. alle 20 m aktualisieren; iOS drosselt häufigere Updates ohnehin.
    private func push(force: Bool) {
        guard !runKey.isEmpty, ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let km = distanceKm
        guard force || Date().timeIntervalSince(lastPush) > 8 || abs(km - lastPushedKm) >= 0.02 else { return }
        lastPush = Date()
        lastPushedKm = km
        let state = ActivityContent(state: content(), staleDate: nil)
        let running = Activity<RunActivityAttributes>.activities
        if let current = running.first, current.attributes.title == title {
            Task { await current.update(state) }
            for extra in running.dropFirst() { Task { await extra.end(nil, dismissalPolicy: .immediate) } }
            return
        }
        for old in running { Task { await old.end(nil, dismissalPolicy: .immediate) } }
        do {
            _ = try Activity.request(attributes: RunActivityAttributes(title: title), content: state, pushType: nil)
        } catch {
            NSLog("PULS: Lauf-Live-Aktivität nicht gestartet: \(error)")
        }
    }

    private func end(finished: Bool, finalKm: Double?, finalSeconds: Double?) {
        // Endstand eingefroren: gespeicherte Werte aus dem Formular, keine weiterlaufende Uhr.
        var state = content()
        let seconds = finalSeconds ?? state.pausedElapsed ?? elapsed()
        state.pausedElapsed = seconds
        if let km = finalKm {
            state.distanceKm = km
            state.paceSeconds = km >= 0.05 ? seconds / km : nil
        }
        let finalContent = finished && !runKey.isEmpty ? ActivityContent(state: state, staleDate: nil) : nil
        UserDefaults.standard.removeObject(forKey: announcedKey)
        runKey = ""
        nativeKm = 0
        webKm = 0
        for activity in Activity<RunActivityAttributes>.activities {
            Task {
                // Gespeicherter Lauf: Endstand noch 4 Minuten auf dem Sperrbildschirm, sonst sofort weg.
                await activity.end(finalContent, dismissalPolicy: finalContent != nil ? .after(Date().addingTimeInterval(240)) : .immediate)
            }
        }
    }

    private func requestNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func notifyKilometer(_ km: Int, split: Double, total: Double) {
        let content = UNMutableNotificationContent()
        content.title = "Kilometer \(km) 🏃"
        let pace = RunActivityAttributes.ContentState.pace(split)
        let average = RunActivityAttributes.ContentState.pace(total / Double(km))
        content.body = "Letzter km \(pace) /km · Ø \(average) /km · \(RunActivityAttributes.ContentState.clock(total)) gesamt"
        content.sound = .default
        content.threadIdentifier = "puls-run"
        let request = UNNotificationRequest(identifier: "puls-run-km-\(km)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
