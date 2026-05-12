# amux — Frontend-Spec (Meta-Daten für Re-Design)

Single-file Selfhost-Dashboard für Claude-Code-Multiplexing. Inventar aller UI-Bereiche, Datenmodelle, REST-Endpoints, Realtime-Events, Theme-System und Mobile-Constraints — als Grundlage für ein neues Frontend.

Quelle: `amux-server.py` (Stand 2026-05-11, ~37 k Zeilen, ~1.8 MB; **identisch für Local + Cloud**, kein `IS_CLOUD`-Branch).

---

## 1. Stack-Kontext

| | |
|---|---|
| **Server** | Python 3.14 (Homebrew), stdlib `http.server` + Threading, alles in einer Datei `amux-server.py` |
| **Persistenz** | SQLite (`~/.amux/amux.db`, WAL-Mode, Thread-local Conns) + Filesystem (`~/.amux/sessions/`, `transcripts/`, `notes/`, `uploads/`, `gmail/`, `branding/`, `journal_media/`) |
| **Realtime** | Server-Sent Events `GET /api/events` (mit 10 s Heartbeat, Stale-Detection 18 s, Reconnect-Events) |
| **Transport** | HTTPS auf `:8822` (self-signed Cert) + HTTP-Cert-Server auf `:8823` für Mobile-Onboarding (`/api/cert`, `/ca`) |
| **Auth** | Bearer-Token in `~/.amux/auth_token` (0600), Frontend liest aus `window._AMUX_AUTH_TOKEN`, schickt `Authorization: Bearer …` |
| **PWA** | `manifest.json` + `sw.js` (cache-first App-Shell, localStorage-HTML-Fallback für Offline) |
| **Auto-Restart** | Server beobachtet eigene `mtime` und `os.execv`'t bei Code-Änderung; Service-Worker pre-cached neuen App-Shell mit Version-Bump (`amux-v0.6.6` o. ä.) |
| **Sessions** | Filesystem-basiert (`*.env` pro Session), nicht in SQLite. Live-Preview via `tmux capture-pane`, Transcripts aus `~/.claude/projects/<proj>/<convId>.jsonl` |

### Wichtige Storage-Verzeichnisse

```
~/.amux/
├── amux.db              # SQLite (alle strukturierten Daten, siehe §3)
├── auth_token           # 0600
├── tls/{cert,key}.pem
├── sessions/<name>.env  # 1 File pro Session, Source of Truth für Session-Config
├── transcripts/<session>/*.jsonl  # rotierte Claude-Code-Konversationen
├── notes/<path>.md
├── uploads/<file>
├── gmail/<account-id>/...
├── branding/<key>       # custom Logo/Favicon
├── journal_media/...
├── meta/<name>.json     # Session-Metadaten (last_send, cc_conversation_id, …)
└── server.env           # persistente env-Vars (AMUX_S3_BUCKET, …)
```

---

## 2. UI-Architektur

### 2.1 Top-Level-Tabs (Reihenfolge user-customizable via Tab-Customizer)

| ID | Label | Was es ist |
|---|---|---|
| `sessions` | **Sessions** | Default-View. Liste aller Claude-Code-Sessions als Karten. Filter, Bulk-Actions, Live-Status |
| `board` | **Board** | Kanban (Backlog/To Do/In Progress/In Review/Done/Discarded), Issues mit Tags, Due, Session-Zuweisung, Owner-Type (human/agent) |
| `calendar` | **Calendar** | Monats-/Wochen-View für Board-Items mit `due` + Email-erkannte Events; iCal-Feed-Export (`/api/calendar.ics`) |
| `scheduler` | **Scheduler** | Cron + Free-Text-Schedules (`every 30m`, `daily at 09:00`), Live-Preview der nächsten Ausführung, Pause/Resume, Run-Now, Edit, Run-Historie |
| `files` | **Files** | Workspace-File-Browser (read/write/upload/delete), Autocomplete-Pfad, Transcode-Endpoint für Media |
| `logs` | **Logs** | Event-Log (`category`, `action`, `session`, `level`), Raw-Tail, Stats nach Category |
| `grid` | **Workspace** | Multi-Pane-Grid-Mode mit Tab-Layout-Presets |
| `notes` | **Notes** | Markdown-Notes (`~/.amux/notes/`), Trash + Restore, Pin |
| `crm` | **People** | CRM Contacts + Interactions + Follow-ups |
| `map` | **Map** | Geo-Suche + Pins (für Journal-Locations etc.) |
| `metrics` | **Metrics** | Live-System-Stats (CPU/RAM, Disk, Network), pro Session falls `psutil` da, Speedtest-Buttons, Daily-Token-Stats |
| `torrents` | **Torrents** | qBittorrent-Bridge (Config + Liste) |
| `terminal` | **Terminal** | Web-Terminal mit Tmux-Sessions |
| `browser` | **Browser** | Playwright-Bridge: Profile, Navigate, Screenshot, Action, Agent-Modus |
| `habits` | **Habits** | Tägliche Habits-Liste |

