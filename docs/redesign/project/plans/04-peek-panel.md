# Peek Panel — Session Detail

Right-side slide-in (420px) on desktop. Full-screen sheet on mobile.

## Header
- Session name (editable inline).
- Status dot + label.
- Close `Esc`.
- Overflow menu (same actions as card `⋯`).

## Sub-tabs
Order: **Output · Files · Notes · Tasks · Schedules · Channel · Memory**.

Conditional visibility:
- Files only if `has_files`.
- Notes only if `has_notes`.
- Channel only if multi-user / org member.

## Output tab (default)
- Live tail of `tmux capture-pane` — auto-scrolling, monospace.
- Composer at bottom: textarea + send. Keyboard `⌘↵`.
- Steer toggle inline: when on, next message becomes a steer-hint instead.
- "Jump to bottom" pill when scrolled up.

## Tasks tab
- Local todo list from `tasks` table.
- Inline-edit add. Drag-reorder. Checkbox completes.
- Auto-completed task highlighted (when issue auto-completes on idle).

## Schedules tab
- Per-session schedules. Inline create with live "next run" preview.
- Pause/resume toggle. Run-now button.

## Files tab
- Tree of `cwd`. Click → opens file viewer (split inside peek or fullscreen).

## Memory tab
- Memory blob editor. Save with `⌘S`. Diff preview if changed.

## Channel tab
- DM stream with org members tagged on this session.
