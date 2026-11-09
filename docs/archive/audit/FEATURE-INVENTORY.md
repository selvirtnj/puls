# Funktionsinventar (Audit Phase 1)

Stand: 26.10.2026, Branch `refactor/comprehensive-app-audit`, App-Version 69. Statisch erhoben (Code lesen, `grep`, Hilfsskript); keine Laufzeitprüfung. Zuordnung der Dateien nach `docs/ARCHITECTURE.md`, Dateinamen und Treffern im Code.

## Funktionsbereiche und Dateien

| Bereich | JS (`js/`) | CSS (`css/`) |
|---|---|---|
| Grundlage, Zustand, `validData()`, Rendern, Sicherung/Import | app.js, enhancements.js, experience.js, personal.js, adaptation.js, i18n.js (DE/EN, wrappt `render`/`openModal`/`toast`) | style.css, finish.css, personal.css |
| Tabs/Screens, Navigation, Plus-Menü, Seitenwechsel | navigation.js, flows.js, page-slide.js, polish.js, compact.js, interactions.js, comfort.js, refinement.js, app-polish.js, design-system.js | navigation.css, flows.css, page-slide.css, polish.css, compact.css, interactions.css, comfort.css, refinement.css, app-polish.css, design-system.css |
| Übersicht (Heute) | app.js `home`, flows.js, activity-overview.js, design-system.js | overview-refresh.css |
| Training (Workouts, Routinen, Sätze, Pausen, Abschluss) | exercise-catalog.js, machine-library.js, exercise-muscles.js, training.js, insights.js, finish.js, workout-polish.js, tracker-tools.js, training-tabs.js, session-focus.js, rest-popup.js, workout-controls.js, training-polish.js, lifecycle.js (Auto-Ende) | workout-polish.css, training-refresh.css, training-tabs.css, session-focus.css, rest-popup.css, workout-controls.css, training-polish.css, exercise-muscles.css |
| Ernährung (Suche, Katalog, Barcode, Foto, Rezepte, Portionen, Wasser) | products.js, recipes.js, portions.js, food-search.js, catalog-search.js, catalog-worker.js (Web Worker, gestartet in lifecycle.js:12), nutrition-input.js, food-upgrade.js, quick-units.js, food-flow.js | food-upgrade.css, quick-units.css, food-refresh.css, food-flow.css |
| Messungen, Gewicht, Fortschritt, Navy-KFA | tracker-tools.js (`measurementsForm`), progress-metrics.js, profile-refresh.js (Profil & Ziele, Körpermaße), insights.js (Auswertung) | progress-metrics.css, profile-refresh.css, visuals.css |
| Lauf / Aktivitäten (GPS, Karte, Metriken, Session) | running.js, run-metrics.js, run-map.js (lädt `js/vendor/leaflet.js` + `css/vendor/leaflet.css` bei Bedarf, run-map.js:8–14), run-session.js, activity-overview.js | running.css |
| Konto / Sync (Supabase) | cloud-config.js, cloud.js, connectivity.js, account-guide.js, account-refresh.js | account-guide.css, account-refresh.css |
| Offline / Service Worker | sw.js (`CACHE='puls-static-69'`, ASSETS enthält alle js/css inkl. vendor), connectivity.js, lifecycle.js | — |
| Designs / Farbschema / Icons | color-scheme.js (im `<head>`), visuals.js, designs-extra.js, flows.js (`appDesigns`, `applyAppDesign`), icons.js, design-system.js | visuals.css, design-system.css |
| Haptik / Ton | haptics.js, interactions.js (`pulsSound`) | — |
| Vorschau-Modus | preview-mode.js | — |
| Native-Bridge (iOS-Hülle) | native-bridge.js (`restStart`, `restCancel`, `workoutActive`), haptics.js (`haptic`), running.js (`runGpsStart`/`runGpsStop`/`runGpsSync`/`runActivity`; Rückruf `window.pulsRunGpsReceive` running.js:152), run-session.js (`runLocate`; Rückruf `window.pulsRunLocateReceive` run-session.js:88), account-refresh.js:58 (App-Icon), insights.js:42, interactions.js:25, nutrition-input.js:8 (webkit-Prüfungen); Feature-Flags über `window.pulsNativeFeatures` | — |

