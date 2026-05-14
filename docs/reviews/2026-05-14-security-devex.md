# Security + DevEx Delta-Review — amux (2026-05-14)

## TL;DR

6 commits landed after the 2026-05-12 audit (branch `feat/cc-stream-redesign`). The only
security-relevant server change is commit `47f3b47` (accept `?token=` in addition to `?_token=`),
which extends the attack surface of the token-in-URL vector. All 10 original audit findings remain
open. Two new security issues were found: (1) the inbound webhook endpoints at
`/api/webhooks/sms/<session>` and `/api/webhooks/smartertrack/<session>` are unauthenticated by
design (in `_PUBLIC_PREFIXES`) and forward untrusted user-supplied text directly into live Claude
sessions, and (2) the `/redesign` route leaks the full Bearer token unconditionally — same root
cause as Finding #1 from the prior audit, separate endpoint. DevEx is functional but CI has no
test runner, no Python dep manifest, and no CONTRIBUTING guide.

---

## Status of 2026-05-12 Audit-Findings

| # | Finding | Status | Commit | Notiz |
|---|---------|--------|--------|-------|
| 1 | Auth-Token leakt in unauthenticated Dashboard-HTML (`/`) | **offen** | — | Mitigation skizziert aber nicht implementiert; `/` leakt weiterhin `window._AMUX_AUTH_TOKEN` |
| 2 | Schedule `kind=shell` → RCE für Token-Halter | **offen** | — | By design, kein Fix geplant |
| 3 | `/api/fs/upload`/`delete` nicht auf `$HOME` begrenzt | **offen** | — | `_is_path_allowed` erlaubt Pfade außerhalb `$HOME` weiterhin |
| 4 | Auto-Update aus GitHub ohne Signaturprüfung | **offen (inaktiv)** | — | `AMUX_AUTO_UPDATE_REPO` weiterhin nicht gesetzt → no-op |
| 5 | `_init_claude_config` setzt globale Claude-Settings | **offen** | — | Code unverändert |
| 6 | `/proxy/<port>` als SSRF-Primitiv | **offen** | — | Kein Port-Allow-List |
| 7 | `/api/torrents` liest beliebige Dateien als Torrent | **offen** | — | Keine Pfad-Validierung |
| 8 | CORS erlaubt jedes `*.ts.net` Origin | **offen** | — | `amux-server.py:31292` unverändert |
| 9 | PostHog-Outbound mit deaktivierter TLS-Verifikation | **offen (inaktiv)** | — | `POSTHOG_KEY` nicht gesetzt |
| 10 | Cron-Strings nicht eingegrenzt | **offen** | — | Kein Rate-Limit auf Schedule-Anzahl |

---

## Neue Security-Findings seit 2026-05-12

### P0-1: Unauthentifizierte Inbound-Webhooks injizieren Text in Claude-Sessions

- **Stelle:** `amux-server.py:32832–32903` (SMS Eagle + SmarterTrack Handlers)
- **Was:** `/api/webhooks/sms/<session>` und `/api/webhooks/smartertrack/<session>` liegen im
  `_PUBLIC_PREFIXES`-Tupel (`amux-server.py:170`), sind also ohne Auth erreichbar. Beide Endpunkte
  lesen `session_name` aus dem URL-Pfad, führen **keinerlei** Validierung gegen
  `_VALID_SESSION_NAME_RE` durch, und rufen `send_text(session_name, text)` auf. `send_text` selbst
  prüft den Session-Namen ebenfalls nicht (vgl. `start_session`/`stop_session` die ihn prüfen, aber
  `send_text` nicht). Der `text`-Payload kommt unkontrolliert aus dem POST-Body.
- **CWE/OWASP:** CWE-306 Missing Authentication for Critical Function; CWE-74 Injection
- **Impact:** Jeder Host der den amux-Port erreicht (LAN, WireGuard) kann beliebigen Text in jede
  laufende Claude-Session injizieren, ohne Token. In Kombination mit Audit-Finding #2 (Schedule
  Shell-RCE): wenn einer der Sessions ein Scheduler-Skill zugewiesen ist der Shell-Commands
  entgegennimmt, ergibt sich ein unauth-RCE-Pfad rein über das LAN.
- **Fix-Richtung:**
  1. `session_name` direkt nach Extraktion gegen `_VALID_SESSION_NAME_RE` validieren (return 400
     bei Mismatch) — analog zu `stop_session:6107`.
  2. Shared-Secret pro Webhook-Endpunkt einführen (`AMUX_WEBHOOK_SECRET` in `server.env`), analog
     zu `_ARIA2_RPC_SECRET`.

