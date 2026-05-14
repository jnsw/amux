# Architecture / Code-Quality Review — amux (2026-05-14)

Branch reviewed: `feat/cc-stream-redesign`
Reviewer role: neutral architecture / code-quality.

---

## TL;DR

amux is a pragmatic, solo-maintained control plane that trades textbook architecture for zero deployment friction. The single-file convention is intentional and mostly defensible at current scale. The architecture does not break today, but it has two structural tipping points approaching in parallel: (1) `DASHBOARD_HTML` at 23 700 lines is already a cognitive black-box even for the maintainer, and (2) the redesign migration adds a second live UI shipped via CDN-dependent runtime compilation — a qualitatively different risk model from the rest of the stack. The SSE backbone, auth, and SQLite usage are solid; the risk surface is in the blob-management regime and the CDN/Babel dependency chain.

---

## Architektur-Diagramm (ASCII)

```
Browser / PWA / iOS App
        │  HTTPS :8822  │  HTTP :8823 (cert download)
        ▼
┌────────────────────────────────────────────────────┐
│  amux-server.py  (ThreadingHTTPServer, Python 3.14)│
│                                                    │
│  _route_inner() — big if/elif dispatch (~5 000     │
│  routing conditionals; 217 method-match branches)  │
│                                                    │
│  GET /          → 302 /redesign (new default)      │
│  GET /legacy    → DASHBOARD_HTML (23 700 ln blob)  │
│  GET /redesign  → reads JSX/CSS from disk + CDN    │
│  GET /api/events → _sse_events() long-poll thread  │
│  GET|POST /api/* → 40+ API sections                │
│                                                    │
│  Background threads (daemon):                      │
│   _watch_self   · _scheduler_loop · _sse_cache     │
│   _auto_archive · _cleanup_*      · _db_maintenance│
│   _watch_server_env · PTY manager · browser-reaper │
└──────────┬─────────────────────┬───────────────────┘
           │                     │
    ┌──────▼──────┐       ┌──────▼──────────────┐
    │  SQLite WAL │       │  ~/.amux/ filesystem │
    │  (73 calls  │       │  sessions/*.env      │
    │   get_db()) │       │  transcripts/*.jsonl │
    └─────────────┘       │  notes/*.md, uploads/│
                          └──────────────────────┘
           │
    ┌──────▼──────────────────┐
    │  tmux  (169 subprocess  │
    │  calls, pipe-pane logs) │
    └─────────────────────────┘

Cloud path:  gateway.py (Clerk JWT) ──► injects X-Amux-User-Email
             ──► same amux-server.py in Docker container
             ──► Litestream (SQLite → S3 replication)
```

---

## P0 — Strukturelle Risiken

### P0-1: DASHBOARD_HTML — 23 700-Zeilen unsuchbarer Blob

- **Stelle:** `amux-server.py` lines 7346–31078 (constant `DASHBOARD_HTML`)
- **Was:** Das gesamte Legacy-Frontend (HTML + ~4 400 ln CSS + ~19 300 ln vanilla JS) lebt als ein einziger Python-raw-string. Syntax-Highlighting, Grep, Diff-Tools arbeiten alle im "falschen" Modus. Lokale `import json as _json`-Wiederholungen (38× in der Datei) und auskommentierte Blöcke zeigen, dass normale Refactoring-Disziplin hier nicht greift.
- **Warum riskant:** Ein Fehler mitten im Blob lässt sich nicht durch AST-Parse finden (das prüft nur Python-Syntax, nicht das JS). Race-Conditions in der Vanilla-JS-State-Machine (`_sseFallback`, `_liveSSE`, `lastSessionsJSON`) sind praktisch untestbar. Die 15 Haupt-Tabs plus Hidden-Sub-Views teilen einen globalen Namespace ohne Modul-Grenzen — `window.amuxTrack`, `_cloudEmail`, `fetchBoard`, `_sse` sind alle global.
- **Fix-Richtung:** Das ist das Hauptargument für die Migration auf den Redesign-Branch. Solange das Legacy noch default ist (selbst via 302 auf /redesign) bleibt der Blob das Produktions-Frontend für alles außer Sessions+Board. Klare Abschaltung nach Tab-for-Tab-Migration; danach der Blob weg.

### P0-2: CDN-Abhängigkeit im Redesign-Pfad — kein Offline-Fallback

