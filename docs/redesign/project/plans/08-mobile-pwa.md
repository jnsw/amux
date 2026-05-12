# Mobile + PWA

## Breakpoints
- `< 480` — phone narrow
- `480 – 767` — phone
- `768 – 1023` — tablet
- `1024 – 1399` — desktop
- `≥ 1400` — wide (peek pushes instead of overlays)

Use container queries on cards/panels where viewport-based isn't right.

## Safe areas
- `viewport-fit=cover`.
- Bottom tab bar: `padding-bottom: max(8px, env(safe-area-inset-bottom))`.
- Top app bar: `padding-top: max(8px, env(safe-area-inset-top))`.

## Touch
- Hit targets ≥ 44×44.
- `@media (hover: none)`: no hover-only affordances — always-visible card menus.
- Larger tap zones on chips, status dots.

## Gestures
- Peek panel: drag-down to dismiss.
- Card swipe (left = archive, right = pin) — optional, tweakable.
- Pull-to-refresh on Sessions / Board.

## PWA install
- Detect `beforeinstallprompt` → show subtle "Install amux" chip in footer.
- Onboarding (3 steps from spec) lives in a modal triggered from Settings.

## Reduced motion / transparency
- Respect both; turn off backdrop-filters and large transforms when set.

## Theme color
- Update `<meta name="theme-color">` on theme + light-flag changes.