### P1-1: `/redesign` leakt Bearer-Token ohne Auth-Prüfung (Duplikat-Route)

- **Stelle:** `amux-server.py:31780`
- **Was:** Der `/redesign`-Handler ist ein separater Code-Pfad vom `/_`/`/legacy`-Handler. Er
  fällt durch den `"GET non-/api/"` Bypass in `_check_auth` (`:31663`) ohne Auth durch und bettet
  `window._AMUX_AUTH_TOKEN` unconditionally ins HTML ein — identisches Problem wie Audit-Finding #1,
  aber an einer anderen Route. Die skizzierte Mitigation im 2026-05-12-Audit (`_is_client_authd`
  für `/:31599` und `:31667`) adressiert diese dritte Stelle nicht.
- **CWE/OWASP:** CWE-200 Exposure of Sensitive Information to Unauthorized Actor
- **Impact:** `curl -ks https://192.168.1.32:8822/redesign | grep _AMUX_AUTH_TOKEN` liefert den
  vollen Token. Seit `GET /` seit Commit `016eb2d` auf `/redesign` redirectet, ist `/redesign` nun
  der Haupt-Einstiegspunkt und damit der primäre Leak-Vektor.
- **Fix-Richtung:** Gleiche Mitigation wie Audit-Finding #1 — Token nur einbetten wenn
  `_is_client_authd()`. Oder: `/redesign` aus dem GET-non-API-Bypass herausnehmen und in
  `_PUBLIC_PATHS` explizit als "public ohne Token-Embedding" führen.

### P1-2: `?token=` in URLs erscheint in Server-Logs und Browser-History

- **Stelle:** `amux-server.py:31669` (neu seit `47f3b47`), `amux-server.py:13252` (JS)
- **Was:** Commit `47f3b47` akzeptiert jetzt sowohl `?_token=` als auch `?token=` für Query-String-
  Auth. `_check_auth` loggt nicht den Query-String, aber der JS-Code unter `:13252` baut URLs mit
  `?_token=…` — und wenn ein User eine solche URL kopiert (z.B. aus Dev-Tools oder Browser-History)
  landet der Token im Klartext in Copy-Paste-Buffern, Logs, Referrer-Headern zu CDN-Ressourcen
  (unpkg, Google Fonts) und Browser-Completion. Die Mitigation im Audit (`history.replaceState` um
  Token aus URL zu räumen) wurde nicht implementiert.
- **CWE/OWASP:** CWE-598 Information Exposure Through Query Strings
- **Impact:** Token-Leak-Risiko bei jedem Teilen einer URL oder bei CDN-Requests.
- **Fix-Richtung:** `history.replaceState(null,'',location.pathname)` direkt nach Token-Extraktion
  aus URL-Query ausführen (war bereits im Audit-Mitigation-Sketch vorhanden).

---

## DevEx-Findings

### P1-D1: Kein CI-Testlauf — Tests existieren, werden aber nie automatisch ausgeführt

- **Stelle:** `.github/workflows/` (7 Workflows, keiner führt `pytest` aus)
- **Was:** Es gibt Unit-Tests in `tests/` (`test_path_traversal.py`, `test_graceful_restart.py`,
  `test_bash_quoting.py` etc.) und E2E-Tests (`e2e-multi-org-pw.mjs`), aber kein Workflow
  triggert sie bei Push oder PR. Die einzige automatische Python-Nutzung in CI ist ein
  Release-Notes-Generator in `pages.yml`. Das bedeutet: Regressions in Sicherheitsfunktionen
  (Path-Traversal-Guards, Session-Name-Validation) können unbemerkt eingeschleust werden.
- **Fix-Richtung:** Einfachen `pytest tests/` Job in einem neuen `ci.yml` Workflow anlegen
  (ubuntu-latest, Python 3.11, keine Dependencies nötig — alle Tests sind standalone-Replikate).

### P1-D2: Keine Python-Dep-Deklaration — optionale Deps undokumentiert

- **Stelle:** `/Users/jan/projects/amux/` (kein `requirements.txt`, kein `pyproject.toml`)
- **Was:** `amux-server.py` importiert optional `psutil`, `boto3`, `google-auth`, `playwright`,
  `google-api-python-client` u.a. via Try/Except. Für einen neuen Contributor ist unklar, was
  installiert sein muss. `install.sh` prüft nur Python-Version und tmux — nicht die optionalen Deps.
