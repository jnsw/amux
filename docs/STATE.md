# amux — Current State

Snapshot of the repo as it stands today. Written for someone (or some agent)
joining the project who needs to understand what's in the box, where things
live, and what is in flight.

---

## 1. What amux is

**Self-hosted control plane for AI coding agents.** A single Python process
runs:

- A tmux-backed session manager (parallel Claude Code / Codex agents)
- A REST + SSE API
- A browser dashboard (HTML/CSS/JS shipped inline from the same Python file)
- A PWA manifest + service worker
- A Kanban board, scheduler, notes, CRM, channels, file explorer, browser
  automation, skills/slash-commands, metrics

Deployment targets: local (macOS / Linux laptop), and a cloud VM
(GCP, behind a gateway). Same source file for both.

OSS license: MIT + Commons Clause. Upstream at `mixpeek/amux`.

---

## 2. Repository layout

```
amux/
├── amux-server.py      ← THE single source file (~37 500 lines)
├── README.md           ← marketing / quickstart
├── CLAUDE.md           ← workflow rules for AI assistants
├── mcp.json            ← centralized MCP server config (local + cloud)
├── install.sh / amux   ← CLI wrappers
│
├── .claude/
│   └── rules/          ← editing rules enforced by hooks
│       ├── single-file.md
│       ├── css-mobile.md
│       └── sse-realtime.md
│
├── cloud/              ← GCP deployment (Terraform + docker)
│   ├── main.tf, variables.tf, outputs.tf
│   ├── deploy.sh
│   ├── docker/         ← runtime image (Dockerfile, gateway, litestream)
│   ├── gateway/        ← OAuth gateway in front of amux
│   └── litestream/     ← SQLite replication config
│
├── docs/
│   ├── FRONTEND-SPEC.md     ← spec sent to Claude Design (frontend rebuild)
│   ├── STATE.md             ← THIS file
│   ├── release-notes/       ← per-release MD notes (served at /release-notes)
│   └── redesign/            ← Claude Design handoff bundle (see §11)
│       ├── README.md
│       ├── INTEGRATION.md   ← gap analysis from the handoff
│       ├── chats/           ← design-chat transcripts
│       └── project/
│           ├── amux.html    ← entry point of the prototype
│           └── src/         ← 4 CSS + 11 JSX files
│
└── site/  (referenced from README; not in repo root)
```

There are no other source files. Everything in the running server — Python,
HTML, CSS, JS, SQL schema, shell snippets, manifest, service worker — lives
inside `amux-server.py`.

---

## 3. Single-file architecture

Enforced by `.claude/rules/single-file.md` and a PostToolUse hook.

After every edit:

```bash
python3 -c "import ast; ast.parse(open('amux-server.py').read())"
```

Notable inline blobs inside `amux-server.py`:

| Constant            | Approx. line | Contents                                |
|---------------------|--------------|-----------------------------------------|
| `_SHARE_CSS`        | 7019         | CSS for the public share page           |
| `DASHBOARD_HTML`    | 7312         | Full dashboard HTML + `<style>` + inline JS |
| `PWA_MANIFEST`      | 30932        | `manifest.webmanifest` JSON             |

The CSS block ends at line ~11400 (`</style>`). JS starts inline shortly
after and runs to ~30000. Python request routing, business logic, and the
tmux/SQLite integration follow.

### Single-codebase rule (cloud + local)

`amux-server.py` is identical for both local OSS deploy and the cloud
deploy — no `if IS_CLOUD` branches. Differences are driven by:

- Headers injected by the cloud gateway (e.g. `X-Amux-User-Email`)
- Presence/absence of config files (`~/.amux/server.env`)

`cloud/docker/amux-server.py` is auto-generated during deploy and is
gitignored.

---

## 4. Runtime model

### 4.1 Process lifecycle

- Server watches its own mtime. On change it calls
  `os.execv(sys.executable, [sys.executable] + sys.argv)` — same PID
  semantics for the parent, fresh interpreter state.
- The listening socket is closed first; the new process re-binds on port
  8822.
- tmux sessions are detached daemons. They survive `os.execv` cleanly.
  `_attach_log_streaming()` re-attaches `pipe-pane` after restart so live
  output keeps flowing.
- Auto-restart is part of the "self-healing" story (along with auto-compact
  on context overrun, hibernation of idle auto-continue sessions, and
  process-level OOM detection).

### 4.2 TLS

