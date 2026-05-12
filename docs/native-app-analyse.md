# amux — Native-App-Analyse (iOS)

> Analyse vom 2026-05-11. Frage des Auftraggebers: *"Was hat amux für Features, und wie baue ich eine simple App, die nativ funktioniert? UI wiederverwenden oder nativ nachbauen? Wichtig: festgenagelt auf iOS-Screen, nicht so flexibel wie PWA."*

---

## TL;DR

- **Bestehende `ios/AmuxApp/` ist genau dieser Ansatz** — ein dünner SwiftUI-Wrapper um `WKWebView` (siehe `ios/PLAN.md`). Die Strategie ist richtig, der Wrapper ist nur noch nicht "festgenagelt" genug.
- **Empfehlung: Variante A — WKWebView-Shell, aber locked-down.** Die PWA-UI (~25k Zeilen HTML/JS in `amux-server.py`) komplett nachzubauen ist ein 6-12-Monate-Projekt für 134 REST-Routen + SSE + Service-Worker-Logik. Nicht zu rechtfertigen für "simple App".
- Der Gewinn entsteht aus **6 konkreten WebView-Härtungen** (Bounce aus, Callouts aus, Pinch aus, Long-Press aus, eigener UA-Lock, In-App-Browser-Fallback für externe Links) plus optional **3 nativen Add-ons** (Push, Haptics, Auth-Schutz).
- Variante B (hybrider Native-TabBar + WebView-Slot) lohnt sich erst, wenn Native-Notifications & ein "Quick-Send"-Widget so wichtig werden, dass sie eine eigene UI rechtfertigen.

---

## 1. Was amux heute kann (Feature-Inventar)

Quelle: `amux-server.py` (Monolith, 37 506 Zeilen) + `CLAUDE.md` + `README.md` + `.claude/rules/`.

### 1.1 Agent-Steuerung (Sessions)
- CRUD + Lifecycle: `POST/GET /api/sessions`, `start | stop | archive | wake | delete | clone | duplicate | fork`
- Live-Interaktion: `peek`, `send`, `steer`, `keys`, `clear`, `config`, `info`, `meta`, `stats`, `share`
- Git pro Session: `git`, `git/commits`, `git/commit-detail`, `git/diff`, `git-push`, `tracked-files`, `sessions-git` (bulk)
- Selbstheilung im Server: Auto-`/compact`, Restart bei `redacted_thinking`, Auto-Continue
- Token-Tracking pro Session/Tag (Cache-Reads separat)

### 1.2 Kanban-Board
- `/api/board`, `/api/board/<id>`, `/api/board/<id>/claim` (atomic CAS-Claim), `clear-done`, `statuses`, `statuses/reorder`, `tag-completion`
- iCal-Export: `/api/calendar.ics` (+ optional S3-Public-Mirror)

### 1.3 Notes & Channels
- Notes: `/api/notes`, `/api/notes/<key>`, `/api/notes/trash` — Markdown mit Quill-Editor, Find-in-Page
- Channels: `/api/channels` — 1:1-Inter-Session-Chat mit `@mentions`

### 1.4 CRM
- Contacts (`/api/crm/contacts`), Interactions, Follow-ups (`/api/crm/followups`)

### 1.5 Tools
- **Email/Gmail-Integration:** OAuth (`auth`, `callback`, `accounts`, `connect`), `inbox`, `labels`, `send`, `reply`, `search`, `sync`, `events`
- **Browser-Automation:** Playwright-shared `start | navigate | screenshot | state | action | search | stop`, `pw-profiles`, `save-profile`, `agent`-Mode
- **Skills/Slash-Commands:** `/api/skills`, `/api/slash-commands` (projektlokale Custom-Commands)
- **Scheduler:** `/api/schedules`, `/api/schedules/runs`, `/api/schedules/preview` (Cron-style)
- **Reports:** `/api/reports`, `/api/reports/types`, `/api/dashboard/spend`, `/api/dashboard/posthog`
- **Filesystem:** `/api/ls`, `/api/fs/open|upload|delete`, `/api/file` (read/write/raw/vtt/transcode)
- **Logs:** `/api/logs`, `/api/logs/raw`, `/api/logs/stats`, `/api/log-search`
- **Recordings, TTS, Map (Leaflet), Habits, Notifications, Journal, Torrents** (jeweils dedizierte Endpoints)