- **Fix-Richtung:** `requirements-optional.txt` mit Kommentaren ("for S3 sync", "for Gmail") und
  ein `requirements-core.txt` für den minimal-funktionalen Start. Kein vollständiger Umbau nötig.

### P2-D1: Babel-standalone und React im unpkg-CDN, kein SRI, kein Lockfile

- **Stelle:** `amux-server.py:31782–31784` (`/redesign`), `:30992–31003` (Legacy-Dashboard)
- **Was:** 11 CDN-Scripts (React, ReactDOM, Babel-standalone, Quill, GridStack, XTerm, Chart.js,
  Leaflet, PapaParse, FullCalendar, Sortable) werden von `unpkg.com` und `cdn.jsdelivr.net` ohne
  Subresource Integrity (SRI) geladen. Für Babel-standalone ist keine Version angepinnt
  (`@7.29.0` ist angegeben; Quill-Markdown aber mit `@latest`). Kein `package-lock.json`.
  `quilljs-markdown@latest` ist ein Floating-Tag — silente Breaking-Change-Risiken.
- **Fix-Richtung:**
  1. `@latest` durch feste Version ersetzen.
  2. `integrity="sha384-..."` zu allen CDN-Script-Tags hinzufügen (einmalig mit `openssl dgst -sha384`
     generiert).
  3. Alternativ: Assets einmalig vendoren und aus `site/` ausliefern (kein CDN-Dependency im
     Betrieb).

### P2-D2: Kein `CONTRIBUTING.md`, kein Dev-Setup-Guide

- **Stelle:** `/Users/jan/projects/amux/` (nur `README.md` vorhanden, kein Contributing-Doc)
- **Was:** `README.md` erklärt den Endnutzer-Flow, aber nicht: wie man den Server lokal startet
  ohne launchd, wie man Tests ausführt, wie das Single-File-Pattern funktioniert, oder welche
  Python-Version Minimum ist. `CLAUDE.md` enthält Contributor-Infos nur für AI-Agenten.
- **Fix-Richtung:** Kurze `CONTRIBUTING.md` (dev start, test run, commit convention).

### P2-D3: `os.execv`-Hot-Reload während laufender Requests — keine Drain-Phase

- **Stelle:** `amux-server.py:37406`
- **Was:** Der File-Watcher löst `os.execv(sys.executable, [sys.executable] + sys.argv)` aus.
  HTTPServer nutzt threading — in-flight Requests werden abrupt unterbrochen. Für kurze API-Calls
  kein Problem, aber für laufende SSE-Streams (`/api/events`) oder laufende Uploads führt der Reload
  zu Silent-Drop. Clients reconnecten über den `visibilitychange`-Handler (`.claude/rules/sse-realtime.md`),
  aber Write-Operationen (File-Upload, Schedule-Create) können zur Hälfte abgeschnitten werden.
- **Fix-Richtung:** Vor `os.execv` ein Flag setzen das neue Requests mit `503 Retry-After: 2`
  ablehnt, 2–3 Sekunden warten, dann execv. Schützt nicht laufende SSE-Streams, aber Write-Ops.

---

## Supply-Chain Review

| Komponente | Version | SRI | Status |
|---|---|---|---|
| React (unpkg) | `18.3.1` | nein | Fixe Version, aber kein SRI |
| ReactDOM (unpkg) | `18.3.1` | nein | Wie React |
| Babel-standalone (unpkg) | `7.29.0` | nein | Fixe Version, kein SRI; läuft zur Laufzeit als Transpiler im Browser — besonders sensitiv |
| Quill (jsdelivr) | `2.0.3` | nein | Fix, kein SRI |
| quilljs-markdown (jsdelivr) | **`@latest`** | nein | Floating-Tag — kritisch |
| GridStack (jsdelivr) | `7` | nein | Major-Only-Pin — Minor/Patch können sich ändern |
| XTerm (jsdelivr) | `5.5.0` / `0.10.0` / `0.11.0` | nein | Fix, kein SRI |
| Chart.js (jsdelivr) | `4.4.4` | nein | Fix, kein SRI |
| Leaflet (unpkg) | `1.9.4` | nein | Fix, kein SRI |
| FullCalendar (jsdelivr) | `6.1.15` | nein | Fix, kein SRI |
| Google Fonts (CDN) | — | N/A | Kein Code, Tracking-Risiko |
| Python-Deps | keine Deklaration | N/A | Optionale Imports via Try/Except |
| npm (Playwright) | `^1.58.2` | kein Lockfile | `^`-Range, kein `package-lock.json` |
| Service-Worker (`/sw.js`) | — | — | Cached CDN-Responses; Update via Cache-Version-Bump |