Verstecke Sub-Views (innerhalb Tabs / Modal):
- **Journal** (Sub-Tabs `list`/`calendar`/`media`/`map`)
- **Channels** (DM zwischen Org-Members)
- **Graph** (Nodes/Edges; Mindmap-Style)
- **Reports** (Infra-Spend etc., konfigurierbar)
- **Recordings** (Audio/Video aus `~/.amux/recordings/`)
- **Skills** (Markdown-Skills-Editor)
- **Org** (Members, Invites)
- **Settings** (Default-Model, Env-Vars, Branding, Theme, Layout-Presets)
- **Gmail / Email** (OAuth-Connect, Inbox, Send, Reply, AI-Event-Extraction)

### 2.2 Globale UI-Patterns

- **Peek-Panel** — Sidebar-Detail-View für ausgewählte Session: Tabs für Output / Files / Notes / Schedules / Tasks / Channel / Memory. Re-used in Mobile als Bottom-Sheet.
- **Modals** — eigene Modal-Komponente für Schedule-Create/Edit, Session-Erstellung, Note-Rename, Confirm-Dialoge. Kein `window.prompt()` mehr.
- **Tab-Customizer-Menu** — versteckt/zeigt/sortiert Tabs (Layout-Presets persisted in DB-Tabelle `layout_presets`).
- **Card-Menus** — Dropdown am Karten-Rand für Aktionen (Stop / Archive / Duplicate / Steer / Delete).
- **Chip-Picker** — Multi-Select mit Pills für Tags, Recurrence, Status.
- **Edit-Box** — Inline-Editor (Click-to-edit) für Titel/Description.
- **Branch-Popover** — Git-Branch-Auswahl beim Session-Erstellen (mit Suggest-Branch-API).
- **Audio-Bar** — Fixed-Bottom-Player (`.amux-audio-bar`, Safe-Area-Bottom).
- **TTS-Dialog** — Voice-Auswahl + Text-to-Speech.

---

## 3. Datenmodelle (SQLite-Schema)

Alle `id`-Felder sind `TEXT` (UUID/Slug), Timestamps sind `INTEGER` Unix-Sekunden (außer `due`, `next_run`, etc. = ISO `YYYY-MM-DDTHH:MM`).

### 3.1 Board / Issues

```sql
statuses(id PK, label, position INT, is_builtin INT)
-- Seeds: backlog, todo, doing, review, done, discarded
issues(id PK, title, desc, status FK→statuses, session, creator, due,
       created INT, updated INT, deleted INT, owner_type 'human'|'agent')
issue_tags(issue_id, tag) -- M2M
issue_counters(prefix PK, next_n)  -- Issue-Nummerierung pro Prefix
```

### 3.2 Sessions (Filesystem, kein SQL)

Pro Session: `~/.amux/sessions/<name>.env` mit Key=Value-Paaren:
- `CC_DIR` — Working-Directory
- `CC_PROVIDER` — `claude` (default) | `codex`
- `CC_FLAGS` — CLI-Flags
- `CC_BRANCH` — Git-Branch
- … plus `~/.amux/meta/<name>.json` mit `last_send`, `last_started`, `cc_conversation_id`

`list_sessions()` returns:
```ts
{
  name: string,
  running: boolean,
  preview: string,
  preview_lines: string[],
  status: 'active' | 'waiting' | 'idle' | '',
  task_name: string | null,    // aus Board-Issue mit status='doing'
  task_time: string,
  active_model: string,
  last_activity: int,
  session_created: int,
  cwd: string,
  branch: string,
  provider: 'claude' | 'codex',
  tokens: { input, output, total, cached },
  // …
}
```