- **Stelle:** `amux-server.py` lines 31782–31784 (in `_route_inner` GET /redesign)
- **Was:** Die neue Default-UI lädt React 18 UMD + Babel-standalone 7.29 live von `unpkg.com` bei jedem Request. Babel kompiliert JSX zur Runtime im Browser.
- **Warum riskant:** (a) LAN-only-Deployment (BillyBang, kein Internet) bricht die UI still, weil CDN-Requests über WireGuard auslaufen. (b) Babel-standalone 7.29 (~900 KB) + React Development Build (~1.1 MB) = ~2 MB unkomprimiertes JS bei jedem Cold-Load — 3–5 s Transpile-Blockade auf Mobile. (c) `react.development.js` ist die Debug-Variante; production-Bundle ist ~2× kleiner und schneller. (d) Unpkg hat keine SLA; bei Outage ist die neue Default-UI tot ohne Fallback auf /legacy. (e) Versionspinning in der URL ist gut, aber eine Content-Security-Policy fehlt.
- **Fix-Richtung:** Sofort-Fix: die drei CDN-Skripte als statische Python-Strings in den Server inlinen (einmalig ~900 KB komprimiert; passt in den Single-File-Ansatz). Mittelfristig: esbuild/Vite-Buildschritt der JSX zu einem ES-Modul bundelt und als `REDESIGN_JS`-Konstante einfügt — analog zu `DASHBOARD_HTML`.

### P0-3: `/` leitet per 302 auf `/redesign` um, aber `/redesign` lädt Dateien von Disk

- **Stelle:** `amux-server.py` line 31699–31706 (302) und 31745–31792 (Disk-Read)
- **Was:** Der neue Default-Flow ist: Browser → GET / → 302 /redesign → Server liest `docs/redesign/project/src/*.jsx` vom Dateisystem. In einem Docker-Container (Cloud) ist `docs/redesign/` nur vorhanden wenn das Checkout vollständig ist; ein schlankes Docker-Image ohne `docs/` liefert eine Fehlerseite. Der `INTEGRATION.md`-Plan sagt explizit, die JSX müssten als Python-Strings ingelinest werden (§7) — das ist noch nicht passiert.
- **Warum riskant:** Cloud-Deploy ist produktiv gebrochen wenn `docs/` nicht im Image ist; das ist der Fall sobald `.gitignore` oder das Dockerfile nicht explizit sichergestellt wird. Darüber hinaus macht Disk-Read on Request den Vorteil des Single-File-Patterns (alles im Binary) zunichte.
- **Fix-Richtung:** Inline-Migration vor dem Cloud-Deploy. Alternativ: im Dockerfile sicherstellen dass `docs/redesign/` kopiert wird; Guard-Check in `_route_inner` bereits vorhanden (`if not base.exists()`), aber er gibt eine Fehlerseite statt Fallback auf /legacy.

---

## P1 — Wartbarkeit / Skalierung

### P1-1: Routing — 217 `if method ==` Branches, kein URL-Router

Die gesamte API ist ein flacher if/elif-Baum in `_route_inner`. Das ist bei 217 Branches lesbar (Section-Kommentare helfen), aber jede neue Route verlängert den kritischen Pfad. Fehlerbehandlung (`_read_body`, `json.loads`, 500-Fallback) ist konsistent, aber es gibt kein zentrales Middleware-Konzept für Dinge wie Rate-Limiting oder Request-Logging jenseits des Schluss-Finally.

### P1-2: Cloud-Branches in der JS-Seite — Single-Codebase-Regel partiell verletzt

CLAUDE.md sagt "no `if IS_CLOUD` branches". In der Python-Seite ist das eingehalten (1× `is_cloud = bool(os.environ.get("AMUX_PORT"))` nur für Default-Session-Init). Auf der JS-Seite in `DASHBOARD_HTML` gibt es 16 Vorkommen von `_cloudEmail` und `is_cloud`-Checks — UI-Zweige für cloud-only Modals, API-Key-Pflicht, Logout-Button, `/root`-Default-Pfad. Das ist nicht regelwidrig (es geht um header-getriebenes Verhalten, nicht Build-Flags), aber es verwischt die Linie. Mittelfristig sollte die Redesign-App dieselbe Logik via `window._AMUX_USER_EMAIL` sauber kapseln.

### P1-3: SSE-Thread-Lifetime-Cap + Polling-Fallback-Asymmetrie

