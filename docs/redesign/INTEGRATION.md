# Redesign Integration — Gap Analysis & Next Steps

Source: Claude Design handoff bundle (`docs/redesign/`) — chats, plans, and prototype src
under `docs/redesign/project/`.

## Status (heute)

- ✅ **Bundle gestaged** — komplett unter `docs/redesign/`. README, Chats, Pläne, Src.
- ✅ **Preview-Route live** — `GET /redesign` auf dem amux-Server bündelt die
  CSS/JSX-Dateien inline und serviert sie mit React 18 + Babel-standalone aus dem
  CDN. Funktioniert direkt unter `https://192.168.1.32:8822/redesign` (mit
  Bearer-Token via Cookie). Daten kommen noch aus dem Mock-Store.
- ⏳ **Daten-Anbindung** — Mock-`store` muss durch echte API-Aufrufe ersetzt werden.
- ⏳ **Tab-Vollausbau** — Plan & Prototyp covern Sessions+Peek als Hero, Board+Calendar
  als Sketches. Scheduler/Files/Notes/Logs/Metrics/Terminal/Browser/CRM/Map/Habits sind
  „Coming next"-Skeletons im Prototyp.

## Was die Preview kann

Aufruf: `https://192.168.1.32:8822/redesign`

Vollständig funktional (mit Mock-Daten):
- Sessions-Grid (grid/list/compact) mit Status-Dot, Live-Preview, Task-Strip,
  Tokens, Last-Activity, Hover-Quick-Actions
- Peek-Panel rechts (Output/Tasks/Schedules/Files/Memory) + Fullscreen-Toggle
  + QuickKeys-Composer + Queue-Strip
- Workspace-Tabs (Browser-Stil) + Top-Tabs (alternative zur Sidebar)
- Command-Palette (⌘K) mit Group-Render
- New-Session-Modal (⌘N)
- Simulated SSE (Preview-Lines ticker)
- 6 Themes × Light/Dark, 4 Accents, 3 Densities, 3 QuickKey-Styles
  — alle via Tweaks-Panel (unten rechts) togglebar

## Was zur vollen Integration noch fehlt

### 1. Daten-Backend (Pflicht)
Im aktuellen Prototyp ist `store.sessions` ein hartcodiertes Array. Für echte
Daten:

| Mock-Bezug | Ersetzen durch |
|---|---|
| `MOCK_SESSIONS` in `store.jsx` | `fetch('/api/sessions', { headers: { Authorization: 'Bearer '+window._AMUX_AUTH_TOKEN } })` |
| `startMockSSE()` | `new EventSource('/api/events?token='+window._AMUX_AUTH_TOKEN)` + Polling-Fallback (siehe `.claude/rules/sse-realtime.md`) |
| Session-Actions (`patchSession`) | `POST /api/sessions/<name>/<action>` (siehe FRONTEND-SPEC.md §4) |
| Toast `pushToast` | bleibt rein UI |
| `totalTokens()` | aus echten Sessions berechnen |

Auth: Cookie wird vom Server bei `/` schon gesetzt; für SSE muss `?token=` an
URL gehängt werden, weil EventSource keine Custom-Header kann.

### 2. Fehlende Tabs (Design-Arbeit)
Der Prototyp deckt nur Sessions+Peek+Board+Calendar ab. Für die übrigen Tabs
müssen Mock-UIs nachgezogen werden (oder die alten Views beim Wechsel
„durchgereicht" werden):

- **Scheduler** — Cron-Liste + Modal, existiert in main schon (siehe Plan
  `feat/multi-theme-picker`). Design-Arbeit: Card-Stil an Sessions angleichen.
- **Files** — bestehender FileTree muss in der Themes-Tokens-Sprache neu
  gestyled werden.
- **Notes** — analog.
- **Logs** — Tail-Stream mit Filter-Bar (Theme-Pills).
- **Metrics** — Cards mit psutil-Daten.
- **Terminal / Browser / CRM / Map / Habits / Torrents** — Long-Tail.
- **Hidden Sub-Views** — Journal, Channels, Graph, Reports, Recordings,
  Skills, Org, Settings, Gmail/Email.

### 3. Tweaks-Panel
Der Tweaks-Panel ist ein Design-Tool-Overlay (rechts unten). Für die
Produktiv-UI sollte er versteckt sein und seine Settings (Theme, Density,
Accent, Sidebar-Side, Card-Layout, ShowTokens, Animations, Nav-Mode,
QuickKeys-Style) in das amux-Settings-Menü wandern. LocalStorage-Keys aus
FRONTEND-SPEC.md §6 wiederverwenden (`amux_theme_name`, `amux_theme_light`,
`amux_theme_scanlines`, `amux_theme_dense`).

### 4. PWA-Manifest
Das aktuelle PWA-Manifest (siehe `amux-server.py` ~30855) bleibt unverändert.
Die Redesign-Tokens müssen die theme-color-Werte aus dem Manifest spiegeln.

### 5. Routing
Der Prototyp nutzt In-State-Routing (kein URL-Hash). Für die echte Integration
sollte Hash-Routing nachgerüstet werden (siehe Plan `02-information-architecture.md`
§Routing): `#sessions`, `#sessions/foo`, `#board`, `#schedule/<id>/edit`. Survives
Reload, klappt mit Service Worker.

### 6. Mobile-Polish
Plan `08-mobile-pwa.md` listet:
- Bottom-Tab-Bar mit 5 primären Tabs + Overflow-Sheet
- Peek = Full-Screen-Takeover (drag-to-dismiss)
- env(safe-area-inset-*) für iPhone-Notch
- Touch-Targets ≥44×44 (siehe `.claude/rules/css-mobile.md`)

Im Prototyp größtenteils da, aber muss gegen echte Daten verifiziert werden.

### 7. Single-File-Constraint
`amux-server.py` ist Single-File. Der bisherige Redesign-Bundler lädt die
JSX/CSS aus `docs/redesign/project/` zur Request-Zeit nach. Das ist ein
Kompromiss: Für eine echte Produktiv-Integration muss alles als Python-Strings
inlined werden (analog zu DASHBOARD_HTML). Das macht den File ~5k Zeilen
größer, aber ist mit der Single-File-Regel konsistent.

## Empfohlener Schrittpfad

1. **Preview testen** auf Desktop + iPhone, alle Themes durchprobieren, Tweaks
   spielen. Entscheiden: gefällt die Richtung?
2. **Daten-Anbindung** des Sessions-Tabs (Mock-Store → echte API + SSE).
3. **Schrittweise Tab-Migration**: Board → Scheduler → Files → Notes → Logs →
   Metrics → Rest. Pro Tab ein Commit.
4. **Tweaks-Panel** in das amux-Settings-Menü wandern.
5. **Routing** auf Hash umstellen.
6. **Cut-over**: Wenn alle Tabs migriert sind, `/redesign` zu `/` machen und
   die alte UI als `/legacy` parken (oder löschen).

## Aufwand-Schätzung

- Sessions-Tab Daten-Anbindung: **~1 Tag**
- Board + Calendar + Scheduler Style-Übernahme: **~2 Tage**
- Files + Notes + Logs + Metrics: **~3 Tage**
- Mobile-Polish + Routing + Tweaks-Migration: **~1 Tag**
- Long-Tail Tabs (Terminal/Browser/CRM/Map/Habits/Hidden): **~3 Tage**

Gesamt: **~10 Arbeitstage** für Voll-Migration. Schrittweise möglich.
