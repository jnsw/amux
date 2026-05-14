# Fork-Triage: darrengruber/amux — 2026-05-14

**Remote:** `darrengruber/main`  
**Basis:** `upstream/main`  
**Commits ahead:** 100 (2026-03-16 – 2026-03-31)  
**Hauptautor:** Ethan Steininger (esteininger21@gmail.com), 1 Contributor (allenlinli)

---

## Cluster-Übersicht

| # | Cluster | Commits | Wert | Aufwand | Risiko |
|---|---------|---------|------|---------|--------|
| 1 | iOS Native App (WKWebView) | 18 | HIGH | groß | med |
| 2 | Security-Hardening | 5 | HIGH | klein | low |
| 3 | Persistent Audio Player + ffmpeg | 4 | HIGH | klein | low |
| 4 | Gemini Live Voice Chat | 2 | med | mittel | med |
| 5 | ElevenLabs TTS | 2 | low | klein | low |
| 6 | Terminal Tab (xterm.js + PTY) | 2 | med | mittel | med |
| 7 | Git Worktrees (Session-Isolation) | 1 | med | klein | low |
| 8 | Mobile UX: Focus-Mode + Chip-Bar | 3 | HIGH | klein | low |
| 9 | Cloud/Org/Multi-User-Features | 25 | low | — | high |
| 10 | Android App | 2 | low | groß | med |
| 11 | Journal / Graph / Board Tabs | 5 | low | groß | med |
| 12 | Diverses (SEO, Branding, pyproject) | 31 | low–med | klein | low |

---

## Cluster-Details

### 1. iOS Native App (WKWebView)
**Commits:** `0239002 238e76e 130af03 d168941 75c5d72 da00126 1bedc29 f7a28d7 867390f cf4b5b7 aa1cd49 97a94a1 14991c5 42aead8 1d449dd e07f2bb 799425a 3d945d6`  
**Diff-Stat:** `ios/` — 18 Dateien, Swift + XcodeGen + Fastlane/Match

Thin Native Shell: Swift WKWebView-Wrapper um das bestehende PWA-Dashboard. Kein React Native, kein Capacitor. Features: Self-signed-Cert-Akzeptanz (URLAuthenticationChallenge), Sign in with Apple via ASWebAuthenticationSession (Google OAuth hidden weil von Google policy geblockt auf iOS WebView), iOS 26-Kompatibilität, pull-to-refresh, landscape rotation, console.log → os.log Bridge, Fastlane für TestFlight-CI.

**Wert für Jan:** HIGH — Jan nutzt amux primär auf iPhone. Jans aktuelles Setup ist bereits eine PWA via Safari (self-signed cert manuell installiert). Die native Shell bringt: Home-Screen-Icon mit echtem App-Splash (kein Safari-Chrome), zuverlässigeres Auth-Handling, background playback via MediaSession. Kein App Store nötig — TestFlight-only Sideload möglich.

**Aufwand:** groß. Eigenes Xcode-Projekt, erfordert Apple Developer Account (99 $/Jahr), Fastlane-Match-Setup (Cert-Repo), Xcode auf BillyBang (ist macOS M1, also machbar). Nicht cherry-pickbar im klassischen Sinn — ist ein Sub-Projekt (siehe unten).

**Risiko:** med. Clerk-Auth ist hardverdrahtet auf cloud.amux.io — für self-hosted muss der OAuth-Flow überbrückt werden, was der Fork bereits tut (`AMUX_AUTH_TOKEN` + lokaler URL-Picker).

**Dependency-Footprint:** Apple Developer Account, Xcode 16+, Fastlane + Match-Cert-Repo (privates Git-Repo für Zertifikate). Keine neuen Python-Dependencies.

---

### 2. Security-Hardening
**Commits:** `c1ded31 f185c5c b4b81ad de1f72b e7e2918`  
**Diff-Stat:** `amux-server.py` ~+350 Zeilen, plus neue Tests

Drei Lücken gepatcht:
- Path-Traversal (Notes-API): `../`-Checks durch `Path.resolve() + relative_to()` ersetzt
- tmux `send-keys`-Injection: allowlist für erlaubte Key-Namen
- Auth: Auto-generierter Bearer Token (`~/.amux/auth_token`, 0600), CORS restrictive (kein Wildcard), Filesystem-Blocklist (`~/.ssh`, `~/.aws`, etc.)

