# amux Frontend Redesign — Plan Overview

A clean, robust, top-notch PWA frontend for amux (Claude-Code multiplexer).
The frontend must be inlined back into `amux-server.py` — vanilla JS + CSS, no build step.

## Constraints (locked, from spec §11)
- Single-file: HTML/CSS/JS as Python strings, no Vite/bundler.
- Single-codebase: no `if IS_CLOUD` branching.
- Auth: `window._AMUX_AUTH_TOKEN` → `Authorization: Bearer …`. SSE uses `?token=`.
- REST paths, event names, theme localStorage keys, PWA paths all preserved.
- Realtime backbone: SSE `/api/events` with polling fallback + stale detection.

## Goals (this design pass)
1. A **system** for the whole app — type, color, spacing, components — so the 15+ tabs feel one.
2. **Sessions tab** as the hero — get the session-card right, get Peek-Panel right.
3. A **mobile-first** layout that doesn't compromise on desktop.
4. **Tweaks** for theme + density so the user can try variants live.
5. **Robustness**: explicit states for loading, empty, error, stale, offline, reconnecting.

## Non-goals (this pass)
- Wiring to a real backend. Mock data + simulated SSE only.
- Building every tab at hi-fi. Pick the spine (Sessions + Board + Peek + Calendar + Scheduler + Files + Notes); the rest get skeletons.
- Pixel-perfecting all 6 themes. Ship one canonical look + 1–2 variants as tweaks.

## Plan files
- `00-overview.md` — this file
- `01-design-system.md` — type, color, spacing, surfaces, motion
- `02-information-architecture.md` — tabs, navigation, peek panel, modal hierarchy
- `03-sessions-tab.md` — the hero view
- `04-peek-panel.md` — session detail
- `05-board-tab.md` — kanban
- `06-secondary-tabs.md` — Calendar, Scheduler, Files, Notes
- `07-realtime-states.md` — SSE, loading, empty, error, offline, stale
- `08-mobile-pwa.md` — breakpoints, safe areas, gestures, install
- `09-tweaks-and-themes.md` — what the Tweaks panel exposes
- `10-file-structure.md` — project layout, what to build first
