# Mobile/PWA Review — amux (2026-05-14)

Branch: `feat/cc-stream-redesign`

---

## TL;DR

amux hat solides PWA-Fundament: `viewport-fit=cover`, `apple-mobile-web-app-capable`, safe-area-insets an fast allen kritischen Stellen, `100dvh` in der Redesign-Preview. Die Live-Dashboard-Seite (das was Jan täglich benutzt) ist jedoch erkennbar zuerst Desktop, dann Mobile nachgerüstet: viele Icon-Buttons bleiben bei 26–28px, der Haupt-Composer-Input (`send-input`) hat 0.85rem (≈13.6px), was auf iOS automatischen Zoom auslöst. Der Service-Worker-Update-Flow ist manuell-only (kein Toast bei neuer Version). Die Self-Signed-Cert-Story ist funktional, aber textlastig — kein geführter In-App-Flow.

---

## P0 — Mobile-Showstopper

### P0-1: Haupt-Composer-Input löst iOS-Zoom aus

- **Stelle:** `amux-server.py:9216` — `.peek-cmd-row .send-input { font-size: 0.85rem; … }`
- **Was:** 0.85rem ergibt bei `html { font-size: 16px }` (Zeile 8094) exakt 13.6px. iOS Safari zoomt bei focus auf alle `<input>`/`<textarea>` mit `font-size < 16px`. Die notes-view hat das bereits korrekt gefixt (Zeile 10757–10758 mit `font-size: 16px !important`), aber der Primary-Composer in der Peek-Overlay ist nicht gefixed.
- **Impact:** Jedes Mal wenn Jan auf dem iPhone eine Nachricht tippt, springt die komplette View — der typischste Mobile-Usecase.
- **Fix:** `@media (max-width: 600px) { .peek-cmd-row .send-input { font-size: 16px; } }` — analog zur notes-Lösung bereits im Code.

### P0-2: Viele Icon-Buttons deutlich unter 44×44px

- **Stelle:** `amux-server.py:8112` `.tile-btn { width: 28px; height: 28px; }`, Zeile `9172` `.peek-nav-btn { width: 22px; height: 22px; }`, Zeile `7992` `.tile-btn` für trade-theme nur 24×24px.
- **Was:** Apple HIG verlangt ≥44×44px. `.peek-nav-btn` (up/down in find-bar, Zeile 9172–9175) ist 22×22px — halb so groß wie nötig. `.tile-btn` (Layout-View-Wechsel) ist 28×28px. Stichprobe 5–10 Elemente:

  | Element | Größe | HIG-konform? |
  |---|---|---|
  | `.tile-btn` (Standard) | 28×28px | Nein |
  | `.tile-btn` (trade-theme) | 24×24px | Nein |
  | `.peek-nav-btn` | 22×22px | Nein |
  | `.tab-bar button` (padding 10px 14px + font) | ~40px hoch | Grenzwertig |
  | `.send-split-arrow` | min-height 44px | Ja |
  | `.btn--icon` in redesign (`components.css:40`) | 30×30px | Nein |
  | `.scard__action` in redesign (`app.css:316`) | 26×26px | Nein |
  | `.wtab__close` in redesign (`app.css:503`) | 18×18px | Nein |
  | `.queue-strip__x` (`app.css:705`) | 16×16px | Nein |
  | `tile-btn` @max-600 trade fix | 36×36px | Nein |

- **Impact:** Mehrere kritische Aktions-Buttons zuverlässig schwer treffbar auf iPhone-Displays.
- **Fix:** Alle Icon-Buttons via `min-width/min-height: 44px` oder, wo visuell nicht gewünscht, via `:after` pseudo-element mit `content:""; position:absolute; inset:-8px` als unsichtbare Tap-Zone.

---

## P1 — iOS-spezifische Issues

### P1-1: Pull-to-Refresh nicht global verhindert

- **Stelle:** `amux-server.py` — `body`-Selector, kein globales `overscroll-behavior: none`
- **Was:** `overscroll-behavior` ist nur auf horizontalen Scroll-Containern gesetzt (`.chips`, Peek-intern), nicht auf `body` / `html`. iOS Safari erlaubt Pull-to-Refresh im Standalone-Modus, was bei SSE-connected App eine ungewollte Reconnect-Sekunde kostet und visuell hässlich ist. `css-mobile.md` spricht das Thema nicht an.
- **Fix:** `body { overscroll-behavior: none; }` für Standalone. Selektiv wieder erlauben wo echte Scroll-Container sind.

