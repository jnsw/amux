# Sessions Tab (Hero View)

## Above the fold
- **Filter bar**: search · status (chips: active/waiting/idle/stopped) · provider (claude/codex) · branch · tag · "mine" · sort.
- **Bulk actions** appear when ≥1 selected.
- **+ New session** button (right-aligned). Keyboard `⌘N`.

## Card anatomy (the spec's most important piece)
```
┌─────────────────────────────────────────────────────────────┐
│ ● active   foo-feature           claude · sonnet · main     │ ← header
│            ↳ ~/projects/foo · feat/onboarding               │ ← path + branch
│ ─                                                            │
│ "Looking at the test suite now — I'll run pytest and"        │ ← live preview (mono, 3 lines)
│ "patch the failing assertions in test_auth.py before…"       │
│ ─                                                            │
│ ⚡ Issue #142 · Add OAuth login          ↗ 8m active          │ ← current task strip
│ ─                                                            │
│ 124k tokens   2m ago     [Steer] [Send] [⋯]                  │ ← footer
└─────────────────────────────────────────────────────────────┘
```

Card states:
- **Active** — accent left-rule, live preview cycles every few s via SSE.
- **Waiting** — yellow dot, preview shows last assistant turn.
- **Idle** — neutral, preview dim.
- **Stopped** — collapsed; preview hidden; "Wake" button instead.

## Quick actions menu (`⋯` per card)
Stop · Steer · Send · Duplicate · Open in Peek · Open in Terminal · Memory · Share · Archive · Delete.

## Realtime details
- SSE `session-update` patches the matching card in-place.
- Token counts animate up.
- Preview lines fade-in (motion-reduced respects).
- Status dot pulse when state transitions.

## Empty state
> "No sessions yet. amux multiplexes Claude Code — create your first session to start."
> [+ New session]   [Connect existing tmux]

## Grid vs list
- Default: 1-col on mobile, 2-col on tablet, 3-col on desktop, 4-col on ultra-wide.
- Tweak: list-mode (single column, denser, no preview).