### 3.3 Tasks (per-Session Todo)

```sql
tasks(id PK, session, text, done INT, pos INT, created INT, updated INT)
```

### 3.4 Schedules

```sql
schedules(id PK, title, session, command,
          sched_type 'once'|'recurring',
          recurrence TEXT|NULL,       -- z.B. 'daily-09:00'
          schedule_expr TEXT|NULL,    -- Cron oder Free-Text (priorisiert vor recurrence)
          run_at TEXT|NULL,           -- ISO für 'once'
          next_run TEXT, last_run TEXT,
          enabled INT, created INT, updated INT, deleted INT)
schedule_runs(id PK, schedule_id, ran_at INT, status, note)
```

Cron-Parser unterstützt: `*`, `*/N`, `A-B`, `A,B,C` über 5 Felder (MIN HOUR DOM MON DOW).
Free-Text: `every 30m`, `every 2h`, `daily at 09:00`, `every weekday at 9am`, `every monday`.
**Nicht** unterstützt: `0-30/15`, named days `MON,WED`.

### 3.5 Reports

```sql
reports(id PK, name, type 'infra-spend'|…, config JSON, position INT,
        created INT, last_refresh INT, cached_data JSON)
```

### 3.6 Logs

```sql
logs(id, ts INT, category 'system'|'session'|'board'|'memory'|'file'|'http'|…,
     action, session, actor, detail, level 'info'|'warn'|'error')
```

### 3.7 Email + Gmail

```sql
email_accounts(id PK, email UNIQUE, access_token, refresh_token, token_expiry,
               calendar_id, last_synced, created, enabled)
email_events(id PK, account_id, gmail_message_id, gmail_thread_id,
             email_subject, email_from, email_date,
             event_title, event_start, event_end, event_location, event_description,
             calendar_event_id, status 'pending'|'imported'|'skipped',
             raw_extract, created)
```
Funktion: Inbox-Scan via LLM → Event-Extraktion → Google-Calendar-Push.

### 3.8 Org / Members

```sql
org(id PK='default', name, created_at)
org_members(id PK, email UNIQUE, name, role 'admin'|'member', joined_at)
org_invites(token PK, email, created_at, expires_at, used_at, used_by)
```

### 3.9 CRM

```sql
crm_contacts(id PK, name, company, role, email, linkedin, twitter, phone, notes,
             created, updated, deleted)
crm_tags(contact_id, tag)
crm_interactions(id PK, contact_id, date, type 'call'|'meeting'|'email'|'other',
                 notes, follow_up_date, follow_up_note, created, updated)
```

### 3.10 Journal (Tagebuch)

```sql
journal_entries(id PK, text, date, created, updated,
                lat REAL, lng REAL, place_name,
                starred INT, tags CSV,
                prompt1, prompt2, prompt3, deleted)
journal_media(id PK, entry_id FK, filename, mime, position, created)
```

### 3.11 Sharing

```sql
share_tokens(token PK, session, perms 'output'|'full', created_at, expires_at, label)
```
Routes: `/s/<token>` (public read), `/api/share/<token>` für API-Zugriff.

### 3.12 Layout-Presets (Tab-Order pro User-Workspace)

```sql
layout_presets(name PK, hidden JSON-Array, tab_order JSON-Array, created_at)
```

### 3.13 Graph (Mindmap)

```sql
graph_nodes(id PK, graph_id, label, body, color, folder, source_path,
            x REAL, y REAL, pinned, created, updated)
graph_edges(id PK, graph_id, source FK, target FK, label, created)
```

### 3.14 Restliche kleine Tables

- `prefs(key PK, value)` — KV-Store für Settings
- `skills(name PK, content, updated)` — Markdown-Skills
- `cmd_history(id, text, type, session, ts)` — Command-Palette-History
- `waitlist(id, email UNIQUE, note, ts)` — Public-Waitlist-Endpoint

---

## 4. REST-API (129 Pfade + Session-Sub-Actions)

Alle `/api/*`-Pfade brauchen `Authorization: Bearer <token>` **außer** den Public-Paths.

