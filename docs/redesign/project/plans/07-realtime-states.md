# Realtime + State Handling

The whole point of amux is liveness. This must feel rock-solid.

## SSE
- `EventSource('/api/events?token=…')`.
- On message:
  - `session-update` → patch session in store.
  - `board-update` → patch issue.
  - `schedule-update`, `note-update`, `file-update`, `memory-update`, `log-append` → respective stores.
  - `ping` → bump `lastPing`.
  - `reconnect` → close + reopen.
- Watchdog: if `now - lastPing > 18s` → mark stale, reopen.
- On reopen: trigger full refetch of visible-tab data.

## Connection indicator (footer)
- Green dot = live.
- Amber dot + spinner = reconnecting.
- Red dot = offline. Polling fallback at 10s.
- Hover → human text + last-event age.

## Resume hook
On `visibilitychange / pageshow / focus / online` → if last data > 4s old, refetch sessions + board in parallel.

## Loading states
- Initial: skeleton cards (not spinner).
- Subsequent: SWR-style — show stale data with a thin top progress bar.

## Empty states
Every tab has a designed empty state, not just an empty container. Headline + 1-line subhead + primary action.

## Error states
- Per-card: inline retry button if a mutation failed.
- Toast for non-blocking errors.
- Modal for fatal (e.g. auth lost).

## Offline (PWA)
- SW serves cached shell.
- Banner: "Offline — showing last known state."
- Mutations queue locally; replay when online.

## Optimistic updates
- Send message, archive, status change → optimistic.
- Roll back + toast on failure.
