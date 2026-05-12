# File Structure + Build Order

## Files in this project
```
plans/
  00-overview.md … 10-file-structure.md

amux.html                     ← main deliverable (the prototype)
src/
  app.jsx                     ← root + router + store
  store.jsx                   ← in-memory state + mock SSE
  mock-data.jsx               ← realistic seed data
  theme.jsx                   ← theme application + tokens
  components.jsx              ← Button, Pill, Card, Modal, Sheet, etc.
  shell/
    sidebar.jsx
    appbar.jsx
    footer.jsx
    bottom-tabs.jsx           ← mobile
  tabs/
    sessions.jsx              ← hero
    board.jsx
    calendar.jsx
    scheduler.jsx
    files.jsx
    notes.jsx
    logs.jsx
    metrics.jsx
    secondary.jsx             ← lower-fi skeletons sharing one file
  peek/
    peek.jsx                  ← container + sub-tab router
    output.jsx
    tasks.jsx
    schedules.jsx
    files.jsx
    memory.jsx
  overlays/
    command-palette.jsx
    new-session-modal.jsx
    schedule-modal.jsx
  tweaks-panel.jsx            ← from starter
styles/
  tokens.css                  ← all CSS variables, per theme
  base.css                    ← reset, typography, layout primitives
  components.css              ← atomic component styles
```

## Build order
1. Plan files (this folder) ✅
2. Tokens + base CSS + theme switching — verify in a stub HTML.
3. Shell (sidebar / appbar / footer / bottom-tabs) with mock router.
4. Sessions tab (cards + filter bar + bulk + empty + skeleton).
5. Peek panel (Output + Tasks first, others skeleton).
6. Board tab.
7. Calendar / Scheduler / Files / Notes.
8. Logs / Metrics.
9. Secondary tabs (shared shell).
10. Command palette.
11. Mock SSE driver: emits session-updates, board-updates on a timer.
12. Tweaks panel.
13. Polish: empty states, error states, offline banner, install chip.

## Mock data principles
- Realistic session names (`foo-onboarding`, `infra-cost-report`, …).
- Mixed providers, branches, statuses.
- A few sessions actively cycling preview text every ~3s.
- Board with ~12 issues across all columns.
- Schedules with cron + free-text mix.
- Calendar with board dues + a few "email-extracted" events.