Self-signed cert at `~/.amux/tls/cert.pem`, generated on first start. SAN
list covers `localhost`, `127.0.0.1`, the LAN IP, and the Tailscale
MagicDNS hostname if Tailscale is installed. Valid 1 year.

Separate **HTTP cert-server** on port 8823 (`/api/cert`) lets mobile
clients download the CA cert without first trusting it.

### 4.3 Authentication

- `~/.amux/auth_token` — auto-generated once, mode 600.
- Browser sets a cookie after the first valid token submission at `/`.
- All API requests require either the cookie or
  `Authorization: Bearer <token>`.
- SSE requests use a `?token=` query param because `EventSource` cannot
  set custom headers.

In cloud mode the gateway terminates OAuth and injects
`X-Amux-User-Email` instead.

### 4.4 SSE backbone

Defined in `.claude/rules/sse-realtime.md`. Hard contract:

- Server sends `{type:"ping"}` every **10 s**.
- Client declares the stream stale after **18 s** of silence and force-
  reconnects.
- `visibilitychange` / `pageshow` / `focus` / `online` all call
  `_onClientResume`, which re-fetches if cached data is older than 4 s.
- Polling fallback must always cover **both** sessions and board.

This is the spine of every live update in the dashboard: session status
dots, terminal output, board moves, schedule fires, channel messages.

---

## 5. Storage layout (`~/.amux/`)

```
~/.amux/
├── auth_token          mode 600
├── server.env          persistent env vars (loaded via os.environ.setdefault)
├── tls/
│   ├── cert.pem
│   └── key.pem
├── data.db             SQLite (board, schedules, prefs, channels, CRM, …)
├── sessions/           per-session metadata + tmux artifacts
├── transcripts/        rolling JSONL of conversation history
├── notes/              markdown notes (also tracked in SQLite)
├── uploads/            user-uploaded files (attachments)
└── logs/               server stdout/stderr if not via launchd
```

The DB is replicated to S3 in cloud deployments via Litestream
(`cloud/litestream/`). Local deploys are single-disk.

---

## 6. Dashboard

Served at `GET /` after token submission. Single-page; React-free
(hand-rolled vanilla JS). Mobile-first PWA — `viewport-fit=cover`,
`env(safe-area-inset-*)`, touch targets ≥44 px (see
`.claude/rules/css-mobile.md`).

### 6.1 Tab bar (top of dashboard)

Default tabs, in order:

`Sessions · Board · Calendar · Scheduler · Files · Logs · Workspace
· Notes · People · Map · Metrics · Torrents · Terminal · Browser · Habits`

Tab visibility is customizable via the `⊞` button at the end of the bar.

A separate row of **chrome-style browser tabs** lives above the tab bar.
Each chrome tab is an independent UI instance (independent view state,
own active tab, own filters). Middle-click closes, double-click renames,
collapsible into a compact strip on mobile.

### 6.2 Settings → Appearance

The "Appearance" section of the settings drawer is the user-visible
control surface for theming. Current rows (in source order):

| Row           | Control                            | Persists to              |
|---------------|------------------------------------|--------------------------|
| Theme         | select × 6                         | `amux_theme_name`        |
| Light mode    | toggle (only `github`/`quiet`/`glass`) | `amux_theme_light`   |
| Scanlines     | toggle (only phosphor themes)      | `amux_theme_scanlines`   |
| Dense mode    | toggle (only `trade` theme)        | `amux_theme_dense`       |
| **Accent**    | select × 5 (default + 4 colors)    | `amux_accent`            |
| **Density**   | select × 3 (spacious/cozy/dense)   | `amux_density`           |
| **Animations**| toggle (default on)                | `amux_animations`        |
| Zoom          | −/+/reset                          | `amux_zoom`              |

Bold rows were added on **2026-05-11** to port over the most useful tweaks
from the Claude Design redesign prototype (see §11).

### 6.3 Themes (full list)

Six themes, all dark-by-default. `light` flag is honored only by themes
that have a light variant.

| Name             | Class            | Light variant | Special toggles    |
|------------------|------------------|---------------|--------------------|
| `github`         | (none — default) | ✓             | —                  |
| `quiet`          | `theme-quiet`    | ✓             | —                  |
| `glass`          | `theme-glass`    | ✓             | —                  |
| `phosphor`       | `theme-phosphor` | —             | scanlines          |
| `phosphor-amber` | `theme-phosphor-amber` | —       | scanlines          |
| `trade`          | `theme-trade`    | —             | dense              |