## JS-Ladereihenfolge (`index.html`)

`<head>`: color-scheme.js. `<body>` (58 Dateien, in dieser Reihenfolge):
cloud-config, app, enhancements, products, **recipes (ohne `?v=69`)**, experience, exercise-catalog, training, portions, insights, finish, personal, food-search, catalog-search, navigation, flows, visuals, interactions, polish, compact, preview-mode, lifecycle, workout-polish, comfort, tracker-tools, nutrition-input, adaptation, food-upgrade, i18n, cloud, connectivity, account-guide, quick-units, refinement, progress-metrics, designs-extra, machine-library, account-refresh, profile-refresh, training-tabs, session-focus, rest-popup, workout-controls, exercise-muscles, food-flow, training-polish, app-polish, page-slide, running, run-metrics, run-map, run-session, activity-overview, haptics, native-bridge, icons, design-system.

CSS: 33 Dateien von style.css bis design-system.css (alle `?v=69`).

## Mehrfach definierte / gewrappte globale Funktionen

Erhoben mit Regex-Hilfsskript (Funktionsdeklaration `function X(` plus Zuweisungen `X=function`/`X=(…)=>`), nur Namen, die in mindestens zwei Dateien vorkommen und irgendwo als `function` deklariert sind. Zeilennummern beziehen sich auf die (teils einzeilig verdichteten) Quelltexte. Heuristik: Zuweisungen in Strings/anderen Scopes können vereinzelt mitgezählt sein — STATICALLY VERIFIED ONLY. Erste Fundstelle = Ursprung, letzte = wirksame Definition.

Besonderheiten:
- `settings` ist in app.js:53 **und** enhancements.js:48 als `function`-Deklaration vorhanden (zweite überschreibt ohne Wrapper), danach lifecycle.js:3.
- `applyAppDesign` wird in flows.js:140 und flows.js:154 **ersetzt statt gewrappt** (Kette aus visuals.js wird verworfen); `chooseAppDesign` wird in visuals.js:12 und app-polish.js:4 zu einer leeren Funktion.
- Viele Dateien rufen beim Laden direkt `render()` auf (z. B. flows.js:141, flows.js:154).

