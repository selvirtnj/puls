import SwiftUI
import PULSCore

// M8/S: nativer Konto-Tab. Seitentitel („Konto“ bzw. Unterseite) steht im gemeinsamen Seitenkopf (`ShellHeader`);
// Unterseiten liegen im selben NavigationStack und zeigen nur den Zurück-Knopf.

struct AccountHost: View {
    let coordinator: AccountCoordinator

    var body: some View {
        AccountScreen(coordinator: coordinator)
            .environment(coordinator.store)
    }
}

struct AccountScreen: View {
    @Bindable var coordinator: AccountCoordinator
    @State private var showWebFallback = false

    var body: some View {
        let text = coordinator.text
        NavigationStack(path: $coordinator.path) {
            Group {
                if let projection = coordinator.projection {
                    AccountOverviewList(coordinator: coordinator, projection: projection)
                } else {
                    loading(text)
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(text("Konto", "Account"))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AccountRoute.self) { route in
                AccountRoutePage(coordinator: coordinator, route: route)
                    .navigationTitle("")
                    .navigationBarTitleDisplayMode(.inline)
                    .background(Color(.systemGroupedBackground))
            }
        }
        .environment(\.locale, text.locale)
        .environment(\.calendar, WeightDay.calendar())
        .tint(.blue)
        .sheet(item: $coordinator.sheet) { sheet in
            AccountSheetView(coordinator: coordinator, sheet: sheet)
        }
        .alert(text("Hinweis", "Notice"),
               isPresented: Binding(get: { coordinator.notice != nil }, set: { if !$0 { coordinator.notice = nil } })) {
            if let action = coordinator.noticeWebAction {
                Button(text("Im Web öffnen", "Open in the web view")) { coordinator.openWeb(action) }
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text(coordinator.notice?.text ?? "")
        }
    }

    /// Nie eine Sackgasse: nach etwa 3 s ohne Projektion die Web-Kontoseite anbieten.
    private func loading(_ text: OverviewText) -> some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(text("Konto wird geladen …", "Loading account …"))
                .foregroundStyle(.secondary)
            if showWebFallback {
                Button(text("Konto im Web öffnen", "Open account in the web view")) { coordinator.onOpenWeb?(.overview) }
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            showWebFallback = false
            try? await Task.sleep(for: .seconds(3))
            showWebFallback = true
        }
    }
}

// MARK: - Übersicht

struct AccountOverviewList: View {
    @Environment(ProfileStore.self) private var store
    let coordinator: AccountCoordinator
    let projection: AccountProjection

    var body: some View {
        let text = coordinator.text
        List {
            identitySection(text)
            AccountStatusSection(coordinator: coordinator, projection: projection)
            Section {
                ForEach(AccountRoute.allCases) { route in
                    NavigationLink(value: route) {
                        sectionRow(route, text: text)
                    }
                }
            }
            AccountCommandsSection(coordinator: coordinator)
        }
        .listStyle(.insetGrouped)
    }