### P1-2: Service-Worker-Update ist manuell-only, kein proaktiver Toast

- **Stelle:** `amux-server.py:25520–25545` (SW-Registrierung), `amux-server.py:26605` (`forceUpdate()`)
- **Was:** Der Update-Flow existiert nur als manuell aufrufbares `forceUpdate()` (erreichbar über Settings). Wenn ein neuer SW wartet (`reg.waiting`), gibt es keinen automatischen Toast/Banner. Auf iOS ist das besonders kritisch: iOS kann SW-Cache aggressiv löschen und die App spielt dann mit einer alten Cached-Version, ohne dass der User es merkt. CACHE-Key ist hardcoded `amux-v0.6.6` — wenn Jan via `git pull` updated, wird der String nicht auto-inkrementiert.
- **Fix:** `statechange`-Listener auf `reg.installing`: wenn `state === 'installed'` und `reg.waiting`, Toast mit "Neue Version verfügbar — neu laden" + Reload-Button einblenden. CACHE-Versionsstring mit Python-Timestamp oder Git-SHA aus Server-Build injizieren.

### P1-3: `100vh` in Views für mobile nicht auf `100dvh` migriert

- **Stelle:** `amux-server.py:10525` `#notes-view { height: calc(100vh - 110px); }`, Zeile `10896` `#crm-view`, `11084` `#map-view`, `11249` `#graph-view`, `11317` `#journal-view`
- **Was:** Alle diese Views haben `100vh` (nicht `100dvh`) in der Desktop-Regel und werden erst per `@media (max-width: 600px)` auf `calc(100dvh - 122px)` korrigiert. Auf iOS-Safari sind das beim ersten Load (mit sichtbarer Address Bar) knapp 60–80px zu viel, was dazu führt, dass Inhalte unter der virtuellen Tastatur oder dem Home-Indicator verschwinden. Die Desktop-`100vh`-Werte sind also bis zum Breakpoint-Switch aktiv — inklusive auf iPad-Landscape.
- **Fix:** Desktop-Regel direkt auf `100dvh` umstellen. Fallback: `height: calc(100vh - Xpx); height: calc(100dvh - Xpx);`

### P1-4: Redesign-Komponenten `btn--sm` und `scard__action` unter Mindestgröße

- **Stelle:** `docs/redesign/project/src/components.css:37` `.btn--sm { height: 26px }`, `app.css:316` `.scard__action { width: 26px; height: 26px }`, `app.css:503` `.wtab__close { width: 18px; height: 18px }`
- **Was:** Das Redesign-Komponentensystem definiert `.btn--sm` mit 26px Höhe, `scard__action` mit 26×26px, und `wtab__close` mit 18×18px — alle deutlich unter 44px. Das ist das kommende UI, das in Produktion gehen soll.
- **Fix:** Entweder `min-height: 44px; min-width: 44px` auf allen interaktiven Micro-Buttons, oder zumindest in `@media (hover: none)` hochskalieren.

---

## P2 — Nice-to-Have / Polish

### P2-1: Kein Drag-to-Dismiss auf Peek-Overlay

- **Stelle:** Plan `docs/redesign/project/plans/08-mobile-pwa.md:22` ("Peek panel: drag-down to dismiss") — geplant aber nicht implementiert.
- **Impact:** Standard iOS-UX-Erwartung für Fullscreen-Sheets, fehlt sowohl in Live-Dashboard als auch in Redesign-Mockup.

### P2-2: Kein `beforeinstallprompt`-Handler / Install-Chip

- **Stelle:** `docs/redesign/project/plans/08-mobile-pwa.md:26` ("Detect beforeinstallprompt → show subtle 'Install amux' chip") — geplant aber nicht in `amux-server.py` implementiert.
- **Impact:** Auf Android fehlt der aktive Install-Prompt. iOS braucht ihn nicht (Safari zeigt keinen nativen), aber ein einmaliger in-App-Hinweis ("Zum Home-Bildschirm hinzufügen") fehlt für Erstnutzer.

### P2-3: `theme-color`-Meta nicht dynamisch bei Theme-Switch

- **Stelle:** `amux-server.py:7354` `<meta name="theme-color" content="#0d1117">` — statisch hardcoded.
- **Was:** Plan `08-mobile-pwa.md:33` sieht vor, `theme-color` bei Theme-Wechsel zu updaten. Das fehlt. Bei Light-Mode bleibt die iOS-Status-Bar dunkel.
- **Fix:** `document.querySelector('meta[name="theme-color"]').content = newColor` on theme change.