**Wert für Jan:** HIGH — Jan exponiert amux bereits via WireGuard. Diese Fixes schließen reale Lücken, die im aktuellen Upstream noch offen sind. AMUX_AUTH_TOKEN=none als Opt-out vorhanden.

**Aufwand:** klein. Reine `amux-server.py`-Änderungen, gut isoliert, mit Tests.

**Risiko:** low. Auth-Token ist backward-compatible, dashboard injiziert ihn automatisch.

**Dependency-Footprint:** keine neuen Packages.

---

### 3. Persistent Audio Player + ffmpeg-Transcode
**Commits:** `8c18138 a1b2742 c9f4f66 4d093b6`  
**Diff-Stat:** `amux-server.py` ~+230 Zeilen

Globaler Audio-Player-Bar persistent über Tab-Wechsel. MediaSession API für iOS Lock-Screen-Controls und Background-Playback. Position in localStorage gespeichert (5s-Intervall), Resume beim Wiederöffnen. Speedcontrol 0.75x–2x. Dazu: `/api/file/transcode` Endpoint — ffmpeg remuxed MKV/AVI zu fragmented MP4 on-the-fly (Video copy, Audio → AAC).

**Wert für Jan:** HIGH — Jan hört Sessions / Transcripts als Audio auf dem iPhone. Background-Playback ist kritisch, da iOS Safari Audio bei Tab-Wechsel stoppt. Auth-Token wird korrekt in Audio-Src-URLs injiziert (Tailscale-kompatibel).

**Aufwand:** klein. Nur `amux-server.py`. ffmpeg-Dependency: muss auf BillyBang installiert sein (`brew install ffmpeg` — bereits sehr wahrscheinlich vorhanden).

**Risiko:** low. Kein ffmpeg-Zwang für Nicht-MKV-Dateien.

**Dependency-Footprint:** `ffmpeg` Binary (runtime, kein Python-Package).

---

### 4. Gemini Live Voice Chat
**Commits:** `c379725` + `42a4288` (fix iOS black screen)  
**Diff-Stat:** `amux-server.py` +202 Zeilen

Mic-Button in Peek-Overlay. Browser streamt Mic bei 16kHz PCM über WebSocket an Gemini 2.0 Flash Live (Multimodal Live API). Gemini antwortet mit 24kHz Audio via Web Audio API. Gemini hat ein `send_to_session`-Tool, um Commands direkt in die tmux-Session zu schicken. System-Prompt enthält aktuellen Terminal-Output als Kontext. Erfordert `GOOGLE_API_KEY` in `~/.amux/server.env`.

**Wert für Jan:** med. Sprachsteuerung von Claude-Sessions wäre elegant. ABER: Gemini (nicht Claude) als Voice-Interface. Jan hat Google AI Abo, aber API-Quota-Probleme — Tier-1-Billing ist separates Aktivierungsschritt. Die `send_to_session`-Integration ist der eigentliche Wert.

**Aufwand:** mittel. Technisch isoliert in `amux-server.py`, aber erfordert Google API Key mit aktivem Gemini Live API Access (Tier-1-Billing, nicht AI Studio Free Tier).

**Risiko:** med. Google API-Quota-Probleme laut Memory. Fallback fehlt wenn Key nicht gesetzt (Server-Fehler, kein graceful disable).

**Dependency-Footprint:** `GOOGLE_API_KEY` in `~/.amux/server.env`, Tier-1 Google Cloud Billing.

---

### 5. ElevenLabs TTS
**Commits:** `ce2b290 53a4b26`  
**Diff-Stat:** `amux-server.py` +190 Zeilen

POST `/api/tts` + GET `/api/tts/voices`, Speaker-Button im Notes-Editor. Erfordert `ELEVENLABS_API_KEY`.

**Wert für Jan:** low. TTS ist interessant, aber ElevenLabs ist kostenpflichtig (kein Free Tier für API), und der Persistent Audio Player (Cluster 3) löst den wichtigeren Use-Case bereits ohne externe API.

**Aufwand:** klein.  
**Risiko:** low.  
**Dependency-Footprint:** ElevenLabs API Key + Kosten.

---

### 6. Terminal Tab (xterm.js + PTY)
**Commits:** `20f8e85 29fd12b`  
**Diff-Stat:** `amux-server.py` +429 Zeilen