### 4.1 Public-Paths (kein Auth nötig)

- `/`, `/manifest.json`, `/sw.js`, `/icon.svg`, `/icon.png`, `/icon-192.png`, `/icon-512.png`
- `/ca`, `/api/cert` — Cert-Download für Mobile
- `/release-notes`, `/api/release-notes`
- `/api/calendar.ics` — iCal-Feed
- Prefixes: `/s/*` (Shares), `/api/share/*`, `/invite/*`, `/proxy/*`, `/api/branding/*`

### 4.2 Endpoint-Gruppen

#### Sessions
- `GET /api/sessions` — Liste (SWR-Cache, ~5 s TTL)
- `GET /api/sessions-git` — Bulk-Git-Info für alle Sessions
- `GET /api/sessions/self` — Eigene Session-Info (wenn aus Session aus aufgerufen)
- `POST /api/sessions` — Erstellen (Body: `{name, cwd, provider, flags, branch, …}`)
- `POST /api/sessions/connect` — Mit existierender Tmux-Session verbinden
- `GET /api/tmux-sessions` — Tmux-Liste
- `GET /api/git-branches?dir=…` — Branch-Liste für Dir
- `GET /api/git-check?dir=…` — Repo-Status
- `POST /api/suggest-branch` — KI-Vorschlag für Branch-Namen
- Pro Session (`<name>`):
  - `GET    /api/sessions/<name>/meta`
  - `GET    /api/sessions/<name>/stats`
  - `GET    /api/sessions/<name>/peek?lines=N` — Pane-Capture
  - `POST   /api/sessions/<name>/start`
  - `POST   /api/sessions/<name>/stop`
  - `POST   /api/sessions/<name>/send` — Body: `{text}`
  - `POST   /api/sessions/<name>/steer` / `DELETE` — Inline-Steering
  - `POST   /api/sessions/<name>/archive`
  - `POST   /api/sessions/<name>/wake`
  - `POST   /api/sessions/<name>/duplicate`
  - `POST   /api/sessions/<name>/memory`
  - `POST   /api/sessions/<name>/peek`
  - `POST   /api/sessions/<name>/share` — Token erzeugen
  - `PATCH  /api/sessions/<name>` / `/config`
  - `DELETE /api/sessions/<name>`
  - `GET    /api/sessions/<name>/git` — Detailliertes Git-Status
- Login-Flow (Claude-Code-OAuth):
  - `POST /api/sessions/login/start`
  - `POST /api/sessions/login/send`

#### Board
- `GET /api/board` · `POST /api/board` · `PATCH /api/board/<id>` · `DELETE /api/board/<id>`
- `POST /api/board/clear-done`
- `GET/POST/PATCH/DELETE /api/board/statuses`
- `PUT /api/board/statuses/reorder`
- `GET /api/board/tag-completion?prefix=…`

#### Schedules
- `GET /api/schedules`
- `POST /api/schedules` · `PATCH /api/schedules/<id>` · `DELETE /api/schedules/<id>`
- `POST /api/schedules/preview` — Dry-Run-Parse für Live-UI-Feedback. Body: `{schedule_expr}`. Returns `{ok, next_run, human}` oder `{ok:false, error}`
- `POST /api/schedules/<id>/run-now`
- `GET /api/schedules/runs?schedule_id=…` — Lauf-Historie

#### Notes
- `GET  /api/notes` — Tree
- `GET  /api/notes/<path>` · `POST /api/notes/<path>` · `DELETE /api/notes/<path>` · `PATCH` (rename)
- `POST /api/notes/<path>/pin`
- `GET  /api/notes/trash`
- `POST /api/notes/trash/<file>/restore`
- `DELETE /api/notes/trash/<file>` — Permanent

#### Files / FS / Uploads
- `GET /api/ls?path=…` — Directory-Listing
- `GET /api/file?path=…` — Read (mit MIME)
- `GET /api/file/raw?path=…` — Binary
- `GET /api/file/transcode?path=…` — Media-Transcode
- `GET /api/file/vtt?path=…` — Subtitle-Track
- `PUT /api/file` — Write
- `GET /api/autocomplete/dir?prefix=…`
- `POST /api/fs/open` — In nativem File-Manager öffnen
- `POST /api/fs/upload` · `DELETE /api/fs/delete`
- `POST /api/upload` · `POST /api/uploads/<…>` · `GET /api/uploads/<…>`