### P2-4: Keine maskable-Icons

- **Stelle:** `amux-server.py:31093–31097` (PWA_MANIFEST icons)
- **Was:** Alle Icons haben `"purpose": "any"`. Kein einziger hat `"purpose": "maskable"`. Android und ChromeOS schneiden nicht-maskable Icons mit weißem/schwarzem Hintergrund aus — das sieht auf dem Homescreen schlecht aus.
- **Fix:** Ein 512×512 PNG mit sicherem 40% inner-circle vorbereiten und als `"purpose": "maskable"` eintragen.

### P2-5: Kein globaler `Cmd+K`-Shortcut für Command Palette in Redesign

- **Stelle:** `docs/redesign/project/src/app.jsx` — Palette existiert, wird aber über Icon-Button in Toolbar ausgelöst, kein globaler `metaKey && key === 'k'`.
- **Impact:** iPad-Nutzer mit Magic Keyboard haben keinen nativen Shortcut.

---

## PWA-Manifest Check

Geprüft in `amux-server.py:31085–31099`:

| Feld | Vorhanden? | Wert |
|---|---|---|
| `name` | Ja | `"amux — Claude Code Multiplexer"` |
| `short_name` | Ja | `"amux"` |
| `id` | Ja | `"/"` |
| `start_url` | Ja | `"/"` |
| `display` | Ja | `"standalone"` |
| `background_color` | Ja | `"#0d1117"` |
| `theme_color` | Ja | `"#0d1117"` (statisch, nicht dynamisch) |
| `scope` | **Fehlt** | — (default `/` ist implizit, aber explizit besser) |
| `icons[192]` | Ja | `/icon-192.png` |
| `icons[512]` | Ja | `/icon-512.png` |
| `icons[maskable]` | **Fehlt** | Kein Eintrag mit `"purpose": "maskable"` |
| `orientation` | **Fehlt** | — (ok für flexible Apps) |
| `screenshots` | **Fehlt** | — nice-to-have für Stores/Prompts |
| `description` | **Fehlt** | — nice-to-have |

---

## Service Worker Analyse

Implementierung: `amux-server.py:31101–31175`

- **App Shell (Icons, Manifest):** Cache-first, Refresh im Background — korrekt.
- **Haupt-HTML `/`:** Network-first mit Cache-Fallback + localStorage-Backup. Guter Ansatz, aber der localStorage-Fallback (Zeile 25525) speichert das gesamte HTML (~2MB) — auf iOS gibt es ein 5MB localStorage-Limit.
- **API-Requests `/api/*`:** Network-only — korrekt.
- **Update-Flow:** Manuell via `forceUpdate()` in Settings. Kein automatischer Toast wenn `reg.waiting`. Kein `statechange`-Handler. Auf iOS kann die App tagelang mit veralteter Version laufen.
- **Cache-Key:** `'amux-v0.6.6'` — hardcoded, nicht automatisch inkrementiert bei Server-Updates. Aktivierung löscht alte Caches korrekt.
- **Offline-Behavior:** Hauptseite served aus Cache. API-Calls schlagen still fehl. Es gibt eine offline-queue in IndexedDB (Zeilen 25537) aber kein UI-Feedback "Du bist offline, X Nachrichten in der Warteschlange".

---

## Safe-Area / Notch / Home-Indicator

| Bereich | Datei:Zeile | Status |
|---|---|---|
| Viewport Meta `viewport-fit=cover` | `amux-server.py:7350` | Korrekt |
| Top App-Bar (live) | `amux-server.py:8100` `env(safe-area-inset-top)` | Korrekt |
| Bottom Padding (live body) | `amux-server.py:8101` `env(safe-area-inset-bottom)` | Korrekt |
| Bottom Nav Bar (redesign) | `app.css:1039` `padding-bottom: env(safe-area-inset-bottom)` | Korrekt |
| Audio Bar (live) | `amux-server.py:8368` | Korrekt |
| Peek-Overlay top (live) | `amux-server.py:8396` `env(safe-area-inset-top)` | Korrekt |
| Fixed Toasts (redesign `app.css:938`) | `top: 16px; right: 16px` — kein `env(safe-area-inset-top)` | **Fehlt** |
| Fixed Connection Banner (redesign `app.css:1003`) | `top: 12px` — kein Safe-Area | **Fehlt** |
| Tab-bar top padding | Top-App-Bar hat es; Tab-Bar selbst nicht — ok wenn App-Bar immer sichtbar | Akzeptabel |