| Funktion | Anzahl | Fundstellen (Ladereihenfolge) |
|---|---|---|
| accountPage | 27 | experience.js:21, experience.js:29, finish.js:12, personal.js:13, navigation.js:6, flows.js:61, flows.js:71, flows.js:98, flows.js:105, flows.js:111, flows.js:128, flows.js:139, flows.js:146, visuals.js:13, interactions.js:38, polish.js:11, compact.js:18, preview-mode.js:4, lifecycle.js:18, workout-polish.js:47, comfort.js:25, tracker-tools.js:45, adaptation.js:19, cloud.js:25, account-guide.js:4, refinement.js:10, account-refresh.js:42 |
| validData | 24 | app.js:56, enhancements.js:93, enhancements.js:94, products.js:21, recipes.js:25, experience.js:25, training.js:47, training.js:49, portions.js:14, insights.js:45, personal.js:17, navigation.js:11, flows.js:47, flows.js:84, flows.js:130, interactions.js:39, comfort.js:26, tracker-tools.js:50, adaptation.js:21, food-upgrade.js:78, account-guide.js:15, quick-units.js:14, progress-metrics.js:30, running.js:51 |
| render | 20 | app.js:19, recipes.js:28, experience.js:24, training.js:48, finish.js:14, personal.js:18, navigation.js:9, flows.js:46, flows.js:83, flows.js:129, interactions.js:20, polish.js:7, comfort.js:24, i18n.js:461, training-tabs.js:27, food-flow.js:59, app-polish.js:27, run-session.js:406, native-bridge.js:64, design-system.js:251 |
| nutrition | 15 | app.js:27, products.js:22, recipes.js:27, experience.js:20, insights.js:38, flows.js:20, flows.js:68, flows.js:97, flows.js:137, visuals.js:11, compact.js:17, tracker-tools.js:43, adaptation.js:8, refinement.js:3, designs-extra.js:11 |
| openModal | 14 | app.js:28, products.js:10, flows.js:28, interactions.js:4, polish.js:10, compact.js:14, preview-mode.js:3, workout-polish.js:44, comfort.js:22, i18n.js:462, food-flow.js:12, training-polish.js:6, app-polish.js:24, design-system.js:261 |
| workoutPage | 14 | app.js:44, enhancements.js:77, training.js:46, insights.js:33, finish.js:9, personal.js:12, flows.js:51, flows.js:138, flows.js:143, tracker-tools.js:44, account-guide.js:5, refinement.js:5, training-polish.js:43, running.js:282 |
| home | 11 | app.js:26, enhancements.js:67, experience.js:19, portions.js:13, insights.js:39, flows.js:19, flows.js:136, adaptation.js:18, refinement.js:4, designs-extra.js:10, design-system.js:79 |
| profileForm | 9 | enhancements.js:49, experience.js:7, experience.js:30, flows.js:75, flows.js:81, lifecycle.js:4, workout-polish.js:45, adaptation.js:10, profile-refresh.js:73 |
| foodForm | 7 | app.js:29, products.js:13, recipes.js:6, experience.js:14, interactions.js:14, food-upgrade.js:42, food-flow.js:36 |
| searchFoods | 7 | app.js:31, personal.js:6, food-search.js:5, catalog-search.js:4, lifecycle.js:17, food-upgrade.js:73, food-flow.js:51 |
| selectFood | 7 | app.js:32, products.js:19, portions.js:6, flows.js:22, food-upgrade.js:55, quick-units.js:11, food-flow.js:143 |
| addFood | 7 | app.js:36, products.js:20, recipes.js:21, flows.js:24, nutrition-input.js:19, food-upgrade.js:57, quick-units.js:13 |
| dataSettings | 7 | enhancements.js:68, experience.js:27, lifecycle.js:4, workout-polish.js:46, tracker-tools.js:46, adaptation.js:20, profile-refresh.js:76 |
| workoutCard | 7 | training.js:32, insights.js:31, personal.js:11, flows.js:37, flows.js:57, lifecycle.js:9, training-polish.js:56 |
| setValue | 6 | app.js:46, enhancements.js:78, training.js:37, interactions.js:40, workout-polish.js:25, tracker-tools.js:42 |
| finishWorkout | 6 | app.js:51, training.js:40, insights.js:30, flows.js:39, interactions.js:41, workout-controls.js:24 |
| updatePlanPreview | 6 | enhancements.js:50, enhancements.js:97, experience.js:9, flows.js:82, adaptation.js:12, profile-refresh.js:74 |
| exerciseCard | 6 | training.js:33, insights.js:32, flows.js:36, compact.js:15, workout-polish.js:15, tracker-tools.js:41 |
| renderWorkoutSession | 6 | flows.js:33, interactions.js:19, workout-polish.js:12, session-focus.js:3, workout-controls.js:46, run-session.js:428 |
| completionHtml | 6 | flows.js:43, flows.js:59, interactions.js:34, workout-polish.js:7, tracker-tools.js:49, training-polish.js:35 |
| toast | 5 | app.js:13, finish.js:3, interactions.js:36, i18n.js:463, rest-popup.js:31 |
| go | 5 | app.js:18, experience.js:23, polish.js:6, account-refresh.js:63, page-slide.js:3 |
| showSearch | 5 | app.js:30, food-search.js:4, catalog-search.js:3, food-upgrade.js:76, food-flow.js:41 |
| foodTab | 5 | products.js:14, recipes.js:7, interactions.js:13, food-upgrade.js:43, food-flow.js:37 |
| quickTraining | 5 | experience.js:15, training.js:23, flows.js:50, flows.js:114, running.js:304 |
| analyticsPage | 5 | insights.js:23, flows.js:121, workout-polish.js:6, progress-metrics.js:29, running.js:302 |
| nutritionSlides | 5 | flows.js:7, flows.js:66, flows.js:91, flows.js:101, design-system.js:208 |
| designChooser | 5 | flows.js:125, flows.js:153, interactions.js:37, designs-extra.js:13, design-system.js:280 |
| applyAppDesign | 5 | flows.js:127, flows.js:140, flows.js:154, visuals.js:8, designs-extra.js:12 |
| openExerciseOrder | 5 | workout-polish.js:19, comfort.js:11, tracker-tools.js:37, tracker-tools.js:38, refinement.js:6 |
| save | 4 | app.js:12, insights.js:44, cloud.js:13, native-bridge.js:63 |
| macroCard | 4 | app.js:20, flows.js:63, flows.js:95, flows.js:102 |
| previewFood | 4 | app.js:33, personal.js:14, quick-units.js:12, food-flow.js:140 |
| customFood | 4 | app.js:34, portions.js:10, food-upgrade.js:19, food-flow.js:177 |
| addCustom | 4 | app.js:35, portions.js:11, food-upgrade.js:20, food-flow.js:178 |
| importData | 4 | app.js:57, enhancements.js:95, recipes.js:26, flows.js:78 |
| commitProfile | 4 | enhancements.js:51, experience.js:10, flows.js:80, adaptation.js:13 |
| routinesPage | 4 | enhancements.js:80, training.js:17, flows.js:38, flows.js:58 |
| startRoutine | 4 | enhancements.js:87, training.js:20, flows.js:34, interactions.js:31 |
| mapOffProduct | 4 | products.js:7, portions.js:3, flows.js:53, food-upgrade.js:48 |
| productReview | 4 | products.js:17, portions.js:8, food-upgrade.js:17, food-flow.js:172 |
| confirmProduct | 4 | products.js:18, portions.js:9, food-upgrade.js:18, food-flow.js:173 |
| progressChart | 4 | experience.js:18, flows.js:89, flows.js:119, design-system.js:78 |
| workoutSummary | 4 | insights.js:29, finish.js:11, flows.js:44, training-polish.js:34 |
| quickAddMenu | 4 | navigation.js:4, quick-units.js:20, refinement.js:9, app-polish.js:19 |
| chooseAppDesign | 4 | flows.js:126, flows.js:141, visuals.js:12, app-polish.js:4 |
| settings | 3 | app.js:53, enhancements.js:48, lifecycle.js:3 |
| collectPlan | 3 | enhancements.js:27, experience.js:8, adaptation.js:11 |
| renderRoutineItems | 3 | enhancements.js:82, training.js:15, workout-polish.js:16 |
| recipesPanel | 3 | recipes.js:9, nutrition-input.js:18, food-flow.js:186 |
| trendData | 3 | experience.js:17, flows.js:88, flows.js:93 |
| exerciseOptions | 3 | training.js:5, personal.js:5, machine-library.js:63 |
| exercisePicker | 3 | training.js:7, machine-library.js:66, training-polish.js:8 |
| renderExerciseOptions | 3 | training.js:8, machine-library.js:67, training-polish.js:16 |
| startEmptyWorkout | 3 | training.js:22, flows.js:35, interactions.js:32 |
| tickWorkoutClocks | 3 | training.js:42, insights.js:43, rest-popup.js:33 |
| editDiaryFood | 3 | finish.js:7, personal.js:15, flows.js:26 |
| nameProfile | 3 | personal.js:7, flows.js:73, flows.js:108 |
| saveNameProfile | 3 | personal.js:8, flows.js:74, flows.js:109 |
| searchFoodDatabase | 3 | food-search.js:6, food-upgrade.js:77, food-flow.js:68 |
| chooseCatalogueFood | 3 | catalog-search.js:5, food-upgrade.js:56, food-flow.js:144 |
| workoutIdentity | 3 | navigation.js:5, flows.js:45, workout-polish.js:5 |
| nutritionSlideChanged | 3 | flows.js:10, flows.js:104, design-system.js:212 |
| waterCard | 3 | flows.js:13, flows.js:145, app-polish.js:55 |
| confirmWorkoutFinish | 3 | flows.js:40, interactions.js:33, workout-polish.js:11 |
| dailyWorkoutStreak | 3 | flows.js:41, workout-polish.js:4, running.js:38 |
| dismissSheet | 3 | interactions.js:3, account-guide.js:11, app-polish.js:7 |
| setDate | 2 | app.js:14, experience.js:36 |
| removeEntry | 2 | app.js:37, finish.js:4 |
| weightPage | 2 | app.js:40, enhancements.js:67 |
| startWorkout | 2 | app.js:42, training.js:21 |
| createWorkout | 2 | app.js:43, enhancements.js:79 |
| exerciseForm | 2 | app.js:49, training.js:25 |
| addExercise | 2 | app.js:50, enhancements.js:79 |
| reopenWorkout | 2 | app.js:52, training.js:41 |
| energyFor | 2 | enhancements.js:8, adaptation.js:5 |
| baselineEnergyLine | 2 | enhancements.js:19, activity-overview.js:69 |
| planNumbers | 2 | enhancements.js:25, experience.js:5 |
| goalCard | 2 | enhancements.js:66, experience.js:26 |
| routineForm | 2 | enhancements.js:81, training.js:13 |
| recordsPage | 2 | enhancements.js:91, insights.js:34 |
| stopBarcode | 2 | products.js:8, food-flow.js:149 |
| barcodePanel | 2 | products.js:15, food-flow.js:148 |
| startBarcodeCamera | 2 | products.js:44, food-flow.js:152 |
| renderRecipeEditor | 2 | recipes.js:11, food-flow.js:187 |
| renderRecipeIngredients | 2 | recipes.js:12, food-flow.js:188 |
| recipePreview | 2 | recipes.js:13, food-flow.js:189 |
| recipeIngredientPicker | 2 | recipes.js:14, food-flow.js:191 |
| filterRecipeIngredients | 2 | recipes.js:15, food-flow.js:192 |
| chooseRecipe | 2 | recipes.js:20, food-flow.js:145 |
| adaptiveGoals | 2 | experience.js:6, adaptation.js:14 |
| generalEntries | 2 | experience.js:13, finish.js:6 |
| startQuickTraining | 2 | experience.js:16, training.js:24 |
| restCard | 2 | training.js:31, workout-controls.js:40 |
| trainingCalendar | 2 | training.js:45, running.js:288 |
| completedWorkouts | 2 | insights.js:2, lifecycle.js:8 |
| bookFor | 2 | insights.js:6, exercise-muscles.js:53 |
| workoutAwards | 2 | insights.js:8, running.js:35 |
| trainingStreak | 2 | insights.js:11, running.js:44 |
| muscleChart | 2 | insights.js:22, exercise-muscles.js:65 |
| suggestedFoods | 2 | insights.js:35, finish.js:16 |
| saveDiaryAmount | 2 | finish.js:8, flows.js:25 |
| globalRestSettings | 2 | personal.js:9, workout-controls.js:70 |
| nutrientTotals | 2 | flows.js:4, app-polish.js:49 |
| compactDiary | 2 | flows.js:17, compact.js:4 |
| weeklyWeightCard | 2 | flows.js:70, profile-refresh.js:126 |
| themedFoodActions | 2 | visuals.js:9, compact.js:16 |
| pulsSound | 2 | interactions.js:24, haptics.js:17 |
| pulsIcon | 2 | polish.js:3, icons.js:104 |
| swipeDiaryEntry | 2 | compact.js:3, comfort.js:21 |
| fallbackCatalogueSearch | 2 | lifecycle.js:14, food-upgrade.js:68 |
| appearanceSettings | 2 | comfort.js:9, account-refresh.js:61 |
| moveOrderPosition | 2 | comfort.js:12, refinement.js:21 |
| stopOrderDrag | 2 | comfort.js:16, refinement.js:25 |
| measurementsForm | 2 | tracker-tools.js:11, profile-refresh.js:113 |
| parseFoodLine | 2 | nutrition-input.js:4, food-upgrade.js:82 |
| textFoodMatches | 2 | nutrition-input.js:5, food-upgrade.js:83 |
| parseTextFoods | 2 | nutrition-input.js:6, food-upgrade.js:84 |
| logTextFood | 2 | nutrition-input.js:7, food-upgrade.js:87 |
| markFoodDayComplete | 2 | adaptation.js:7, app-polish.js:57 |
| photoFoodPanel | 2 | food-upgrade.js:24, food-flow.js:182 |
| reviewLabelText | 2 | food-upgrade.js:37, food-flow.js:183 |
| attachFoodExtras | 2 | food-upgrade.js:50, food-flow.js:141 |
| saveHouseholdPortion | 2 | food-upgrade.js:54, food-flow.js:142 |
| foodResultHTML | 2 | food-upgrade.js:71, food-flow.js:45 |
| showFoodCollection | 2 | food-upgrade.js:75, food-flow.js:48 |
| syncFoodQuantity | 2 | quick-units.js:7, food-flow.js:137 |
| changeFoodQuantityUnit | 2 | quick-units.js:8, food-flow.js:138 |
| applyFoodQuantity | 2 | quick-units.js:9, food-flow.js:136 |
| setFoodDensity | 2 | quick-units.js:10, food-flow.js:139 |
| accountAppearanceCard | 2 | account-refresh.js:56, design-system.js:277 |
| runIcon | 2 | run-session.js:35, design-system.js:198 |