#### Calendar / Sync
- `GET /api/calendar.ics` — iCal-Feed (public)
- `GET /api/sync` — Manueller Sync-Trigger

#### Logs
- `GET /api/logs?session=…&category=…&limit=…`
- `GET /api/logs/raw` — Tail
- `GET /api/logs/stats` — Aggregation
- `GET /api/log-search?q=…`

#### Metrics
- `GET /api/metrics` — CPU/RAM/Disk/Network, `python_executable`, `psutil` flag
- `GET /api/speedtest/download` · `POST /api/speedtest/upload`
- `GET /api/stats/daily` · `POST /api/stats/reset`
- `GET /api/recordings`

#### Email + Gmail
- Gmail OAuth: `GET /api/gmail/auth`, `GET /api/gmail/callback`, `POST /api/gmail/connect`, `DELETE /api/gmail/account`
- `GET /api/gmail/accounts` · `GET /api/gmail/inbox` · `GET /api/gmail/labels`
- `POST /api/gmail/send`
- Unified Email: `GET /api/email/events`, `POST /api/email/sync`, `GET /api/email/inbox`, `POST /api/email/send`, `POST /api/email/reply`, `GET /api/email/search`, `GET /api/email/message/<id>`

#### CRM
- `GET /api/crm/contacts` · `POST /api/crm/contacts` · `PATCH/DELETE /api/crm/contacts/<id>`
- `GET /api/crm/contacts/<id>/interactions` · `POST` (in `/api/crm/<…>`)
- `GET /api/crm/followups`

#### Journal
- `GET /api/journal` · `POST /api/journal` · `PATCH/DELETE /api/journal/<id>`
- `GET /api/journal/tags`
- `GET/POST /api/journal/config`
- `POST /api/journal/import`
- `GET /api/journal/media/<filename>`

#### Org / Invites
- `GET /api/org` · `PATCH /api/org`
- `GET /api/org/members` · `DELETE /api/org/members/<id>`
- `GET/POST /api/org/invites` · `DELETE /api/org/invites/<token>`

#### Map
- `GET /api/map` · `GET /api/map/search?q=…`

#### Skills + Slash-Commands
- `GET /api/skills` · `GET /api/skills/<name>` · `POST /api/skills/<name>` · `DELETE /api/skills/<name>`
- `GET /api/slash-commands`

#### TTS
- `GET /api/tts/voices` · `POST /api/tts` — Body: `{text, voice}`

#### Terminal (Web-Term)
- `POST /api/terminal/create` · `GET /api/terminal/sessions` · `GET /api/terminal/<id>/output`

#### Browser (Playwright)
- `GET /api/browser/profiles` · `GET /api/browser/pw-profiles`
- `POST /api/browser/start` · `POST /api/browser/stop` · `POST /api/browser/save-profile`
- `POST /api/browser/navigate` · `POST /api/browser/action` · `POST /api/browser/agent`
- `GET /api/browser/screenshot` · `GET /api/browser/state` · `GET /api/browser/search` · `GET /api/browser/sessions`

#### Torrents (qBittorrent)
- `GET/POST /api/torrents` · `GET/POST /api/torrents/config`

#### Graph (Mindmap)
- `GET/POST/PATCH/DELETE /api/graph/nodes` · `/api/graph/edges` · `/api/graph/<graph-id>`

#### Channels (DM zwischen Org-Members)
- `GET /api/channels` · `GET /api/channels/<id>` · `POST /api/channels/<id>/send`

#### Habits / Notifications / History / Memory
- `GET /api/habits` · `POST /api/habits`
- `GET/POST /api/notifications` · `PATCH/DELETE /api/notifications/<id>`
- `GET/POST/DELETE /api/history` · `POST /api/history/import`
- `POST /api/memory/global` · `POST /api/sessions/<name>/memory`