Babel-standalone als Laufzeit-Transpiler ist das höchste Supply-Chain-Risiko: ein kompromittiertes
Paket auf unpkg würde beliebigen JS-Code im Browser-Kontext ausführen. Alle anderen Libraries wären
"nur" DOM-Manipulation — Babel hat die breiteste Execution-Surface.

---

## Backup / Recovery

`~/.amux/` enthält SQLite-DB (`db.sqlite3`), Session-Envs, Auth-Token, TLS-Cert/Key, Transcripts
(JSONL), Notes (Markdown), und Uploads. Es gibt keinen eingebauten Backup-Mechanismus. Bei
Korruption oder versehentlichem `rm -rf ~/.amux/`:

- **SQLite-WAL:** bei einem Crash während eines Writes kann die WAL-Datei divergieren; SQLite
  repariert beim nächsten `PRAGMA integrity_check` automatisch, aber nur wenn WAL-Journal noch
  intakt ist.
- **Token-Verlust:** `~/.amux/auth_token` wird bei Fehlen neu generiert — alle existierenden
  Browser-Sessions (Mobile-PWA, `localStorage`) werden ungültig und müssen manuell re-pairt werden.
- **Transcript-Verlust:** `~/.amux/transcripts/` ist nicht redundant; kein offsite-Backup.
- **Fix-Richtung:** `amux backup` Subcommand der `~/.amux/` als tar.gz nach `~/Documents/amux-backups/`
  sichert. Oder: restic-Integration in den vorhandenen BillyBang-Backup-Plan
  (`shared/plans/backup-konzept.md`) aufnehmen.

---

## Top-3 nächste Security-Schritte

1. **Token-Leak-Fix** (Finding #1 alt + P1-1 neu): `_is_client_authd()`-Helper implementieren und
   Token-Embedding in `/`, `/legacy`, **und `/redesign`** davon abhängig machen. Höchste
   Priorität, da `/redesign` seit `016eb2d` der Default-Einstiegspunkt ist.
2. **Webhook-Auth** (P0-1): `_VALID_SESSION_NAME_RE`-Check in beiden Webhook-Handlern ergänzen +
   optionales `AMUX_WEBHOOK_SECRET` in `server.env`. Sonst kann jeder LAN-Host Text in Claude
   injizieren.
3. **`_is_path_allowed` Whitelist** (Finding #3): Standardmäßig Pfade außerhalb `$HOME` ablehnen
   statt durchlassen. Den `except ValueError: pass`-Block durch `return False` ersetzen.

## Top-3 nächste DevEx-Schritte

1. **CI-Testlauf aktivieren** (P1-D1): `pytest tests/` in neuem `ci.yml`-Workflow, Trigger auf
   Push/PR nach `amux-server.py`. Kostet 1 Stunde, schützt alle vorhandenen Sicherheitstests.
2. **CDN-Floating-Tags fixieren** (P2-D1): `quilljs-markdown@latest` → feste Version; SRI-Hashes
   für Babel-standalone ergänzen.
3. **`requirements-optional.txt`** anlegen (P1-D2): Optionale Deps dokumentieren damit
   Contributors wissen was für welches Feature nötig ist.

---

*Delta-Methode: statische Analyse `amux-server.py` Git-Stand `d501d6a` (2026-05-14) plus
`git log --since='2026-05-12' --stat`. Baseline: `docs/security-audit-2026-05-12.md` (Stand
`5262ef7`). Kein Dynamic-Test.*

---

## Zusammenfassung (max 100 Wörter)

Top-3 Findings: **(1)** `/redesign` ist seit `016eb2d` der Default-Einstiegspunkt und leakt den
Bearer-Token ohne Auth — konkreter und akuter als die `GET /`-Variante aus dem Mai-12-Audit.
**(2)** Unauthentifizierte Inbound-Webhook-Endpunkte (`/api/webhooks/sms/` + `/smartertrack/`)
ermöglichen Text-Injection in beliebige Claude-Sessions aus dem LAN ohne Token — neu, nicht
adressiert. **(3)** Kein CI-Testlauf trotz vorhandener Tests — Sicherheitsregressions bleiben
unbemerkt. Alle 10 Findings aus dem Voraudit offen.
