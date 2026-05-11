# Board Tab — Kanban

## Layout
- Columns: Backlog · To Do · In Progress · In Review · Done · Discarded (from DB statuses; sortable).
- Horizontal scroll on mobile; full-grid on desktop.
- Per-column count + "+ Add issue" inline.

## Card
- Title + small tag pills.
- Owner-type badge (human / agent).
- Linked session pill (clickable → opens peek).
- Due-date chip (red if overdue, amber if today, neutral else).
- Drag handles for reorder/move (HTML5 DnD + touch fallback).

## Detail (modal or peek-style)
- Edit title/desc/tags/due/session inline.
- Activity log (created/updated, who).
- "Send to session" — assigns + posts to its composer.

## Filters
- Tag chips · owner-type · session · due-window (today/week/overdue).
- Saved views via prefs.

## Auto-complete behavior
- When the linked session transitions active → idle, this issue auto-moves to Done.
- Toast: "Auto-completed #142 — next queued task picked up by foo-feature."