#### Settings + Misc
- `GET/POST /api/prefs`
- `GET/POST /api/settings/default-model` · `GET/POST /api/settings/env`
- `GET/POST/PATCH/DELETE /api/layout-presets` · `/api/layout-presets/<name>`
- `GET /api/templates` — Session-Templates
- `GET /api/branding` · `GET /api/branding/<key>` — Logo/Favicon/Name override
- `POST /api/lookup` — Universal-Search (DNS-Style)
- `POST /api/pull` — `git pull` im Server-Repo
- `GET /api/identity` — Aktueller User (aus `X-Amux-User-Email` Header oder local)
- `POST /api/waitlist` — Public-Anmeldung

#### Realtime
- `GET /api/events` — SSE-Stream (siehe §5)

---

## 5. SSE / Realtime

**Stream:** `GET /api/events` (text/event-stream, persistent)

### Event-Format

```
event: <name>\n
data: <json>\n\n
```

### Event-Typen (beobachtet)

| Event | Payload | Trigger |
|---|---|---|
| `ping` | `{}` | alle 10 s vom Server (Client erkennt Zombie-Connection ab 18 s Silence) |
| `reconnect` | `{}` | Server fordert Client zum Reconnect auf (z. B. nach Auto-Restart) |
| `session-update` | `{name, …}` | start/stop/send/steer/archive/wake/config/delete |
| `board-update` | `{id, action: 'created'|'updated'|'deleted'}` | Issue/Status-Änderung |
| `schedule-update` | `{id, …}` | Create/Edit/Run/Delete |
| `note-update`, `file-update`, `memory-update`, `log-append` | analog | jeweilige Mutation |

### Client-Resume-Pattern (`_onClientResume`)

Trigger: `visibilitychange`, `pageshow`, `focus`, `online`.
Wenn letzte Daten > 4 s alt → erzwungener Refetch (Sessions + Board parallel).

### SWR-Cache (Server-side)

`_sse_cache["sessions"]` mit `data`, `json`, `time`. TTL 5 s. `list_sessions()` ist teuer (Tmux-Capture für jede Session) → SWR-Pattern verhindert Thundering-Herd.

---

## 6. Theme-System

Themes werden via CSS-Custom-Properties (`--bg`, `--card`, `--border`, `--text`, `--dim`, `--accent`, `--green`, `--red`, `--yellow`, `--cyan` plus theme-spezifische `--quiet-*`, `--glass-*`) applied. Persistiert in `localStorage`.

### Verfügbare Themes

| Name | Light-Modus | Spezialoption | Default-Look |
|---|---|---|---|
| `github` | ✅ | — | GitHub-style (Dark-Default, Bg `#0d1117`) |
| `quiet` | ✅ | — | Linear-inspired Minimalist, Bg `#0a0a0a` |
| `glass` | ✅ | — | Glassmorphism mit Backdrop-Filter |
| `phosphor` | ❌ | `scanlines` | Green-CRT-Terminal, Bg `#050a05` |
| `phosphor-amber` | ❌ | `scanlines` | Amber-CRT-Terminal, Bg `#0a0703` |
| `trade` | ❌ | `dense` | Bloomberg-Terminal-Style, Bg `#000000` |

### LocalStorage-Keys

- `amux_theme_name` — z. B. `github`
- `amux_theme_light` — `'1'` | `'0'`
- `amux_theme_scanlines` — `'1'` | `'0'`
- `amux_theme_dense` — `'1'` | `'0'`

### Theme-Color für PWA

`<meta name="theme-color">` wird in `_applyTheme()` dynamisch pro Theme + Light-Flag gesetzt (`#0d1117`, `#ffffff`, `#0a0a0a`, `#f5f5f7`, `#050a05`, `#0a0703`, `#000000`).

### CSS-Variables-Cheatsheet (`github` Dark, baseline)

```css
--bg: #0d1117;       /* page background */
--card: #161b22;     /* surface */
--border: #30363d;
--text: #e6edf3;     /* primary text */
--dim: #8b949e;      /* secondary */
--accent: #58a6ff;   /* primary action */
--green: #3fb950;
--red: #f85149;
--yellow: #d29922;
--cyan: #39d2c0;
```

---

## 7. Mobile / Responsive

### Breakpoints (in CSS verwendet)

- `max-width: 600px` — Haupt-Mobile-Breakpoint (Phone Portrait)
- `max-width: 768px` — Audio-Bar / Compact-Layout
- `max-width: 480px` — Extra-narrow (kleine Phones)
- `max-width: 400px` — Board-Compact
- `max-width: 520px` — Modal-Compact
- `max-width: 640px` — Board-Specific
- `min-width: 900px` — Desktop-Wide
- `min-width: 769px` — `#tab-grid` (Workspace) nur Desktop