    private func identitySection(_ text: OverviewText) -> some View {
        let identity = projection.identity
        let name = coordinator.displayName
        return Section {
            HStack(spacing: 14) {
                AccountAvatarView(data: coordinator.avatarData, name: name)
                VStack(alignment: .leading, spacing: 4) {
                    Text(name.isEmpty ? text("Ohne Namen", "No name") : name)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2)
                    if let level = identity.level {
                        Text(levelLine(identity, level: level, text: text))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .padding(.vertical, 4)
            if coordinator.can(AccountOps.nameSet) || coordinator.can(AccountOps.avatarSet) {
                Button(text("Name & Profilbild bearbeiten", "Edit name & picture")) { coordinator.sheet = .identity }
            } else if coordinator.offers("accountAvatar") {
                AccountWebRow(title: text("Name & Profilbild im Web bearbeiten", "Edit name & picture in the web view"),
                              symbol: "person.crop.circle", text: text) { coordinator.openWeb("accountAvatar") }
            }
            if coordinator.avatarOmittedWithoutImage, coordinator.offers("accountAvatar") {
                AccountWebRow(title: text("Profilbild ist zu groß für die Vorschau, im Web ansehen", "Picture too large to preview, view in the web view"),
                              symbol: "photo", text: text) { coordinator.openWeb("accountAvatar") }
            }
        }
    }

    private func levelLine(_ identity: AccountIdentity, level: Int, text: OverviewText) -> String {
        var parts = ["Level \(level)"]
        if let current = identity.current, let needed = identity.needed {
            parts.append("\(text.integer(current))/\(text.integer(needed)) XP")
        }
        if let streak = identity.streak {
            parts.append(text("Serie \(streak)", "Streak \(streak)"))
        }
        return parts.joined(separator: " · ")
    }

    private func sectionRow(_ route: AccountRoute, text: OverviewText) -> some View {
        let section = projection.section(route.rawValue)
        return HStack(spacing: 12) {
            Image(systemName: route.symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(.blue)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(section?.title ?? text.accountSectionTitle(route.rawValue) ?? route.rawValue)
                if let note = section?.note, !note.isEmpty {
                    Text(note).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

/// Cloud-/Recovery-Status ohne E-Mail oder Tokens. Entscheidungen fallen im Web.
struct AccountStatusSection: View {
    let coordinator: AccountCoordinator
    let projection: AccountProjection

    var body: some View {
        let text = coordinator.text
        let cloud = projection.cloud
        let recovery = projection.recovery
        Section {
            Label(cloudLine(cloud, text: text), systemImage: cloud.signedIn ? "checkmark.icloud" : "iphone")
            if cloud.busy {
                Label(text("Synchronisierung läuft …", "Syncing …"), systemImage: "arrow.triangle.2.circlepath")
            } else if cloud.signedIn, cloud.dirty, !cloud.conflict, !cloud.uploadBlocked {
                Label(text("Änderungen werden hochgeladen, sobald möglich.", "Changes will be uploaded when possible."),
                      systemImage: "icloud.and.arrow.up")
            }
            if cloud.conflict {
                Label(text("Konflikt: Gerät und Konto haben unterschiedliche Stände. Bitte in PULS den Stand wählen.",
                           "Conflict: device and account differ. Please choose the version in PULS."),
                      systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                if coordinator.offers("accountConflict") {
                    AccountWebRow(title: text("Stand auswählen", "Choose version"), symbol: "arrow.left.arrow.right", text: text) {
                        coordinator.openWeb("accountConflict")
                    }
                }
            }
            if recovery.needsAttention || cloud.uploadBlocked {
                Label(recoveryLine(recovery, cloud: cloud, text: text), systemImage: "lock.fill")
                    .foregroundStyle(.orange)
                if coordinator.offers("accountRecovery") {
                    AccountWebRow(title: text("Sicherung & Wiederherstellung öffnen", "Open backup & recovery"),
                                  symbol: "lifepreserver", text: text) { coordinator.openWeb("accountRecovery") }
                }
            }
            if coordinator.isPreview {
                Label(text("Vorschau: nur zur Ansicht.", "Preview: view only."), systemImage: "eye")
            } else if !coordinator.canWrite {
                Label(text("Gerade nur lesbar. Änderungen sind gesperrt, bis der Stand geklärt ist.",
                           "Read only right now. Changes are locked until the version is resolved."), systemImage: "lock")
            }
            if !cloud.signedIn, cloud.configured, !coordinator.isPreview, coordinator.offers("accountSignIn") {
                AccountWebRow(title: text("Bei PULS anmelden", "Sign in to PULS"), symbol: "person.crop.circle.badge.plus", text: text) {
                    coordinator.openWeb("accountSignIn")
                }
            }
        } header: {
            Text(text("Konto & Synchronisierung", "Account & sync"))
        }
        .font(.subheadline)
    }

    private func cloudLine(_ cloud: AccountCloud, text: OverviewText) -> String {
        if cloud.signedIn { return text("Mit deinem PULS-Konto verbunden", "Connected to your PULS account") }
        if cloud.configured { return text("Nicht angemeldet: Daten nur auf diesem Gerät", "Not signed in: data only on this device") }
        return text("Daten nur auf diesem Gerät", "Data only on this device")
    }

    private func recoveryLine(_ recovery: AccountRecovery, cloud: AccountCloud, text: OverviewText) -> String {
        if recovery.corrupt {
            return text("Gespeicherte Daten waren beschädigt. Hochladen ist gesperrt, bis du in PULS einen Stand wählst.",
                        "Saved data was damaged. Upload is locked until you choose a version in PULS.")
        }
        if recovery.pending {
            return text("Wiederherstellung offen. Hochladen ist gesperrt.", "Recovery pending. Upload is locked.")
        }
        if recovery.uploadBlocked || cloud.uploadBlocked {
            return text("Hochladen ist gesperrt, bis der Stand geklärt ist.", "Upload is locked until the version is resolved.")
        }
        return text("Konfliktsicherungen sind vorhanden.", "Conflict backups are available.")
    }
}

/// Geparkte bzw. abgelehnte eigene Kontobefehle (Konflikt, anderes Konto) mit klarer Wahl.
struct AccountCommandsSection: View {
    let coordinator: AccountCoordinator

    var body: some View {
        let text = coordinator.text
        let entries = coordinator.conflicts + coordinator.parkedCommands
        if !entries.isEmpty {
            Section {
                ForEach(entries, id: \.command.id) { entry in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(coordinator.commandTitle(entry)).font(.headline)
                        Text(entry.status == .parked(.conflict)
                             ? text("Inzwischen auf einem anderen Weg geändert. Deine Änderung wurde nicht übernommen.",
                                    "Changed elsewhere in the meantime. Your change was not applied.")
                             : text("Zurückgehalten (anderes Konto oder ältere PULS-Version).",
                                    "Held back (other account or older PULS version)."))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack {
                            Button(text("Verwerfen", "Discard"), role: .destructive) { coordinator.discard(id: entry.command.id) }
                            if entry.status == .parked(.conflict), ProfileStore.canReapplyAccount(op: entry.command.op) {
                                Spacer()
                                Button(text("Meine Änderung übernehmen", "Use my change")) { coordinator.reapply(id: entry.command.id) }
                            }
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text(text("Offene Änderungen", "Pending changes"))
            }
        }
    }
}

// MARK: - Unterseiten

struct AccountRoutePage: View {
    let coordinator: AccountCoordinator
    let route: AccountRoute
    @State private var showWebFallback = false

    var body: some View {
        if let projection = coordinator.projection {
            switch route {
            case .plan: AccountPlanPage(coordinator: coordinator, projection: projection)
            case .body: AccountBodyPage(coordinator: coordinator, projection: projection)
            case .adaptive: AccountAdaptivePage(coordinator: coordinator, projection: projection)
            case .design: AccountDesignPage(coordinator: coordinator, projection: projection)
            case .sounds: AccountSoundPage(coordinator: coordinator, projection: projection)
            case .manage: AccountManagePage(coordinator: coordinator, projection: projection)
            }
        } else {
            // Nie eine Sackgasse: nach etwa 3 s ohne Projektion dieselbe Unterseite im Web anbieten.
            let text = coordinator.text
            VStack(spacing: 16) {
                ProgressView()
                if showWebFallback {
                    Text(text("Diese Seite lädt gerade nicht.", "This page is not loading right now."))
                        .foregroundStyle(.secondary)
                    Button(text("Im Web öffnen", "Open in the web view")) { coordinator.openWebSection(route) }
                        .buttonStyle(.borderedProminent)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .task {
                showWebFallback = false
                try? await Task.sleep(for: .seconds(3))
                if !Task.isCancelled { showWebFallback = true }
            }
        }
    }
}

struct AccountSheetView: View {
    let coordinator: AccountCoordinator
    let sheet: AccountSheet

    var body: some View {
        Group {
            switch sheet {
            case .identity: AccountIdentitySheet(coordinator: coordinator)
            case .profile: AccountProfileSheet(coordinator: coordinator)
            case .plan: AccountPlanSheet(coordinator: coordinator)
            case .measurement(let date): AccountMeasurementSheet(coordinator: coordinator, initialDate: date)
            }
        }
        .environment(coordinator.store)
        .environment(\.locale, coordinator.text.locale)
        .environment(\.calendar, WeightDay.calendar())
        .tint(.blue)
    }
}