Der SSE-Loop in `_sse_events` ist gut strukturiert (Ping alle 10 s, 5-Minuten-Cap, socket-timeout 10 s). Der Polling-Fallback im Legacy-Dashboard (`connectSSE` → `_sseFallback`) deckt sessions + board ab (regelkonform). Der Redesign-Store (`store.jsx`) implementiert ebenfalls beide Fallbacks korrekt (15 s Polling). **Diskrepanz:** Der Legacy-SSE-Stream schickt auch `type: "invalidate"` für notes/crm/journal — der Redesign-Store ignoriert `invalidate`-Events (Zeile 190: leerer Kommentar). Sobald die Redesign-UI notes oder CRM bekommt, bleibt sie ohne Daten-Refresh auf veralteten Werten.

### P1-4: Per-Thread SQLite-Connections — korrekt, aber nie geschlossen

`get_db()` öffnet eine Connection pro Thread (thread-local). Bei `ThreadingHTTPServer` ist jede Request ein Thread aus dem Pool — Connections akkumulieren bis zum `os.execv`-Restart. Mit WAL + busy_timeout=5000 ms ist das in der Praxis stabil, aber FD-Leaks sind beim `fd_count`-Monitoring (`/health`) bereits sichtbar. Kein Connection-Pool, kein explizites `close()` auf idle Threads.

### P1-5: subprocess/tmux ohne Session-Level-Lock

`tmux_capture`, `start_session`, `stop_session` spawnen tmux-Subprozesse ohne Session-Level-Locking. Die einzige Ausnahme ist der Browser-Lock (`_browser_locks` per session). Bei parallelen API-Calls (z. B. SSE-Cache-Refresh + manueller Start zur selben Zeit) können Race-Conditions in tmux-Rename oder pipe-pane entstehen. In der Praxis selten (Solo-User), aber nicht documentiert als Known Gap.

---

## P2 — Polish / Nice-to-Have

- **Service-Worker Cache-Key hardcoded** (`amux-v0.6.6` in `SERVICE_WORKER`): Wird bei Deploys nicht automatisch gebumpt → altes HTML bleibt gecacht. Sollte aus einer Server-Variable stammen.
- **`/redesign` schickt `react.development.js`**: Dev-Build ist ~2× größer als Production, enthält Runtime-Warnungen die auf der Konsole rauschen. Für Preview akzeptabel, für Default-Route nicht.
- **Redesign `app.jsx` zeigt hardkodierte Workspace-Namen** (`Atlas`, `Marketing`, `Ops`): In `store.jsx` wird `startMockSSE()` zu `startRealSSE()` aliased — gut. Aber `app.jsx` Zeile 9–13 initialisiert mit 3 Mock-Workspaces. Diese werden nach SSE-Verbindung nie durch echte Daten ersetzt (kein Workspace-Persistence-API vorhanden).
- **`_safe_note_path` ist gut** (Path-Traversal-Guard mit `.resolve()` + `relative_to()`). Das ist defensive coding am Boundary, genau richtig.
- **Babel `data-presets="react"`** im `<script type="text/babel">`: Babel-standalone parsed und transpiliert alle 3 700 JSX-Zeilen bei jedem Page-Load. Ergebnis wird nicht gecacht (kein `data-type="module"` + Browser-Cache).

---

## Single-File-Konvention: Wann kippt sie?

**Heute:** Die Konvention ist für einen Solo-Maintainer mit KI-Assistenz rational. Ein `git diff amux-server.py` zeigt den gesamten Change-Set; kein Module-Graph, kein Build-Step, Restart in < 1 s. Conway's Law: 1 Maintainer → 1 Datei ist konsistent.

**Kippt bei folgenden Indikatoren:**

| Indikator | Aktuell | Kipp-Schwelle |
|---|---|---|
| Gesamtgröße | 37 700 LOC / 1,8 MB | >50 000 LOC (grep-Latenz, Editor-Lag) |
| Python-Anteil | ~14 000 LOC (37%) | — |
| Blob-Anteil (HTML/CSS/JS) | ~23 700 LOC (63%) | Bereits jenseits sinnvoller Editierbarkeit |
| Syntaxprüfung | `ast.parse()` prüft Python, nicht JS | Kein JS-Linting möglich |
| Restart-Zeit | ~1 s (os.execv) | Kein Problem |
| Kognitiver Load | Section-Kommentare helfen; JS-Blob ist black-box | Bereits bei DASHBOARD_HTML erreicht |
| Zweiter Contributor | — | Sofort Problem (kein Parallelwork möglich) |

**Fazit:** Die Python-Seite kann wachsen. Der Blob-Anteil ist das eigentliche Problem — nicht die Datei-Einheit, sondern dass 23 700 Zeilen unstrukturiertes HTML/JS darin leben. Die Migration auf den Redesign-Branch (JSX-Module + echte Typen durch React-Props) löst das Wartbarkeitsproblem ohne die Konvention aufzugeben — die JSX werden am Ende als Python-String `REDESIGN_JS = r"""..."""` ingelinest, aber aus editierbaren Modulen gebaut.