### Touch-Constraints (CLAUDE-Rule)

- Touch-Targets ≥ 44 × 44 px
- 375 px Width-Test (kleinstes Phone)
- `@media (hover: none)` für Touch-only Anpassungen
- `@media (prefers-reduced-motion)` + `(prefers-reduced-transparency)` Respect

### Safe-Areas (iOS-PWA-Notch)

- Viewport: `viewport-fit=cover`
- Bottom-Bars: `padding-bottom: max(6px, env(safe-area-inset-bottom));`
- Fixed-Overlays müssen physikalische Edges erreichen

---

## 8. PWA-Specs

### `manifest.json`

```json
{
  "name": "amux — Claude Code Multiplexer",
  "short_name": "amux",
  "id": "/",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#0d1117",
  "icons": [
    {"src":"/icon.svg",     "sizes":"any",     "type":"image/svg+xml"},
    {"src":"/icon-192.png", "sizes":"192x192", "type":"image/png"},
    {"src":"/icon-512.png", "sizes":"512x512", "type":"image/png"},
    {"src":"/icon.png",     "sizes":"180x180", "type":"image/png"}
  ]
}
```

`short_name`, `name`, `theme_color`, `background_color` können via `/api/branding`-Endpoint pro Installation überschrieben werden.

### Service-Worker (`/sw.js`)

- Cache-Name `amux-v<version>` — wird bei Server-Restart neu gebumpt
- App-Shell pre-cached: `/`, `/manifest.json`, alle Icons
- Strategie: **Cache-first für Shell**, Network-first für `/api/*`
- `CACHE_HTML`-Message vom Client → SW speichert aktuelles HTML als Fallback für Offline-Days
- `SKIP_WAITING`-Message → Sofort-Activate bei Update

### Mobile-Onboarding (3 Schritte)

1. `http://<host>:8823/api/cert` herunterladen → Profil installieren
2. iOS: Cert-Trust aktivieren
3. `https://<host>:8822/` → Token aus `~/.amux/auth_token` einfügen → „Zum Home-Bildschirm"

---

## 9. Auth-Flow (Frontend-Sicht)

```
1. Server bootet → liest/erzeugt ~/.amux/auth_token (0600)
2. User öffnet https://host:8822/
3. Server inlinet HTML mit `window._AMUX_AUTH_TOKEN = "<token>"`
   ↳ Token kommt nur aus zwei Quellen:
       a) Cookie `amux_token` (Browser hat sich „eingeloggt")
       b) Query-Param `?token=…` (Erst-Bind), wird in Cookie persistiert
4. apiCall() liest _AMUX_AUTH_TOKEN, hängt `Authorization: Bearer …` an
5. SSE EventSource: Token als Query-Param (`/api/events?token=…`), weil
   EventSource keine custom Headers zulässt
```

Public-Paths (§4.1) bypassen Auth-Check komplett.

Multi-User-Cloud-Variante: zusätzlich `X-Amux-User-Email`-Header vom Gateway injiziert → `/api/identity` returns User.

---

## 10. Wichtige UX-Patterns / Gotchas fürs Re-Design