Vollwertiger xterm.js Terminal-Tab mit Server-seitigem PTY (`pty.fork()`). SSH-Host konfigurierbar. Polling-basiert (50ms). Resize-Support (SIGWINCH). JetBrains Mono, 256-Color, clickable URLs.

**Wert für Jan:** med. SSH direkt aus amux heraus auf Mobile wäre nützlich (Zugriff auf tulen/vserver ohne Wechsel zu Termius). Kein Touch-Keyboard-Handling spezifisch für iOS erwähnt.

**Aufwand:** mittel. `amux-server.py` +429 Zeilen, erfordert `python-pty` auf dem Server.  
**Risiko:** med. PTY-basierte Endpoints sind eine potenzielle Angriffsfläche, aber Auth-Hardening (Cluster 2) sollte das abdecken.  
**Dependency-Footprint:** `python-pty` Package.

---

### 7. Git Worktrees (Session-Isolation)
**Commit:** `a64b62b`  
**Diff-Stat:** `amux-server.py` ~+100 Zeilen

Opt-in Worktree-Checkbox beim Session-Erstellen. Legt `.worktrees/{session-name}` mit Branch `session/{name}` an. Session-Delete räumt Worktree auf (Branch bleibt). `.worktrees/` in `.gitignore`.

**Wert für Jan:** med. Nützlich bei parallelen Sessions auf gleichem Repo (verhindert Konflikte). Als Opt-in kein Risiko für bestehende Workflows.

**Aufwand:** klein. Gut isoliert.  
**Risiko:** low.  
**Dependency-Footprint:** git (bereits vorhanden).

---

### 8. Mobile UX: Focus Mode + Customizable Chip Bar
**Commits:** `9b4dd16 7c4c353 4bdfa86`

- **Focus Mode** (`9b4dd16`): Toggle (▴/▾) im Peek-Header blendet Header/Tabs/Dir-Bar aus — nur Terminal + Command-Bar bleiben. State in localStorage.
- **Chip Bar** (`7c4c353`): Drag-Reorder, Add/Remove, + Picker für alle Commands. localStorage-persistent.
- **Mobile Board** (`4bdfa86`): Board-Tab mobile-optimiert (Icon-Button, wrapped Toolbar, engere Cards).

**Wert für Jan:** HIGH — Focus Mode ist ein direkter iPhone-Gewinn: maximale Terminal-Fläche ohne Browser-Chrome. Chip Bar macht häufige Commands single-tap erreichbar.

**Aufwand:** klein. Reine Frontend-Änderungen in `amux-server.py`.  
**Risiko:** low.  
**Dependency-Footprint:** keine.

---

### 9. Cloud / Multi-Org / Referral / White-Label
**Commits:** `52d8749 cba178d 123d748 ca94fd3 fcc5ab3 316c3e2 70d194a` + viele fix-Commits für Clerk/OAuth  
(~25 Commits, teils Login-Loop-Fixes, Org-Invite-Schema-Migrationen, GCP-Migration)

Cloud SaaS-Features: Multi-Org mit Owner/Member-Rollen, Shared API Keys, Referral-Programm (7 Bonus-Trial-Tage), White-Label-Branding, Promo-Codes, Admin-API. Clerk als Identity-Provider.

**Wert für Jan:** low. Jan ist Solo-User auf Self-Hosted. Diese Features sind für cloud.amux.io gebaut.

**Aufwand:** — (nicht cherry-pick-kandidat)  
**Risiko:** high — Schema-Migrationen, Clerk-Dependency, org_invites-Tabelle-Änderungen könnten bestehende SQLite-DB korrumpieren.  
**Dependency-Footprint:** Clerk JS v5, GCP, umfangreiche Schema-Änderungen.

---

### 10. Android App
**Commits:** `f9f22ff 821d324`  
**Diff-Stat:** `android/` — ~20 Dateien, Kotlin + Jetpack Compose

Äquivalent zur iOS-App als WebView-Wrapper. Self-signed-Cert-Akzeptanz, AmuxApp User-Agent, Clerk OAuth via window.open, SharedPreferences für Server-Persistenz.

**Wert für Jan:** low — Jan nutzt iPhone, kein Android.  
**Aufwand:** groß (Android Studio, Google Play Account oder Sideload).  
**Risiko:** med.