## Verdacht: nicht geladene oder ungenutzte Dateien/Code

Dateiebene: Alle 60 `js/*.js` und 33 `css/*.css` werden genutzt — 59 JS (1 im `<head>`, 58 im `<body>`) und 33 CSS direkt über `index.html`, dazu `js/catalog-worker.js` als Web Worker (lifecycle.js:12) und `js/vendor/leaflet.js` / `css/vendor/leaflet.css` per Lazy-Load (run-map.js:8–14). Alle stehen in der `ASSETS`-Liste von `sw.js`. **Keine vollständig verwaiste Datei gefunden.**

Verdacht auf toten Code innerhalb von Dateien (STATICALLY VERIFIED ONLY, vor Entfernung im Browser prüfen):
1. **Design-Varianten:** Laut CURRENT-STATE (Version 53) nur noch Originaldesign; `chooseAppDesign` ist zweimal zur leeren Funktion gemacht (visuals.js:12, app-polish.js:4), `applyAppDesign` wird in flows.js:140/154 ersetzt. Damit sind Teile von flows.js (`appDesigns`, `designChooser`), visuals.js, designs-extra.js und designbezogene CSS-Regeln vermutlich wirkungslos. `designChooser(` kommt nur in flows.js vor (2 Treffer).
2. **Überschriebene Grundfunktionen:** Erste Definitionen vieler Funktionen in app.js/enhancements.js (z. B. `settings` app.js:53, dann enhancements.js:48, dann lifecycle.js:3) werden vollständig ersetzt, nicht gewrappt; deren Körper wäre dann toter Code. Pro Funktion ist zu prüfen, ob eine spätere Fassung die frühere noch aufruft.
3. **Mehrfaches `render()` beim Laden:** viele Dateien rufen am Dateiende `render()` auf (z. B. flows.js:141, flows.js:154) — kein toter Code, aber unnötige Startarbeit.