---

## Legacy ↔ Redesign Migration

**Was ist dupliziert:**
- Theme-System: Tokens in `docs/redesign/project/src/tokens.css` und inline in `DASHBOARD_HTML` (6 Themes × light/dark). Accent, Density, Animations wurden bereits aus der Redesign-CSS in den Legacy-Blob portiert (2026-05-11) — es gibt jetzt zwei kanonische Token-Quellen.
- SSE-Reconnect-Logik: Legacy (`connectSSE`, `_onClientResume`) und Redesign (`startRealSSE`, `_ensureStaleWatcher`, `_onClientResume`) sind funktional identisch, aber dupliziert. Das ist bewusst und vertretbar während der Migration.
- Auth-Pattern: Beide lesen `window._AMUX_AUTH_TOKEN` und hängen `?token=` an SSE-URLs.

**Was im Legacy noch unique ist (Redesign hat es nicht):**
Scheduler, Files, Notes, Logs, Metrics, Terminal, Browser, CRM, Map, Habits, Torrents, Journal, Channels, Graph, Reports, Recordings, Skills, Org, Settings, Gmail/Email — das sind **~14 Tabs** die nur im 23 700-Zeilen-Blob existieren. Die Redesign-Preview deckt Sessions + Board + Calendar mit echter API-Anbindung ab.

**Was sofort weg kann (nach Cutover):**
- `DASHBOARD_HTML` (23 700 LOC) — größte Einzelreduktion
- `/legacy`-Route + Legacy-Fallback-Logik in `_route_inner`
- Duplizierte Theme-CSS-Blöcke in `DASHBOARD_HTML` (Tokens bleiben in `tokens.css`)

---

## Babel-Standalone Future

**Empfehlung: Ersetzen durch esbuild-Bundling, nicht Pinnen.**

Pinnen auf `@babel/standalone@7.29.0` ist das Minimum (bereits getan via unpkg-URL). Aber der eigentliche Handlungsbedarf ist:

1. **Kurzfristig (vor Cloud-Deploy):** React + ReactDOM + transpiliertes JS als statische Python-Bytes in den Server inlinen. Einmalig ~300 KB gzipped. Keine CDN-Abhängigkeit, keine Runtime-Transpilation.

2. **Mittelfristig (nach Tab-Migration, pre-Cutover):** Einen Build-Schritt einführen:
   ```bash
   esbuild docs/redesign/project/src/app.jsx --bundle --minify \
     --external:react --external:react-dom > REDESIGN_JS_BUNDLE
   ```
   Output als `REDESIGN_JS = r"""..."""` in `amux-server.py` einfügen. React/ReactDOM als UMD-Globals weiterhin ingelinest. Babel-standalone fällt weg.

3. **Nicht empfohlen:** Vite als Full-Dev-Server einführen (Build-Komplexität steigt; Single-File-Convention erfordert am Ende trotzdem einen Inline-Step; kein Vorteil über esbuild).

**Bundle-Size-Realität heute:** Babel-standalone 7.29 = ~900 KB minified, ~240 KB gzipped. React 18 dev = ~1,1 MB. Gesamt: ~2 MB unkomprimiert pro Page-Load. Mit produktiven UMD-Builds + esbuild-Bundle: ~150 KB gzipped. Factor 15× Verbesserung.

---

## Top-3 nächste Schritte

1. **CDN-Abhängigkeit eliminieren** (P0-2): React + ReactDOM + Babel-standalone als statische Bytes in den Server inlinen, bevor `/redesign` die Default-Route für Cloud ist. Schützt gegen Netzwerkausfälle und LAN-only-Deployments.

2. **Legacy-Blob abbauen** (P0-1): Die Tab-für-Tab-Migration (`INTEGRATION.md` §Schrittpath) konsequent durchziehen. Jeder migrierte Tab ist ein direkter LOC-Abbau im Blob und ein Gewinn für Testbarkeit. Ziel: DASHBOARD_HTML auf < 5 000 LOC (Shell + Fallback-Stubs) reduzieren.

3. **Redesign-JSX von Disk auf Inline** (P0-3): Vor dem nächsten Cloud-Deploy die JSX/CSS-Dateien als Python-Strings inlinen analog zu `DASHBOARD_HTML`. Disk-Abhängigkeit zur Runtime entfernen; macht den Server wieder self-contained.