### 1.6 Auth / Identity / Multi-Tenant
- `/api/identity`, `/api/cloud-logout`, `/api/gateway/orgs`, `/api/gateway/switch-org`
- Org-Mgmt: `/api/org`, `/api/org/members`, `/api/org/invites`
- Cloud-Variante via Clerk hinter Gateway; lokal ohne Auth (Tailscale/LAN-Bind)

### 1.7 PWA-Kern
- **Manifest** `/manifest.json` (display=standalone, theme=#0d1117)
- **Service-Worker** `/sw.js` — cache-first + LocalStorage-Fallback für Mehr-Tages-Offline
- **SSE-Live-Updates** `/api/events` (Ping alle 10s, Client-Stale-Detection nach 18s, polling-Fallback)
- **PostHog-Telemetrie** inkl. Session-Replay, Rage-Click, Exception-Capture

### 1.8 Dashboard-UI
- Inline-HTML/CSS/JS in `amux-server.py` (~25k Zeilen JS, ~3k CSS, gridstack-Layout-Engine, Quill, Leaflet, xterm.js)
- Layout-Presets (`/api/layout-presets`) — User kann eigene Tile-Layouts speichern
- Custom-Branding (Name/Tagline/Color/Icon über Prefs persistiert)

> **Konsequenz für die App-Strategie:** Diese Feature-Breite (≈140 Routen, 6 eingebettete JS-Libs, SSE+Service-Worker) ist in keiner sinnvollen Zeit nativ replizierbar. Eine native App muss **das Web-Frontend benutzen** — die einzige Frage ist *wie eingerahmt*.

---

## 2. Was schon da ist: `ios/AmuxApp/`

`ios/PLAN.md` + 5 Swift-Files = funktionierender WKWebView-Wrapper. Live im App-Store (`io.amux.app`, 1.1.0, Bundle aktuell noch `com.EthanSteininger.nextup`).

| Datei | Inhalt |
|---|---|
| `AmuxApp.swift` | `@main` Entry, schaltet zwischen `ServerPickerView` und `ContentView` je nach UserDefaults |
| `ContentView.swift` | WKWebView + Error-Overlay (Retry/Switch-Server) + Long-Press → Settings-Sheet |
| `WebView.swift` | `UIViewRepresentable`-Wrapper, JS-Console-Bridge, Self-Signed-Cert-Trust, Pull-to-Refresh, External-Link-Delegation, `window.open`-Hijack, Process-Crash-Reload |
| `ServerManager.swift` | UserDefaults-Liste mehrerer Server (Cloud / Tailscale / Custom), Online-Status-Ping über `/api/release-notes` |
| `ServerPickerView.swift` | Onboarding: "amux cloud" + Self-Hosted-URL-Feld |

**Was schon "nagelt"**
- `preferredColorScheme(.dark)` — kein Light-Mode-Flip
- Portrait-only auf iPhone (`UIInterfaceOrientationPortrait*` in `project.yml`)
- `customUserAgent` mit `" AmuxApp"`-Suffix → Server kann Variante erkennen
- `decidePolicyFor`: externe Links (linkActivated zu fremdem Host) gehen via `UIApplication.shared.open(url)` raus
- Self-Signed-Cert wird für alles akzeptiert, was **nicht** `*.amux.io` ist
- Pull-to-Refresh via `UIRefreshControl`
- JS `console.log/warn/error` → `os_log` (debugbar via Console.app)

**Was noch zu "PWA-flexibel" ist**
1. Rubber-Band-Bounce nach oben/unten (zeigt grauen Hintergrund unter der UI)
2. Pinch-to-Zoom prinzipiell aktiv (zwar via Viewport-Meta `maximum-scale=1` gebremst, aber WebKit kann es trotzdem zulassen)
3. iOS-Long-Press-Callout (Copy/Share/Look-Up auf Links/Bildern) ist global an
4. Text-Selection auf nicht-Editor-Bereichen
5. Horizontal-Scroll wenn Content > Viewport
6. `dataDetectorTypes` = `[]` aber Long-Press-Definitions noch aktiv
7. Externe Links nur über `navigationType == .linkActivated` gefiltert — `target=_blank` über JS-Klicks rutscht durch
8. Kein In-App-Browser für externe Links → User landet in Safari, Switch-Animation
9. Kein Splash-Screen (`UILaunchScreen: {}` ist leer) → weißer Flash beim Start
10. Keine Haptic-Feedback-Bridge
11. Keine Push-Notifications (Sessions können stuck/needs-input sein → ideal für Push)
12. Kein FaceID-Gate beim App-Wechsel (Berechtigung deklariert in Info.plist, aber nicht erzwungen)

---

## 3. Drei Wege im Vergleich

| Kriterium | **A: WKWebView-Shell (locked-down)** | **B: Hybrid Native-TabBar + WebView-Slot** | **C: SwiftUI-Native rebuild** |
|---|---|---|---|
| Aufwand | 1-3 Tage Härtung des Bestehenden | 1-3 Wochen | 6-12 Monate |
| Server-Sync | Automatisch (Push live ohne App-Update) | Automatisch in Slots, Native-Shell entkoppelt | Lockstep nötig — jede Server-Route = neuer Native-Code |
| App-Store-Risiko | Gering (Apple toleriert "Companion-App"-Pattern wenn Custom-Funktionalität dazu) | Gering | Gering |
| Native-Gefühl | Mittel (90% Web, Status-Bar/Splash/Nav nativ) | Hoch (Tab-Switches nativ, Inhalte web) | Höchstmöglich |
| "Festgenagelt" möglich | ✅ Voll | ✅ Voll | ✅ Voll, aber selbstverschuldete UI-Drift |
| Push-Notifications | Brücke nötig (Native ↔ Server) | Brücke nötig | Direkt |
| Tot-Code bei Featureflut | Keiner | Slot-Mapping pflegen | Massiv (Spend-Reports, Map, Torrents …) |
| Offline | Service-Worker übernimmt | Service-Worker im Slot | Selbst bauen |

**Disqualifiziert: C.** Nicht "simple App", das wäre ein Parallelprodukt zur PWA. Außerdem würde der server-driven Single-File-Ansatz von amux gebrochen — jede Server-Iteration bräuchte einen App-Store-Release.

**Empfohlen: A.** Genau das, was `ios/AmuxApp/` heute schon ist, plus die 6 Härtungen aus Abschnitt 4.

**Optional später: B.** Sobald *Push für "Session needs input"* oder ein *Native-Widget für "Send to active session"* kommt, lohnt sich der Schritt. Vorher unnötig.

---

## 4. "Festnageln" — konkrete Maßnahmen für Variante A

Alle Edits gehen in **`ios/AmuxApp/Sources/WebView.swift`** + **`Info.plist`**.

### 4.1 Bounce / Overscroll abschalten
```swift
// in makeUIView:
webView.scrollView.bounces = false
webView.scrollView.alwaysBounceVertical = false
webView.scrollView.alwaysBounceHorizontal = false
```

### 4.2 Pinch-to-Zoom hart abschalten
```swift
webView.scrollView.pinchGestureRecognizer?.isEnabled = false
webView.scrollView.maximumZoomScale = 1.0
webView.scrollView.minimumZoomScale = 1.0
```

### 4.3 iOS-Long-Press-Callout & Text-Selection systemweit aus
JS-Injection beim `atDocumentStart` (analog zum Console-Logger-Bridge):
```js
const css = document.createElement('style');
css.textContent = `
  * { -webkit-touch-callout: none !important; -webkit-user-select: none !important; }
  input, textarea, [contenteditable], .quill-editor, .CodeMirror, .xterm-helper-textarea
    { -webkit-user-select: text !important; }
`;
document.head.appendChild(css);
```
Selektoren bewusst Whitelist statt Blacklist — sonst killst du Notes/Terminal/Quill.

### 4.4 Externer-Link-Filter konsequent + In-App-Browser
Externe Links (egal ob `target=_blank` oder Klick) in `SFSafariViewController` statt Safari-App:
```swift
func webView(_ webView: WKWebView, decidePolicyFor a: WKNavigationAction,
             decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
  if let url = a.request.url,
     let serverHost = parent.host,
     url.host != serverHost,
     ["http", "https"].contains(url.scheme ?? "") {
    DispatchQueue.main.async {
      let safari = SFSafariViewController(url: url)
      UIApplication.shared.topMostController()?.present(safari, animated: true)
    }
    decisionHandler(.cancel); return
  }
  decisionHandler(.allow)
}
```
Vorteil: User bleibt in der App, kein Task-Switch, App fühlt sich endgültig "fest" an.

### 4.5 Status-Bar + Safe-Area pinnen
```swift
webView.scrollView.contentInsetAdjustmentBehavior = .never
webView.scrollView.contentInset = .zero
```
In Kombination mit `ignoresSafeArea()` und dem bereits gesetzten `theme-color`/`black-translucent` füllt die App randlos. Notch wird durch `env(safe-area-inset-*)` im PWA-CSS schon respektiert.

### 4.6 Splash-Screen
Leeres `UILaunchScreen: {}` durch eine `LaunchScreen.storyboard` (oder Asset-Color + Icon) ersetzen, sonst weißer Flash beim Cold-Start. `Info.plist` braucht dann:
```xml
<key>UILaunchScreen</key>
<dict>
  <key>UIColorName</key><string>LaunchBackground</string>
  <key>UIImageName</key><string>LaunchLogo</string>
</dict>
```
`LaunchBackground` als Color-Asset `#0d1117` setzen, dann matched es das Theme.

---

## 5. Optionale native Add-ons (Phase 2)

Diese brechen Variante A nicht — sie sitzen *neben* dem WebView.

### 5.1 Push-Notifications via APNs
Wofür: Server-Seite `_sse_events` kennt Session-Status. Wenn `needs_input` → Push.

Komponenten:
- Native: `UNUserNotificationCenter` Permission im `AmuxApp.swift` (nach Server-Auswahl)
- Brücke: nach erstem Login `POST /api/devices/register {token, platform: "ios"}`. Server muss diesen Endpoint anlegen (heute nicht vorhanden → +1 Route, simpel).
- Server-Side: APNs HTTP/2-Push direkt aus Python (`hyper`/`httpx` + ECC-Key) bei Session-State-Transitions
- Optional: bei Push-Tap Deep-Link `amux://session/<name>` → WebView lädt `/?peek=<name>`

### 5.2 FaceID-Gate
- `Info.plist` hat schon `NSFaceIDUsageDescription`
- In `AmuxApp.swift` einen `@StateObject AuthGate` davorhängen, der bei `.scenePhase` → `.active` `LAContext().evaluatePolicy(.deviceOwnerAuthentication)` aufruft
- Erst bei Erfolg `ContentView()` rendern

### 5.3 Haptic-Bridge
JS → Native:
```js
window.webkit?.messageHandlers?.haptic?.postMessage('light')
```
Native:
```swift
case "light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
```
Im Dashboard-JS dann an "Send", "Claim", "Done" verdrahten — fühlt sich sofort 10× nativer an.

### 5.4 Share-Extension
Aus Safari/Mail "Share → amux" → öffnet App mit pre-filled `Send`-Sheet auf aktive Session. Eigenes Extension-Target (ca. 1 Tag) — netter Native-Bonus.

### 5.5 Universal-Links statt Custom-Scheme
Wenn Cloud-Variante (`cloud.amux.io`): `apple-app-site-association` auf den Server packen → Links aus Mail/Slack öffnen direkt in der App. Erfordert AASA-File im Cloud-Gateway.

---

## 6. UI wiederverwenden — wie genau?

> Frage des Users: *"Die UI theoretisch wieder verwenden?"*

**Antwort: Ja, vollständig.** Die UI lebt als HTML/CSS/JS in `amux-server.py` und wird über HTTPS ausgeliefert. Die WKWebView konsumiert sie wie ein Browser. Vorteile:

1. **Zero-Duplikation.** Single-File-Rule (`.claude/rules/single-file.md`) bleibt eingehalten.
2. **Hot-Updates ohne App-Store-Review.** Server-Push → App ist instant aktuell.
3. **Plattform-Parität.** Was im Web geht, geht in iOS und Android (gleicher Trick mit Trusted Web Activity).

Es gibt **eine Ausnahme**, die man wissen sollte:
- Wo das WebKit-Verhalten von Safari abweicht (iOS-WKWebView ist nicht 100% identisch mit mobilem Safari), muss man im PWA-Code defensiv arbeiten. Beispiel: `navigator.standalone` ist im WKWebView `undefined` statt `true`. Das ist im `amux-server.py` bei Zeile 26082 schon abgefangen: `navigator.standalone || matchMedia('(display-mode: standalone)').matches`.

**Wenn der "Native-Anteil" wachsen soll** (z.B. ein TabBar mit Sessions/Board/Notes/Channels) → Variante B. Dann lädt jede Tab eine **Deep-Link-URL** desselben Server-Frontends mit einem `?embed=tab` Query-Param. Die JS-Logik kann dann das Top-Nav ausblenden. Das ist 1-2 Tage Arbeit und voll reversibel.

---

## 7. Empfohlener Schritt-für-Schritt-Pfad

1. **Tag 1 — Härten:** Edits aus Abschnitt 4.1 – 4.5 in `WebView.swift` einbauen. Splash-Screen-Asset anlegen. Build mit XcodeGen, in Simulator + Device testen.
2. **Tag 2 — Polish:** Pull-to-Refresh-Indicator-Tönung an Theme angleichen, Error-Overlay-Wording prüfen, "Settings" auch über Drei-Finger-Tap als Alternative zu Long-Press (Long-Press jetzt durch 4.3 unterdrückt — Geste muss anders ausgelöst werden, z.B. Toolbar-Button oder 3-Finger-Tap).
3. **Tag 3 — Verifizieren:** Auf Tailscale-URL + Cloud-URL durchspielen, mit zweitem Device gleichzeitig (SSE-Test).
4. **Phase 2 (nach Bedarf):** Push (5.1) + Haptics (5.3) — beide bringen den größten Native-Boost mit am wenigsten Code.

---

## 8. Was bewusst NICHT empfohlen wird

- **Capacitor / Ionic / Tauri-Mobile** — fügt eine Abstraktionsebene hinzu, die hier keinen Mehrwert hat. WKWebView direkt ist schlanker.
- **React Native / Expo** — würde die UI-Engine wechseln und Variante C nahekommen.
- **Eigene Service-Worker-Reimplementierung im Swift-Layer** — der Web-Service-Worker übernimmt Offline schon, Swift muss nichts cachen.
- **Native Terminal-View für `peek`** — xterm.js im WebView ist gut genug; eine native iTermSwift-Integration wäre Wochenarbeit für marginalen Gewinn.

---

## 9. Anhang — relevante Datei-Locations

```
amux/
├── amux-server.py                     # Monolith: Server + Dashboard + PWA-Manifest + SW
├── ios/
│   ├── PLAN.md                        # Bisheriger Plan (deckt sich mit Variante A)
│   ├── project.yml                    # XcodeGen-Spec
│   └── AmuxApp/
│       ├── Info.plist                 # Bundle-Config, Orientation, FaceID-Description
│       ├── AmuxApp.entitlements       # Aktuell leer
│       └── Sources/
│           ├── AmuxApp.swift          # Entry
│           ├── ContentView.swift      # Shell + Error-UI + Settings-Sheet
│           ├── WebView.swift          # WKWebView-Wrapper ← HIER LIEGT DIE ARBEIT
│           ├── ServerManager.swift    # Persistenz Server-Liste
│           └── ServerPickerView.swift # Onboarding
└── .claude/rules/
    ├── single-file.md                 # amux-server.py darf NICHT gesplittet werden
    ├── sse-realtime.md                # SSE-Backbone, 10s-Ping / 18s-Stale
    └── css-mobile.md                  # 44×44 Touch-Targets, env(safe-area-inset)
```