Theme + light flag combine into a `theme-color` meta value used by
iOS/Android PWA chrome.

### 6.4 Accent override (new)

Themes ship with a default `--accent` CSS variable. The user-selectable
accent overrides it through `body[data-accent="…"]` selectors placed at
the end of the stylesheet (source-order wins; equal specificity to theme
selectors).

| Token             | Hex      |
|-------------------|----------|
| `indigo`          | `#7c9eff`|
| `emerald`         | `#3fb950`|
| `amber`           | `#ffb84d`|
| `rose`            | `#ff6f8d`|
| `default`         | (theme's own `--accent`) |

### 6.5 Density (new)

Three modes. Implementation is intentionally narrow — affects card padding,
tab-bar padding, and settings-row padding. Does **not** touch font size
or layout grid (those would risk text overflow at 375 px width).

```
body[data-density="spacious"] .card { padding: 14px; }
body[data-density="dense"]    .card { padding: 7px 9px; }
…
```

### 6.6 Animations (new)

Off mode kills all transitions and animations globally:

```css
body[data-anim="off"], body[data-anim="off"] * {
  transition: none !important;
  animation-duration: 0s !important;
  animation-iteration-count: 1 !important;
}
```

Useful on lower-spec devices and for anyone who finds the default motion
distracting.

---

## 7. REST + SSE API (high level)

Routes are dispatched in a big if/elif tree (see `_handle_api` and the
match blocks around lines 800–840 and 33000+).

| Group         | Selected endpoints                                              |
|---------------|-----------------------------------------------------------------|
| Sessions      | `GET /api/sessions`, `POST /api/sessions/<name>/{start,stop,send,peek,share}` |
| Events        | `GET /api/events` — SSE backbone                                |
| Board         | `GET/POST /api/board`, `POST /api/board/<id>/claim`, `POST /api/board/clear-done`, `POST /api/board/statuses` |
| Schedules     | `GET/POST/PATCH/DELETE /api/schedules`, `POST /api/schedules/preview` (new with `feat(scheduler)`) |
| Notes         | `GET/POST/PATCH/DELETE /api/notes`                              |
| Channels      | `GET /api/channels`, `POST /api/channels/<id>/messages`         |
| CRM           | `GET/POST/PATCH /api/crm/contacts`, `…/interactions`, `…/followups` |
| Files         | `GET /api/files?path=…`                                         |
| Calendar      | `GET /api/calendar.ics` (board iCal export)                     |
| Prefs         | `GET/POST /api/prefs?key=…`                                     |
| Cert          | `GET /api/cert` (HTTP, port 8823 — mobile cert download)        |
| Redesign      | `GET /redesign` — bundles `docs/redesign/project/` into one HTML response (see §11) |

Authentication is uniform: cookie or Bearer. SSE accepts `?token=`.

---

## 8. Self-host (BillyBang via launchd)

The reference deployment for this repo is on `BillyBang` (the user's M1
MacBook Air).

- Source clone: `~/projects/amux/` (branch `main`)
- Plist: `~/Library/LaunchAgents/com.seewald.amux-server.plist`
- Wrapper: `~/.local/bin/amux-server-start`
  Pinned to Homebrew Python 3.14, because macOS-bundled 3.9 cannot parse
  PEP-604 (`X | Y`) syntax.
- CLI wrapper: `~/.local/bin/amux`
- Data: `~/.amux/` (see §5)
- Logs: `~/Library/Logs/amux-server.{out,err}.log`
- Endpoint: `https://192.168.1.32:8822` (LAN) + `:8823` (cert download)

### Update recipe

```bash
cd ~/projects/amux && git pull && \
launchctl kickstart -k gui/$(id -u)/com.seewald.amux-server
```

The mtime watchdog usually makes the explicit kickstart unnecessary —
saving the file in place restarts the server within a second.

### Mobile onboarding

1. iPhone on the LAN (or via WireGuard).
2. Visit `http://192.168.1.32:8823/api/cert` in mobile Safari.
3. Install the cert as a profile, trust it under Settings → General →
   About → Certificate Trust Settings.
4. Visit `https://192.168.1.32:8822/`.
5. Paste the token from `~/.amux/auth_token`.
6. "Add to Home Screen" — the PWA opens fullscreen with offline support.

---

## 9. Cloud deployment

`cloud/` provisions a single GCP VM with Terraform.

- `main.tf`, `variables.tf`, `outputs.tf` — Terraform IaC.
- `setup.sh`, `setup-cloud.sh` — first-boot scripts.
- `deploy.sh` — pushes the current `amux-server.py` into the VM image.
- `docker/` — Dockerfile + entrypoint.
- `gateway/` — OAuth gateway in front of the server; injects
  `X-Amux-User-Email` once a user is authenticated.
- `litestream/` — SQLite-to-S3 replication so the VM is recoverable.

The same `amux-server.py` runs inside the container.

---

## 10. Mobile / PWA

- `PWA_MANIFEST` (line ~30932) defines name, icons, theme color,
  display, start URL.
- Service worker registered at startup; offline-capable for the dashboard
  shell.
- Native iOS app (separate codebase) exists in the App Store, talks to
  the same REST/SSE API.
- Mobile CSS rules: `@media (max-width: 600px)` breakpoints throughout,
  `env(safe-area-inset-*)` for notch padding, bottom-tab-friendly hit
  targets.

---

## 11. Redesign integration

### 11.1 The handoff

`docs/redesign/` is the unpacked Claude Design handoff bundle for a
frontend rebuild of amux. The bundle contains:

- `README.md` — handoff instructions.
- `chats/` — design-chat transcripts showing the iteration that led to
  the prototype (browser tabs, peek panel, quickkeys composer, theme
  picker, etc.).
- `project/amux.html` — entry point. Loads React 18 + Babel-standalone
  from unpkg, then 4 CSS and 11 JSX source files.
- `project/src/tokens.css` — canonical theme tokens (Quiet dark) + the
  5 alternate themes + accents + density.
- `project/src/components.css` — atomic UI: btn, pill, dot, card, kbd,
  chip, input, modal, skeleton, empty.
- `project/src/app.css` — app shell, sessions grid, session card, peek
  panel, workspace tabs, view tabs, composer, quick keys, command
  palette, toasts, new-session modal, connection banner.
- `project/src/*.jsx` — React components: SessionsTab, PeekPanel,
  CommandPalette, NewSessionModal, BoardTab, CalendarTab, WorkspaceTabs,
  Tweaks panel, mock store, etc.

The bundle is verbatim — not edited in this repo.

### 11.2 Live preview route

A `GET /redesign` handler in `amux-server.py` reads the CSS+JSX files
from `docs/redesign/project/` at request time and serves them inline as
one HTML document. React 18 UMD + Babel-standalone 7.29 are pulled from
unpkg; Babel compiles JSX in the browser.

URL: **`https://192.168.1.32:8822/redesign`**

Mock data only (see `store.jsx`). All UI features of the prototype work:
6 themes × light/dark, 4 accents, 3 densities, command palette (⌘K),
new-session modal (⌘N), workspace tabs (⌘T / ⌘1-9), peek panel with
5 sub-tabs and fullscreen toggle.

### 11.3 What has been ported into the real dashboard

| Feature                       | Status |
|-------------------------------|--------|
| 6 themes + light variants     | ✓ Already shipped (pre-redesign) |
| Theme-color meta sync         | ✓ Already shipped |
| Scanlines / dense modes       | ✓ Already shipped |
| **Accent override**           | ✓ **Ported 2026-05-11** |
| **Density (spacious/cozy/dense)** | ✓ **Ported 2026-05-11** (global, was theme-specific) |
| **Animations toggle**         | ✓ **Ported 2026-05-11** |
| Card layout: list/grid/group  | ✓ Already shipped (compact missing) |
| Card layout: compact          | ✗ Refactor of card render needed |
| Sidebar side: left/right      | ✗ Sidebar is structurally different in real amux |
| Quick-keys composer + style   | ✗ Doesn't exist in real amux (prototype-only) |
| Workspace browser tabs        | ✓ Already shipped (`feat: chrome-style browser tabs`) |
| Command palette ⌘K            | Partial (some surfaces have it) |
| New-session modal ⌘N          | ✓ Already shipped |
| Hash routing                  | ✗ Still in-state — see gap |
| Tweaks overlay (design tool)  | Intentionally not ported — Settings drawer is the real home |

### 11.4 Open gaps to the prototype

From `docs/redesign/INTEGRATION.md`:

1. **Data wiring** — the redesign prototype runs on a mock store. For a
   real cut-over, replace `MOCK_SESSIONS` with `fetch('/api/sessions')`
   and `startMockSSE()` with `new EventSource('/api/events?token=…')`
   plus the existing polling fallback.
2. **Missing tabs in the prototype** — Scheduler, Files, Notes, Logs,
   Metrics and the long-tail tabs (Terminal, Browser, CRM, Map, Habits,
   Torrents, plus hidden views: Journal, Channels, Graph, Reports,
   Recordings, Skills, Org, Settings, Email) are only stubs. Each needs
   either a redesigned UI or a "pass-through" of the existing view.
3. **Hash routing** — survive reload and integrate with SW caching:
   `#sessions`, `#sessions/<name>`, `#board`, `#schedule/<id>/edit`.
4. **Mobile polish** — bottom-tab-bar with 5 primary tabs + overflow
   sheet; peek as full-screen drag-to-dismiss.
5. **Single-file constraint for cut-over** — when ready, the redesign's
   CSS+JSX needs to be inlined into `amux-server.py` as Python strings
   (analog to `DASHBOARD_HTML`) instead of being read from disk at
   request time.

Effort estimate from INTEGRATION.md: **~10 working days** for a full
migration, doable tab-by-tab.

---

## 12. Recent feature timeline

(Last ~30 commits on `main`, freshest first.)

```
01bf396 feat(scheduler): cron-first modal with live preview + peek modal migration
37611f2 feat(ui):       multi-theme picker (4 alternative themes added)
17f7228 add:            Claude vs Cursor vs Windsurf comparison page
a37c2fb feat:           split send button with queue-mode toggle
ef82ebd fix:            iOS right-side gap + keyboard covering peek input
d2d9b0a fix:            restart session when working directory changes
8899602 fix:            iOS margin issue — safe-area-inset lost when chrome tabs collapse
f7d5fb9 add:            "Best AI Agent SDKs in 2026" page
26c9fac fix:            auto-restart sessions killed by OOM/signal
827392c fix:            hibernate idle auto-continue sessions to prevent OOM kills
53f7624 content:        "Best AI Coding Tools 2026" comparison (21 tools)
562186d fix:            codex resume flag ordering + remove dead --full-auto flag
781f46e fix:            prevent /compact flood from reactive image-error handlers
9b3190b fix:            auto-restart always fires for CC_AUTO_CONTINUE sessions
86f2f8c feat:           chrome tabs now open entirely independent amux UI instances
f3ffdf2 feat:           collapsible chrome tabs bar with persistent state
5e952e2 feat:           chrome tabs — view picker on +, double-click rename, middle-click close
af7c0d2 feat:           Chrome-style browser tabs for multi-view navigation
```

Uncommitted at time of writing (2026-05-11):

- Added `/redesign` route + ported the design bundle into
  `docs/redesign/`.
- Added Accent / Density / Animations rows in Settings → Appearance.
- Added the FRONTEND-SPEC.md that was sent to Claude Design originally.
- Added this `docs/STATE.md`.

---

## 13. Known constraints / gotchas

1. **Bus factor 1, no stable tag.** Before every `git pull` of upstream,
   skim CHANGELOG/commits.
2. **macOS bundled Python 3.9** cannot parse parts of `amux-server.py`
   (PEP-604 union types). Use Homebrew Python 3.14 — the launchd wrapper
   pins it.
3. **No Docker locally.** BillyBang runs amux natively via launchd. The
   cloud image uses Docker.
4. **No splitting the single file.** Every contributor PR or AI edit must
   keep `amux-server.py` as the single source of truth. PostToolUse hook
   AST-parses on save.
5. **Watchdog auto-restart can interrupt SSE for ~1 s.** The client
   reconnects automatically; tmux sessions are unaffected.
6. **Sudo commands** are not auto-executed from the AI assistant — they
   are surfaced to the user for manual run (no TTY available).

---

## 14. Pointers for further reading

- `README.md` — public-facing intro and CLI quickstart.
- `CLAUDE.md` — workflow rules for AI assistants editing this repo.
- `.claude/rules/single-file.md`, `css-mobile.md`, `sse-realtime.md` —
  hard rules enforced by hooks.
- `docs/FRONTEND-SPEC.md` — the spec that was sent to Claude Design.
- `docs/redesign/INTEGRATION.md` — gap analysis for the redesign cut-over.
- `cloud/setup-cloud.sh` — the canonical sequence for bringing up a VM.
- `mcp.json` — list of MCP servers exposed to the agents.
