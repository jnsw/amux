# Secondary Tabs (lower fidelity, consistent shell)

All secondary tabs share the same `PageShell`: title row · filter/action row · content · empty state.

## Calendar
- Month view default; toggle Week / Agenda.
- Sources: Board issues with `due` + extracted Email events.
- Click event → detail popover (link back to board issue or email).
- "Subscribe (iCal)" copies `/api/calendar.ics` URL.

## Scheduler
- Table: title · schedule expr (with human-readable next-run) · session · last run · status · actions.
- Create modal:
  - Title, session select, command (multiline).
  - Type toggle: Once / Recurring / Cron.
  - Live preview using `POST /api/schedules/preview` debounced.
  - "Next 3 runs" listed beneath.
- Row actions: Pause, Run now, Edit, Delete, History (drawer).

## Files
- Two-pane: tree (left) · viewer (right).
- Path crumb at top.
- Upload drop-zone overlay.
- Media preview using `/api/file/transcode`.

## Notes
- Tree left, markdown editor right.
- Pin / rename / trash.
- Trash sub-view with restore.

## Logs
- Live tail (sticky bottom). Filters: category · session · level.
- Stats sparkline header.

## Metrics
- Tiles: CPU · RAM · Disk · Network · Daily tokens · Speedtest.
- Per-session resource if psutil.

## Skeletons for: Terminal · Browser · Torrents · CRM · Map · Habits · Journal · Channels · Graph · Reports · Recordings · Skills · Org · Settings · Gmail
Each gets a coherent `PageShell` with appropriate empty state — visual parity matters more than full feature fidelity this pass.