---

## Touch-Targets Audit

Stichprobe aus `amux-server.py` (Live-Dashboard) und Redesign-CSS:

| Element | Höhe | Breite | ≥44px? |
|---|---|---|---|
| `.send-split-arrow` | min-height 44px | ~28px | Grenzwertig (Breite) |
| `.tab-bar button` | ~40px (padding 10+10+font) | variabel | Grenzwertig |
| `.tile-btn` | 28px | 28px | **Nein** |
| `.peek-nav-btn` | 22px | 22px | **Nein** |
| `.notes-delete-btn` @600px | min 40px | 40px | Grenzwertig |
| `.notes-list-item` @600px | min 56px | voll | Ja |
| `btn--sm` (Redesign) | 26px | variabel | **Nein** |
| `scard__action` (Redesign) | 26px | 26px | **Nein** |
| `wtab__close` (Redesign) | 18px | 18px | **Nein** |
| `queue-strip__x` (Redesign) | 16px | 16px | **Nein** |

**Fazit:** 6 von 10 überprüften Elementen unter 44px. Der Live-Dashboard-Bereich ist grundsätzlich besser als der Redesign-Entwurf, wo die neuen Desktop-optimierten Micro-Buttons konsequent unter HIG-Größe sind.

---

## Cert-Onboarding UX

### Live-Dashboard (Jan's Setup, Port 8823)

Der `GET /api/cert`-Endpunkt liefert das Self-Signed-Cert als `.pem`-Datei (`amux-server.py:33786–33797`). Die CLAUDE.md beschreibt: `http://192.168.1.32:8823/api/cert` herunterladen → als Profil installieren → Trust aktivieren.

**Positiv:**
- HTTP-Cert-Server auf Port 8823 ist sauber separiert — kein Chicken-and-Egg-Problem (HTTPS ohne trusted cert aufrufen).
- Der Endpunkt existiert und liefert korrekte `Content-Disposition: attachment`.

**Problematisch:**
- Kein In-App-Onboarding-Wizard. Der User muss die CLAUDE.md kennen. Für andere Nutzer (nicht Jan) fehlt jede Anleitung im App-Interface.
- `.pem`-Datei auf iOS: Safari öffnet `.pem` als Profil-Download — das ist korrekt — aber die Trust-Aktivierung (Settings → General → About → Certificate Trust Settings) ist ein 4-Schritt-Prozess, nirgendwo in der App erklärt.
- README.md (Zeile 158–185) beschreibt es als `python3 -c "..."` Snippet — nicht die `/api/cert`-Route, die tatsächlich im Server implementiert ist. Die Doku ist outdated.
- Plan `08-mobile-pwa.md:28` sieht einen "Onboarding (3 steps from spec) lives in a modal triggered from Settings" vor — das ist noch nicht implementiert.

**Alternativer Weg (Tailscale) ist einfacher:** README Zeile 156 empfiehlt Tailscale als "easiest path". Für Jans WireGuard-Setup ist das nicht relevant, aber für andere Nutzer wäre ein Tailscale-First-Onboarding besser.

---

## Top-3 nächste Schritte

1. **P0-1 + P1-3 (Font-Size + 100vh):** `send-input` und alle restlichen `textarea`/`input` im Peek-Overlay auf `16px` via `@media (hover: none)` patchen; `#notes-view`, `#crm-view`, `#map-view`, `#graph-view`, `#journal-view` Desktop-Regel auf `100dvh` umstellen. Beide Fixes sind 1–2 Zeilen CSS pro Stelle, keine Logikänderung.

2. **P0-2 (Touch-Targets):** Globale Regel `@media (hover: none) { .btn--icon, .btn--sm, .tile-btn, .peek-nav-btn { min-width: 44px; min-height: 44px; } }` hinzufügen. Für Redesign-Komponenten: `scard__action`, `wtab__close`, `queue-strip__x` via unsichtbare Pseudo-Element-Tap-Zone vergrößern ohne Layout zu brechen.

3. **P1-2 (SW-Update-Toast):** `statechange`-Listener auf `reg.installing` hinzufügen — wenn neuer SW wartet, persistent Banner "Neue Version — neu laden" mit einem Click. CACHE-Version via Python-f-string aus Server-Version automatisch setzen: `const CACHE = 'amux-v{VERSION}';` mit Python-String-Interpolation.

---

*Reviewer: Claude Sonnet 4.6 via amux-agent, read-only. Branch `feat/cc-stream-redesign`, Stand 2026-05-14.*