---

### 11. Journal / Graph / Board Tabs
**Commits:** `ef1332a 9cbe0c1 313a6a3 8b904f6 d202902`

- Journal: SQLite-backed Day One-Klon (Kalender, Media, Map, Geolocation, Day One Import)
- Graph: Obsidian-Style Mindmap-Canvas mit Wikilink-Parser
- Board: Kanban mit Session-Task-Auto-Create und Live-Logging

**Wert für Jan:** low. Diese Features sind beeindruckend, aber kein direkter Amux-Kernnutzen für Solo-Mobile-Developer.  
**Aufwand:** groß — je ~200–400 Zeilen `amux-server.py`, externe Libs (Leaflet, Quill bereits vorhanden?).  
**Risiko:** med.

---

### 12. Diverses
Layout-Presets, Notes-Pane, Anchor-Links, Bookmarks-Bar, `pyproject.toml`/uv-Support, SEO-Pages, Blog-Posts, scheduler/send-Bugfixes, iOS 26 Blank-Screen-Fix.

Besonders relevant: **`pyproject.toml`** (SHA `76ea163`) — erlaubt `uv tool install git+https://github.com/darrengruber/amux`. Wert: med/high für Update-Prozess auf BillyBang (ein `uv tool upgrade amux` statt manuellem `git pull`).

---

## iOS-App: separate Roadmap?

Das `ios/`-Sub-Projekt ist ein **eigenständiges Xcode-Projekt** (XcodeGen-basiert, Fastlane/Match für Certs, Swift 5.9+). Es ist **nicht cherry-pickbar** im Sinne eines Commits — es ist ein vollständiges Mobile-App-Projekt.

**Bewertung der drei Optionen:**

**(a) Ganzes Sub-Projekt übernehmen**  
Realistisch und empfohlen. Der Aufwand ist überschaubar: `ios/` Verzeichnis in Jans Repo-Fork übernehmen, Apple Developer Account vorausgesetzt (bereits vorhanden oder 99 $/Jahr), Fastlane-Match-Cert-Repo anlegen (privates Gitea-Repo), Xcode auf BillyBang (M1 — kein Problem). TestFlight-Sideload ohne App Store möglich. Clerk-OAuth entfernen, reine Token-Auth behalten (bereits vorhanden via `ServerPickerView`).

**(b) Konzept übernehmen, selber bauen**  
Unnötig. Die iOS-App ist bewusst thin (WKWebView-Wrapper, ~400 Zeilen Swift) — da gibt es nichts zu verbessern oder neu zu bauen.

**(c) Skip — PWA reicht**  
Jans aktuelle PWA via Safari hat zwei echte Einschränkungen, die die native App löst:
1. Background-Audio stoppt wenn Safari in den Hintergrund geht (iOS-Einschränkung für Web-Audio)
2. Safari PWA-Icon vs. echter App-Splash + native Navigation Gestures

**Empfehlung: Option (a)** — Sub-Projekt als eigenen Fork-Branch übernehmen. Die Kombination iOS-App + Auth-Token (kein Clerk) + Persistent Audio Player ist der stärkste Stack für Jans Use-Case.

---

## Top-3 Cherry-Pick / Übernahme-Empfehlungen

1. **Security-Hardening** (Cluster 2, SHAs `c1ded31 f185c5c b4b81ad`) — sofort, geringes Risiko, schließt reale Lücken.
2. **Persistent Audio Player + Focus Mode** (Cluster 3 + 8, SHAs `8c18138 c9f4f66 9b4dd16 7c4c353`) — direkter Mobile-Gewinn, reine Frontend-/Server-Änderungen, kein neuer Dependency.
3. **iOS Sub-Projekt übernehmen** (Cluster 1) — als separates Projekt-Board; kein klassischer Cherry-Pick sondern `ios/`-Verzeichnis aus `darrengruber/main` in Jans Fork mergen.

**Don't Cherry-Pick:** Cloud/Org/Referral (Cluster 9) — Schema-Migrationen, Clerk-Dep, kein Solo-User-Nutzen. Android App — kein iOS. ElevenLabs TTS — kostenpflichtige API, kein Mehrwert über Audio Player hinaus.

---

*Analyse: 2026-05-14 | Quelle: `git log upstream/main..darrengruber/main` (100 Commits)*
