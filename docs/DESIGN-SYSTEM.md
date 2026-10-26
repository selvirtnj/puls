# PULS Designsystem (Redesign ab 25.10.2026)

Verbindliche Entscheidung von Selvir. Grundlage: Apple Human Interface Guidelines (Skill `apple-design`, lokal unter `~/.claude/skills/apple-design`), angewendet auf die Web-App. Bei Widerspruch zwischen HIG/Skill und dieser Datei gilt diese Datei.

## Grundsätze

- Ruhig, klar, iOS-nah: gruppierte Listen wie in den iOS-Einstellungen, klare Hierarchie über Schriftgröße und -gewicht, viel Luft.
- Ein Farbschema-Schalter: **System** (Standard), **Hell**, **Dunkel**. Keine weiteren Designs, keine wählbaren Akzentfarben.
- Eine Akzentfarbe: Apple-Blau, hell `#007AFF`, dunkel `#0A84FF`. Systemfarben (Grün, Orange, Rot) nur mit Bedeutung (erreicht, Warnung, Fehler).
- Hintergrund hell `#F2F2F7`, Flächen `#FBFBFD`; dunkel `#000000`/`#1C1C1E`/`#2C2C2E` im Apple-Stil. Trennung durch Haarlinien (0.5px, Separator-Farbe), nicht durch Schatten.
- Schrift: System-Schrift (`-apple-system, BlinkMacSystemFont, system-ui, sans-serif`), kein Webfont. Typo-Stufen nach iOS (Large Title 34, Title 28/22/20, Headline 17 semibold, Body 17, Callout 16, Subhead 15, Footnote 13, Caption 12). Zahlen mit `font-variant-numeric: tabular-nums`.
- Radien: Buttons und Eingabefelder 8px, Karten und gruppierte Listen 12px. Nichts darüber.
- Icons: Phosphor (Regular), als Inline-SVG lokal im Code, ohne CDN. Jedes rein grafische Bedienelement hat ein `aria-label`.
- Bewegung: nur Sheet hochgleiten (iOS-artig), einmaliges kurzes Füllen von Fortschrittsringen und das Ausblenden des Startbildschirms (mind. 1,2 s sichtbar, 250 ms Fade). `prefers-reduced-motion` schaltet alles ab.
- Dezimalfelder sind `type=text inputmode=decimal`; Komma wird als Dezimaltrenner akzeptiert, gespeichert wird eine Zahl.
- Tippflächen mindestens 44 × 44 px. Safe Areas beachten. Mindestens 390 × 844 prüfen.

## Verboten

Kein Purple-Gradient, kein vager Hero-Text, keine Fake-Zähler, keine Fake-Metriken, keine Scroll-Animationen, keine Pill-Buttons, keine Emoji-Icons, keine Cursor-Animation, keine harten Verläufe (generell keine Verläufe), keine Lucide-Icons, kein reines Weiß als Hintergrund, keine Regenbogenfarben, keine Drop Shadows, keine drei Feature-Karten nebeneinander, kein Liquid Glass / `backdrop-filter`, keine Gedankenstriche (—) in Texten, keine Schriften Inter/Geist/Space Grotesk, kein farbiger Streifen links an Karten, keine Bento-Grids, keine weichen großen Radien, keine Skeleton-Loader, keine radialen Orbs, keine Punktraster, keine Sparkle-Icons, keine animierten Pfeile, keine Hover-Animationen, keine Neonfarben, keine Pastellfarben.

## Funktionen aus diesem Redesign

- Passwort anzeigen/verbergen an allen Passwortfeldern (Login/Registrierung, Kontoaktion). Augen-Icon, `aria-pressed`, beim Absenden wieder verborgen.
- Offline: App startet ohne Netz, dezenter Hinweis „Offline, wird später synchronisiert“, Lebensmittel-Katalog wird nach dem ersten Start vollständig gespeichert. Login, Online-Produktsuche, Barcode und Kartenkacheln bleiben online-only.

## Reihenfolge

1. Designsystem, Tab-Leiste, Übersicht, Login, Offline-Hinweis.
2. Ernährung, Training, Laufen, Konto und alle übrigen Bildschirme.
