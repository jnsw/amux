# Design System

Goal: one coherent visual language across 15 tabs. CSS custom properties only, themeable, no framework.

## Type
- Family: a clean neutral grotesque for UI (Inter Tight or similar); JetBrains Mono / Berkeley Mono for terminal/preview/code.
- Scale (rem):
  - `--fs-xs: 0.6875` (11) — meta, timestamps
  - `--fs-sm: 0.8125` (13) — body small / table cells
  - `--fs-md: 0.875`  (14) — default UI body
  - `--fs-lg: 1.0`    (16) — emphasis / card title
  - `--fs-xl: 1.25`   (20) — section title
  - `--fs-2xl: 1.5`   (24) — page title
- Tracking: tight (-0.01em) on large; default elsewhere.
- Weights: 400 / 500 / 600 only.

## Color (canonical = "quiet" dark; other themes override the same tokens)
Semantic tokens (use these in components):
- `--bg`            page background
- `--bg-elev-1`     subtle surface (header, sidebar)
- `--surface`       card / panel
- `--surface-hover`
- `--border`        hairline 1px
- `--border-strong`
- `--text`          primary
- `--text-dim`      secondary / meta
- `--text-faint`    tertiary / placeholder
- `--accent`        primary action
- `--accent-soft`   tinted bg
- `--ok` / `--warn` / `--err` / `--info`
- `--status-active` / `--status-waiting` / `--status-idle`
- `--focus-ring`

Quiet dark baseline:
- bg `#0a0a0a`, surface `#121212`, border `#1f1f1f`, text `#ededed`, dim `#8a8a8a`, accent `#7c9eff`.

Themes override token values only — components never reference theme names directly.

## Spacing (4px base)
`--sp-1: 4`, `--sp-2: 8`, `--sp-3: 12`, `--sp-4: 16`, `--sp-5: 20`, `--sp-6: 24`, `--sp-8: 32`, `--sp-10: 40`, `--sp-12: 48`.

## Radii
`--r-xs: 4`, `--r-sm: 6`, `--r-md: 8`, `--r-lg: 12`, `--r-pill: 999`.

## Shadows / elevation
Quiet themes: rely on `--border` and 1px hairlines, not shadow. One subtle `--shadow-pop` for floating menus only.

## Motion
- Durations: `--dur-1: 80ms`, `--dur-2: 140ms`, `--dur-3: 220ms`.
- Easing: `--ease-out: cubic-bezier(.2,.7,.2,1)` for entrances; `--ease-in-out` for transforms.
- Respect `prefers-reduced-motion`.

## Components (atomic set)
- `Button` — primary / secondary / ghost / danger; sizes sm/md.
- `IconButton` — 32 / 36 / 44 (touch).
- `Pill / Tag` — for status, tags, recurrence.
- `Card` — surface + border, padded.
- `Field` — label + input + helper.
- `Select / Combobox` — keyboard-nav.
- `Menu` — anchored dropdown.
- `Modal / Sheet` — modal on desktop, bottom-sheet on mobile.
- `Toast`
- `EmptyState` — icon + headline + action.
- `Skeleton` — 1 line / multiline / card.
- `StatusDot` — colored dot + label.
- `KbdHint` — `⌘K` style chip.
- `LivePreview` — monospace tail of pane output (used in cards + peek).