| Pattern | Details |
|---|---|
| **Realtime-Backbone** | SSE + Polling-Fallback. Polling-Fallback muss **beide** Channels (Sessions + Board) abdecken — sonst Drift |
| **Stale-Detection** | Client deklariert SSE stale nach 18 s ohne Ping → erzwingt Reconnect |
| **Auto-Reload** | Server kann jederzeit `os.execv` machen — Client muss SSE-Reconnect tolerieren, `_onClientResume` aufrufen |
| **Cache-Buster** | Service-Worker mit Versions-String in `CACHE`-Name; alte Caches werden bei `activate` gelöscht |
| **Bulk-Ops** | Sessions-Liste hat `/api/sessions-git` für Bulk (statt 80× einzeln) — Frontend muss „bulk-first" denken |
| **Peek-Tabs** | Output / Files / Notes / Schedules / Tasks / Channel / Memory — kontextabhängig je nach Session-Capability |
| **Conditional-Tabs** | Files-Tab im Peek nur wenn `has_files`, Notes-Tab nur wenn `has_notes` etc. |
| **Issue-Auto-Complete** | Wenn Session-Status `active`→`idle` → laufendes Board-Issue wird auto-completed + nächstes queued task picked up |
| **Steer-Mode** | Session kann „gesteert" werden (Inline-Hint, der bei nächster Tool-Call eingefügt wird); UI muss Steer-State anzeigen |
| **Branch-Suggest** | `POST /api/suggest-branch` ruft LLM auf — UI muss Loading-State haben |
| **Token-Display** | Sessions zeigen `tokens.total` (input+output+cached); Aggregat über alle Sessions in Sidebar (`amux_tokens`) |
| **Provider** | Sessions sind `claude` ODER `codex`; UI muss Provider-Badge zeigen + Provider-spezifische Defaults (z. B. Model-Detection unterschiedlich) |
| **Workspace-Grid** | Multi-Pane (mehrere Sessions parallel) — nur Desktop (`min-width:769px`) |
| **Layout-Presets** | User kann Tab-Order + Hidden-Tabs persistieren — pro Org/User |
| **Custom-Branding** | Per-Installation Logo/Name/Color via `/api/branding` (Cloud-Multi-Tenant) |

---

## 11. Was beim Re-Design NICHT geändert werden darf

1. **Single-File-Architektur** — Frontend muss zurück nach `amux-server.py` inlined werden (HTML/CSS/JS als Python-Strings). Kein Vite-Build, kein React-Bundle. Vanilla JS + CSS.
2. **Single-Codebase-Rule** — kein `if IS_CLOUD`. Diff zwischen Local und Cloud kommt aus Gateway-Headers (`X-Amux-User-Email`) und Env-Vars, nicht aus Build-Flags.
3. **Auth-Token-Source** — Bearer aus `~/.amux/auth_token` bleibt; Frontend liest aus `window._AMUX_AUTH_TOKEN`.
4. **REST-Pfade + Schemas** — bestehende Apps/Skripte (CLI, `amux` Desktop-Wrapper, iOS-App) hängen daran. Wenn neue Pfade: alte als Alias erhalten.
5. **PWA-Manifest-Pfade** — `/manifest.json`, `/sw.js`, Icons unter `/icon*.png`/`.svg` — Service-Worker erwartet das.
6. **Theme-LocalStorage-Keys** — `amux_theme_*` Keys müssen bleiben, sonst verlieren Bestandsuser ihr Setup.
7. **SSE-Stream** — Pfad `/api/events`, Event-Names wie oben — von vielen Stellen erwartet.

---

## 12. Was sich lohnen würde zu modernisieren

- **Component-System** — aktuell viel Inline-`innerHTML +=`. Web-Components oder Lit (CDN-Single-Script) wären drop-in fähig ohne Build-Step.
- **Layout-Engine** — Tab-Order/Sidebar/Peek-Panel via CSS-Grid `grid-template-areas` statt manueller Flex-Container.
- **Mobile-First-Rewrite** — aktuell Desktop-First mit `@media (max-width:600px)` Patches. Lohnt sich umzudrehen.
- **Container Queries** — viele Cards/Panels brauchen Container-relative Breakpoints, nicht Viewport.
- **View-Transitions-API** — Tab-Wechsel + Modal-Open könnten animiert werden (Browser-native, kein Framework nötig).
- **Theme-Coupling** — Theme-CSS-Variables sind solide, aber Theme-spezifische CSS-Regeln (`body.theme-quiet .btn { … }`) sollten in `[data-theme="quiet"]` Selektoren konsolidiert werden für klarere Cascade.
- **Accessibility** — `aria-*`-Audit, Keyboard-Nav für Modals/Peek-Panel, Focus-Trap.
- **Density-Modes** — `dense`-Flag gibt's nur für `trade`-Theme; könnte global werden (Compact / Comfortable / Spacious).
- **Empty-States** — viele Tabs zeigen leeres Container ohne Hinweis was zu tun ist.
- **Command-Palette** — `cmd_history`-Tabelle existiert, aber Palette-UI ist rudimentär — Spotlight-Style-Overlay wäre ein Win.
