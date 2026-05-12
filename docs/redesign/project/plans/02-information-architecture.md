# Information Architecture

## Top-level layout (desktop ≥ 900px)
```
┌─ sidebar (collapsible) ─┬─ main ────────────────────────┬─ peek (optional) ─┐
│ logo                    │ tab header + filters          │ session detail    │
│ tab list (icons+label)  │ content                       │ tabs              │
│ ─                       │                               │                   │
│ status footer           │                               │                   │
│ (tokens, sync, user)    │                               │                   │
└─────────────────────────┴───────────────────────────────┴───────────────────┘
```

- Sidebar: 220px expanded / 56px collapsed. Persist state.
- Peek: 420px, slides over content; on `≥1400px` it pushes content instead.

## Mobile (< 768px)
- Bottom tab bar with 5 primary tabs + "More" overflow sheet.
- Peek = full-screen takeover (drag-to-dismiss).
- Top app bar with current tab + search/command + avatar.

## Tab list (priority order)
1. **Sessions** (default)
2. **Board**
3. **Calendar**
4. **Scheduler**
5. **Files**
6. **Notes**
7. **Logs**
8. **Metrics**
9. **Terminal** / **Browser** / **Torrents** / **CRM** / **Map** / **Habits** (overflow)
10. Hidden sub-views: Journal, Channels, Graph, Reports, Recordings, Skills, Org, Settings, Gmail

User-customizable order persisted via `/api/layout-presets` (already in spec).

## Global affordances
- **Command palette** (⌘K / Ctrl+K): goto tab, create session, jump issue, run schedule, open file, switch theme. Backed by `cmd_history`.
- **Quick session create** (⌘N): modal with cwd autocomplete + branch picker + provider toggle.
- **Universal status bar** (bottom): connection state (SSE), aggregate token count, current user, sync time.
- **Toast region** (top-right desktop / top mobile): mutations confirm here; SSE-driven updates can toast on success.

## Modal hierarchy
- One modal at a time. Stack guarded.
- Confirm dialogs use a small centered dialog, not bottom sheet.
- Bottom-sheet for mobile equivalents.

## Routing
Hash-based: `#sessions`, `#sessions/foo`, `#board`, `#schedule/<id>/edit`. Survives reload; works with SW offline shell.
